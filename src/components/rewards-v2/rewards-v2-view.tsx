'use client';

/**
 * T-UI-OVERHAUL Stage 5.3c · 奖励页 luxury · 2 tab
 *
 * Tab 1 · 回收 SOL · fetchEmptyAccounts + 一键全收(MetalButton spaced)
 * Tab 2 · MEV 保护 · fetchPortfolioMevSavings · 真数据
 *
 * 邀请返佣不在这里 · 等 Stage 5.4 nav 改造 · MoreMenu 下拉里挂入口
 *
 * mockup ref:.coordination/MOCKUPS/ui-overhaul-preview-v2.html PAGE 3
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useTranslations } from 'next-intl';
import { PublicKey, type VersionedTransaction } from '@solana/web3.js';
import { toast } from 'sonner';
import { Wallet, Loader2 } from 'lucide-react';
import {
  EyebrowPill,
  ItalicAccent,
  MetalButton,
  GlassCard,
  HeroNumber,
} from '@/components/ui-v2';
import {
  fetchEmptyAccounts,
  fetchPortfolioMevSavings,
  isApiConfigured,
  type EmptyAccount,
  type PortfolioMevSavingsResponse,
} from '@/lib/api-client';
import { buildBatchCloseAccountTxs, type CloseTarget } from '@/lib/close-accounts';
import { confirmTx } from '@/lib/trade-tx';
import { addClaimedLamports } from '@/lib/rewards-storage';
import { lookupTokenDisplay, shortMint } from '@/lib/token-display';

type Tab = 'ata' | 'mev';

export function RewardsV2View() {
  const t = useTranslations('landingV2.rewards');
  const wallet = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();
  const [tab, setTab] = useState<Tab>('ata');
  const addr = wallet.publicKey?.toBase58();

  if (!addr) {
    return (
      <main className="relative z-[2] flex flex-1 flex-col items-center justify-center py-32 gap-6 text-center">
        <Wallet className="h-12 w-12 text-[var(--ink-40)]" />
        <p className="text-base text-[var(--ink-80)] max-w-md">
          {t('wallet.connectPrompt')}
        </p>
        <MetalButton size="lg" onClick={() => openWalletModal(true)}>
          {t('wallet.connect')}
        </MetalButton>
      </main>
    );
  }

  return (
    <main className="relative z-[2] container mx-auto px-4 sm:px-14 py-12 max-w-[920px]">
      {/* Tab toggle · 玻璃质感 */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          margin: '0 auto 64px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-v2)',
          borderRadius: '12px',
          padding: '6px',
          width: 'fit-content',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <TabButton active={tab === 'ata'} onClick={() => setTab('ata')}>
          {t('tabs.ata')}
        </TabButton>
        <TabButton active={tab === 'mev'} onClick={() => setTab('mev')}>
          {t('tabs.mev')}
        </TabButton>
      </div>

      {tab === 'ata' ? <AtaTab t={t} addr={addr} /> : <MevTab t={t} addr={addr} />}

      {/* FAQ fold · 玻璃 · 永久显 */}
      <GlassCard radius={12} className="mt-16">
        <div style={{ padding: '24px 32px' }}>
          <div
            style={{
              fontFamily: 'var(--font-geist), sans-serif',
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--ink-100)',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <span
              style={{
                color: 'var(--brand-up)',
                fontFamily: 'var(--font-newsreader), Georgia, serif',
                fontStyle: 'italic',
              }}
            >
              —
            </span>
            {t('faqTitle')}
          </div>
          <div
            style={{
              fontSize: '13px',
              color: 'var(--ink-60)',
              lineHeight: 1.7,
            }}
          >
            {t('faqBody')}
          </div>
        </div>
      </GlassCard>
    </main>
  );
}

// ─── Tab 按钮 ─────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '12px 24px',
        fontFamily: 'var(--font-geist), sans-serif',
        fontSize: '14px',
        fontWeight: 500,
        color: active ? 'var(--ink-100)' : 'var(--ink-60)',
        cursor: 'pointer',
        letterSpacing: '-0.005em',
        border: 'none',
        background: active ? 'var(--bg-elev)' : 'none',
        borderRadius: '8px',
        boxShadow: active ? '0 1px 0 0 rgba(255,255,255,0.08) inset' : undefined,
        transition: 'all 200ms',
      }}
    >
      {children}
    </button>
  );
}

// ─── ATA Tab ─────────────────────────────────

function AtaTab({
  t,
  addr,
}: {
  t: ReturnType<typeof useTranslations>;
  addr: string;
}) {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [accounts, setAccounts] = useState<EmptyAccount[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isApiConfigured()) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await fetchEmptyAccounts(addr);
      setAccounts(r.accounts ?? []);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [addr]);

  useEffect(() => {
    load();
  }, [load]);

  const totalLamports = useMemo(
    () => (accounts ?? []).reduce((s, a) => s + (a.rent_lamports ?? 0), 0),
    [accounts],
  );
  const totalSol = totalLamports / 1e9;
  const count = accounts?.length ?? 0;

  const handleClaim = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signAllTransactions) {
      toast.error('Wallet missing signAllTransactions');
      return;
    }
    if (!accounts || accounts.length === 0) return;
    setBusy(true);
    try {
      const targets: CloseTarget[] = accounts.map((a) => ({
        ata: new PublicKey(a.ata_address),
      }));
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      const txs = buildBatchCloseAccountTxs(targets, wallet.publicKey, blockhash);
      if (txs.length === 0) {
        setBusy(false);
        return;
      }
      let signed: VersionedTransaction[];
      try {
        signed = await wallet.signAllTransactions(txs);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/User rejected|reject/i.test(msg)) {
          setBusy(false);
          return;
        }
        throw e;
      }
      let successLamports = 0;
      let failedCount = 0;
      for (let i = 0; i < signed.length; i++) {
        try {
          const sig = await connection.sendRawTransaction(signed[i].serialize(), {
            skipPreflight: false,
            maxRetries: 3,
          });
          const ok = await confirmTx(connection, sig, 60_000);
          if (!ok) throw new Error(`__ERR_UNCONFIRMED:${sig}`);
          const targetsInTx = targets.slice(
            (i * targets.length) / signed.length,
            ((i + 1) * targets.length) / signed.length,
          );
          successLamports += accounts
            .filter((a) => targetsInTx.some((tg) => tg.ata.toBase58() === a.ata_address))
            .reduce((s, a) => s + (a.rent_lamports ?? 0), 0);
        } catch {
          failedCount++;
        }
      }
      addClaimedLamports(successLamports);
      const claimedSol = (successLamports / 1e9).toFixed(4);
      toast.success(
        t('ata.successDesc', { sol: claimedSol, n: signed.length - failedCount }),
      );
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [wallet, accounts, connection, t, load]);

  if (loading && accounts === null) {
    return (
      <div className="text-center py-16 text-[var(--ink-60)] flex justify-center items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('loading')}
      </div>
    );
  }
  if (err) {
    return (
      <div className="text-center py-16 space-y-3">
        <div className="text-sm text-[var(--brand-down)]">{t('error')}</div>
        <div className="text-xs font-mono text-[var(--ink-60)] break-all">{err}</div>
      </div>
    );
  }

  if (count === 0) {
    return (
      <section className="text-center py-16">
        <ItalicAccent variant="green" as="div" style={{ fontSize: '48px', padding: 0 }}>
          ○
        </ItalicAccent>
        <div className="mt-6 text-2xl font-medium text-[var(--ink-100)]">
          {t('ata.emptyTitle')}
        </div>
        <div className="mt-3 text-sm text-[var(--ink-60)] max-w-md mx-auto">
          {t('ata.emptyDesc')}
        </div>
      </section>
    );
  }

  return (
    <section>
      {/* Hero · 大数字 + 一键全收 */}
      <div className="text-center mb-16">
        <div
          style={{
            fontFamily: 'var(--font-geist-mono), Menlo, monospace',
            fontSize: '12px',
            color: 'var(--ink-60)',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            marginBottom: '24px',
          }}
        >
          {t('ata.eyebrow')}
        </div>
        <div style={{ marginBottom: '16px' }}>
          <HeroNumber
            value={totalSol}
            size={Math.min(152, Math.max(96, typeof window !== 'undefined' ? window.innerWidth * 0.13 : 120))}
            unit="SOL"
            color="transparent"
            decimals={3}
            style={{
              background: 'linear-gradient(180deg, #FFFFFF 0%, var(--brand-up) 80%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
            }}
          />
        </div>
        <div
          style={{
            fontFamily: 'var(--font-geist-mono), Menlo, monospace',
            fontSize: '14px',
            color: 'var(--ink-60)',
            marginBottom: '64px',
          }}
        >
          {t('ata.subPrefix')}
          <span style={{ color: 'var(--ink-100)' }}>
            ${(totalSol * 84).toFixed(2)}
          </span>
          {t('ata.subFromPrefix')}
          <span style={{ color: 'var(--ink-100)' }}>{count}</span>
          {t('ata.subFromSuffix')}
        </div>
        <MetalButton size="xl" spaced disabled={busy} onClick={handleClaim}>
          {busy ? t('ata.claiming') : t('ata.btn')}
        </MetalButton>
      </div>

      {/* 待回收清单 */}
      <GlassCard radius={16} className="overflow-hidden">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            padding: '24px 32px',
            borderBottom: '1px solid var(--border-v2)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-geist), sans-serif',
              fontSize: '16px',
              fontWeight: 500,
              color: 'var(--ink-100)',
              letterSpacing: '-0.01em',
            }}
          >
            {t('ata.listTitle')}
          </div>
          <div
            style={{
              fontSize: '12px',
              color: 'var(--ink-60)',
              fontFamily: 'var(--font-geist-mono), Menlo, monospace',
              letterSpacing: '0.04em',
            }}
          >
            {t('ata.listMeta', { n: count })}
          </div>
        </div>
        {(accounts ?? []).slice(0, 50).map((acc) => {
          const display = lookupTokenDisplay(acc.mint, acc.token_symbol);
          return (
            <div
              key={acc.ata_address}
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr 120px',
                gap: '24px',
                padding: '18px 32px',
                alignItems: 'center',
                borderBottom: '1px solid var(--border-v2)',
                fontFamily: 'var(--font-geist-mono), Menlo, monospace',
                fontSize: '13px',
                fontFeatureSettings: "'tnum' 1",
              }}
            >
              <span style={{ color: 'var(--ink-100)', fontWeight: 500 }}>
                {display.symbol}
              </span>
              <span style={{ color: 'var(--ink-60)' }}>{shortMint(acc.mint)}</span>
              <span
                style={{
                  color: 'var(--brand-up)',
                  textAlign: 'right',
                  fontWeight: 500,
                }}
              >
                {t('ata.rowSaved', { sol: ((acc.rent_lamports ?? 0) / 1e9).toFixed(3) })}
              </span>
            </div>
          );
        })}
      </GlassCard>
    </section>
  );
}

// ─── MEV Tab ─────────────────────────────────

function MevTab({
  t,
  addr,
}: {
  t: ReturnType<typeof useTranslations>;
  addr: string;
}) {
  const [data, setData] = useState<PortfolioMevSavingsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isApiConfigured()) return;
    setLoading(true);
    setErr(null);
    fetchPortfolioMevSavings(addr)
      .then((r) => setData(r))
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [addr]);

  if (loading && data === null) {
    return (
      <div className="text-center py-16 text-[var(--ink-60)] flex justify-center items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('loading')}
      </div>
    );
  }
  if (err) {
    return (
      <div className="text-center py-16 space-y-3">
        <div className="text-sm text-[var(--brand-down)]">{t('error')}</div>
        <div className="text-xs font-mono text-[var(--ink-60)] break-all">{err}</div>
      </div>
    );
  }

  const totalSol = data?.total_saved_sol ?? 0;
  const trades = data?.total_trades ?? 0;
  const sender = data?.trades_using_sender ?? 0;

  if (trades === 0) {
    return (
      <section className="text-center py-16">
        <ItalicAccent variant="green" as="div" style={{ fontSize: '48px', padding: 0 }}>
          —
        </ItalicAccent>
        <div className="mt-6 text-2xl font-medium text-[var(--ink-100)]">
          {t('mev.emptyTitle')}
        </div>
        <div className="mt-3 text-sm text-[var(--ink-60)] max-w-md mx-auto">
          {t('mev.emptyDesc')}
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="text-center mb-16">
        <div
          style={{
            fontFamily: 'var(--font-geist-mono), Menlo, monospace',
            fontSize: '12px',
            color: 'var(--ink-60)',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            marginBottom: '24px',
          }}
        >
          {t('mev.eyebrow')}
        </div>
        <div style={{ marginBottom: '16px' }}>
          <HeroNumber
            value={totalSol}
            size={Math.min(152, Math.max(96, typeof window !== 'undefined' ? window.innerWidth * 0.13 : 120))}
            unit="SOL"
            color="transparent"
            decimals={4}
            style={{
              background: 'linear-gradient(180deg, #FFFFFF 0%, var(--brand-up) 80%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
            }}
          />
        </div>
        <div
          style={{
            fontFamily: 'var(--font-geist-mono), Menlo, monospace',
            fontSize: '14px',
            color: 'var(--ink-60)',
          }}
        >
          {t('mev.sub', { n: trades, sender })}
        </div>
      </div>

      <GlassCard radius={16} className="overflow-hidden">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            padding: '24px 32px',
            borderBottom: '1px solid var(--border-v2)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-geist), sans-serif',
              fontSize: '16px',
              fontWeight: 500,
              color: 'var(--ink-100)',
            }}
          >
            {t('mev.listTitle')}
          </div>
          <div
            style={{
              fontSize: '12px',
              color: 'var(--ink-60)',
              fontFamily: 'var(--font-geist-mono), Menlo, monospace',
              letterSpacing: '0.04em',
            }}
          >
            {t('mev.listMeta', { n: trades })}
          </div>
        </div>
        {(data?.per_trade ?? []).slice(0, 50).map((row) => (
          <div
            key={row.signature}
            style={{
              display: 'grid',
              gridTemplateColumns: '100px 1fr 1fr 120px',
              gap: '24px',
              padding: '18px 32px',
              alignItems: 'center',
              borderBottom: '1px solid var(--border-v2)',
              fontFamily: 'var(--font-geist-mono), Menlo, monospace',
              fontSize: '13px',
              fontFeatureSettings: "'tnum' 1",
            }}
          >
            <span style={{ color: 'var(--ink-60)' }}>
              {row.block_time ? formatDate(row.block_time) : '—'}
            </span>
            <span style={{ color: 'var(--ink-100)' }}>
              {row.signature.slice(0, 6)}…{row.signature.slice(-4)}
            </span>
            <span
              style={{
                color: row.used_sender ? 'var(--brand-up)' : 'var(--ink-60)',
              }}
            >
              {row.used_sender ? t('mev.rowSenderYes') : t('mev.rowSenderNo')}
            </span>
            <span
              style={{
                color: 'var(--brand-up)',
                textAlign: 'right',
                fontWeight: 500,
              }}
            >
              {t('mev.rowSaved', { sol: (row.saved_sol ?? 0).toFixed(4) })}
            </span>
          </div>
        ))}
      </GlassCard>
    </section>
  );
}

function formatDate(unix: number): string {
  const d = new Date(unix * 1000);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}-${day}`;
}
