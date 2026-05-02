'use client';

/**
 * T-UI-OVERHAUL Stage 5.3b · 持仓页 luxury 双视角
 *
 * 视角切换:
 *  - 没连钱包 → ConnectGate
 *  - 连了 + savings.trade_count == 0 → EmptyStatePortfolio(新用户)
 *  - 连了 + 有交易 → 全 luxury(总持仓 + savings + breakdown + holdings + ATA banner)
 *
 * 数据源(并发):
 *  - fetchPortfolioSavings(wallet)
 *  - fetchPortfolioHoldings(wallet)
 *  - fetchPortfolioMevSavings(wallet)
 *  - fetchEmptyAccounts(wallet)(ATA banner 用)
 *
 * mockup ref:.coordination/MOCKUPS/ui-overhaul-preview-v2.html PAGE 2 + PAGE 2b
 */
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useTranslations } from 'next-intl';
import { Wallet, Loader2 } from 'lucide-react';
import {
  EyebrowPill,
  ItalicAccent,
  MetalButton,
  GhostButton,
  GlassCard,
  SavingsCard,
  BreakdownRow,
  AtaBanner,
  EmptyStatePortfolio,
  HoldingRow,
  TradeReverseLookup,
  HeroNumber,
  type ChangeDirection,
} from '@/components/ui-v2';
import {
  fetchPortfolioSavings,
  fetchPortfolioHoldings,
  fetchPortfolioMevSavings,
  fetchEmptyAccounts,
  type PortfolioSavingsResponse,
  type HoldingsResponse,
  type PortfolioMevSavingsResponse,
  type EmptyAccountsResp,
  isApiConfigured,
} from '@/lib/api-client';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export function PortfolioV2View() {
  const t = useTranslations('landingV2.portfolio');
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();

  const [savings, setSavings] = useState<PortfolioSavingsResponse | null>(null);
  const [holdings, setHoldings] = useState<HoldingsResponse | null>(null);
  const [mev, setMev] = useState<PortfolioMevSavingsResponse | null>(null);
  const [empty, setEmpty] = useState<EmptyAccountsResp | null>(null);
  const [state, setState] = useState<LoadState>('idle');
  const [expandedMint, setExpandedMint] = useState<string | null>(null);

  const wallet = publicKey?.toBase58();

  const load = useCallback(async (w: string) => {
    if (!isApiConfigured()) {
      setState('error');
      return;
    }
    setState('loading');
    const [sv, hd, mv, ea] = await Promise.all([
      fetchPortfolioSavings(w).catch(() => null),
      fetchPortfolioHoldings(w).catch(() => null),
      fetchPortfolioMevSavings(w).catch(() => null),
      fetchEmptyAccounts(w).catch(() => null),
    ]);
    setSavings(sv);
    setHoldings(hd);
    setMev(mv);
    setEmpty(ea);
    setState(sv == null && hd == null ? 'error' : 'ready');
  }, []);

  useEffect(() => {
    if (!connected || !wallet) return;
    load(wallet);
  }, [connected, wallet, load]);

  // 没连钱包
  if (!connected || !wallet) {
    return (
      <ConnectGate
        prompt={t('wallet.connectPrompt')}
        cta={t('wallet.connect')}
        onConnect={() => openWalletModal(true)}
      />
    );
  }

  // 加载中
  if (state === 'loading' || state === 'idle') {
    return (
      <div className="flex justify-center py-32 text-[var(--ink-60)] text-sm gap-2 items-center">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('loading')}
      </div>
    );
  }

  // 出错
  if (state === 'error') {
    return (
      <div className="flex flex-col items-center py-32 gap-4">
        <div className="text-sm text-[var(--ink-60)]">{t('loadFailed')}</div>
        <GhostButton onClick={() => load(wallet)}>{t('loadFailed')}</GhostButton>
      </div>
    );
  }

  // 新用户视角
  if ((savings?.trade_count ?? 0) === 0) {
    return (
      <main className="relative z-[2] container-narrow mx-auto px-14 py-8">
        <EmptyStatePortfolio
          title={
            <>
              {t('empty.titleA')}
              <ItalicAccent variant="green">{t('empty.titleAccent')}</ItalicAccent>
              {t('empty.titleB')}
            </>
          }
          sub={t('empty.sub')}
          ctaText={t('empty.cta')}
          onCta={() => router.push('/trade')}
          pills={[
            { text: '0.1%', accent: t('empty.pillFee') },
            { text: t('empty.pillMev') },
            { text: t('empty.pillAta') },
          ]}
        />
      </main>
    );
  }

  // 老用户视角(有交易)
  return (
    <OldUserView
      t={t}
      wallet={wallet}
      savings={savings}
      holdings={holdings}
      mev={mev}
      empty={empty}
      expandedMint={expandedMint}
      setExpandedMint={setExpandedMint}
      onClaimAta={() => router.push('/rewards')}
    />
  );
}

// ─── 组件 · 没连钱包 ─────────────────────────────────

function ConnectGate({
  prompt,
  cta,
  onConnect,
}: {
  prompt: string;
  cta: string;
  onConnect: () => void;
}) {
  return (
    <main className="relative z-[2] flex flex-1 flex-col items-center justify-center py-32 gap-6 text-center">
      <Wallet className="h-12 w-12 text-[var(--ink-40)]" />
      <p className="text-base text-[var(--ink-80)] max-w-md">{prompt}</p>
      <MetalButton size="lg" onClick={onConnect}>
        {cta}
      </MetalButton>
    </main>
  );
}

// ─── 组件 · 老用户视角 ─────────────────────────────────

function OldUserView({
  t,
  wallet,
  savings,
  holdings,
  mev,
  empty,
  expandedMint,
  setExpandedMint,
  onClaimAta,
}: {
  t: ReturnType<typeof useTranslations>;
  wallet: string;
  savings: PortfolioSavingsResponse | null;
  holdings: HoldingsResponse | null;
  mev: PortfolioMevSavingsResponse | null;
  empty: EmptyAccountsResp | null;
  expandedMint: string | null;
  setExpandedMint: (m: string | null) => void;
  onClaimAta: () => void;
}) {
  const totalUsd = computeTotalUsd(holdings);
  const items = (holdings?.items ?? []).slice().sort(
    (a, b) => (b.value_usd ?? 0) - (a.value_usd ?? 0),
  );
  const totals = savings?.totals;
  const ataCount = empty?.count ?? 0;
  const ataSol = empty?.total_recoverable_sol ?? (empty?.total_recoverable_lamports ?? 0) / 1e9;

  return (
    <main className="relative z-[2] container mx-auto px-4 sm:px-14 py-8 max-w-[1240px]">
      {/* Hero · 总持仓 + savings 双卡 */}
      <section
        style={{
          padding: '32px 0 32px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '32px',
          alignItems: 'end',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--font-geist-mono), Menlo, monospace',
              fontSize: '11px',
              letterSpacing: '0.18em',
              color: 'var(--ink-60)',
              textTransform: 'uppercase',
              marginBottom: '16px',
            }}
          >
            {t('totalEyebrow')}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-geist), -apple-system, sans-serif',
              fontWeight: 500,
              fontSize: 'clamp(64px, 8vw, 88px)',
              letterSpacing: '-0.045em',
              lineHeight: 0.95,
              fontFeatureSettings: "'tnum' 1",
              color: 'var(--ink-100)',
              marginBottom: '14px',
            }}
          >
            ${formatThousand(totalUsd)}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-geist-mono), Menlo, monospace',
              fontSize: '13px',
              color: 'var(--ink-60)',
              wordBreak: 'break-all',
            }}
          >
            {wallet.slice(0, 6)}…{wallet.slice(-6)}
          </div>
        </div>

        <SavingsCard
          eyebrow={t('savings.eyebrow')}
          valueSol={Number(totals?.saved_sol ?? 0)}
          unit="SOL"
          sub={
            <>
              {t('savings.subPrefix')}
              <span style={{ color: 'var(--ink-100)' }}>${formatThousand(Number(totals?.saved_usd ?? 0))}</span>
              {t('savings.subFromPrefix')}
              <span style={{ color: 'var(--ink-100)' }}>{savings?.trade_count ?? 0}</span>
              {t('savings.subFromSuffix')}
            </>
          }
          animate={false}
        />
      </section>

      {/* Breakdown 拆解 */}
      <GlassCard radius={16} className="overflow-hidden mt-8">
        <BreakdownRow
          label={t('breakdown.feeLabel')}
          hint={t('breakdown.feeHint')}
          value={`${(totals?.fee_saved_sol ?? 0).toFixed(3)} SOL`}
        />
        <BreakdownRow
          label={t('breakdown.mevLabel')}
          hint={t('breakdown.mevHint')}
          value={`${(mev?.total_saved_sol ?? totals?.mev_saved_sol ?? 0).toFixed(3)} SOL`}
        />
        <BreakdownRow
          label={t('breakdown.ataLabel')}
          hint={t('breakdown.ataHint')}
          value={`${(totals?.ata_reclaimed_sol ?? 0).toFixed(3)} SOL`}
          last
        />
      </GlassCard>

      {/* 持仓清单 */}
      <section style={{ padding: '64px 0 32px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: '24px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-geist), sans-serif',
              fontSize: '28px',
              fontWeight: 500,
              letterSpacing: '-0.025em',
              color: 'var(--ink-100)',
            }}
          >
            {t('holdings.title')}
          </div>
          <div
            style={{
              fontSize: '12px',
              color: 'var(--ink-60)',
              fontFamily: 'var(--font-geist-mono), Menlo, monospace',
              letterSpacing: '0.04em',
            }}
          >
            {t('holdings.metaCount', { n: items.length })}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-16 text-[var(--ink-60)]">{t('holdings.empty')}</div>
        ) : (
          <GlassCard radius={16} className="overflow-hidden">
            {items.map((it, i) => {
              const expanded = expandedMint === it.mint;
              const change = computeChangeDir(it.price_change_24h_pct);
              return (
                <div key={it.mint}>
                  <HoldingRow
                    symbol={it.symbol || it.mint.slice(0, 4)}
                    name={it.name || undefined}
                    icon={
                      it.logo_uri ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={it.logo_uri}
                          alt=""
                          width={36}
                          height={36}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <span>{(it.symbol || it.mint).slice(0, 2).toUpperCase()}</span>
                      )
                    }
                    amount={`${formatTokenAmount(it.amount)} ${it.symbol || ''}`}
                    value={it.value_usd != null ? `$${formatThousand(it.value_usd)}` : '—'}
                    change={
                      it.price_change_24h_pct != null
                        ? `${change === 'up' ? '↑ +' : change === 'down' ? '↓ ' : '— '}${Math.abs(it.price_change_24h_pct).toFixed(2)}%`
                        : '—'
                    }
                    changeDir={change}
                    active={expanded}
                    onClick={() => setExpandedMint(expanded ? null : it.mint)}
                  />
                  {expanded && (
                    <ExpandedLookup
                      t={t}
                      mint={it.mint}
                      symbol={it.symbol || it.mint.slice(0, 4)}
                    />
                  )}
                  {i === items.length - 1 && null}
                </div>
              );
            })}
          </GlassCard>
        )}
      </section>

      {/* ATA banner */}
      <div className="mt-8 mb-12">
        {ataCount > 0 ? (
          <AtaBanner
            text={t('ata.text', { n: ataCount, sol: ataSol.toFixed(3) })}
            meta={t('ata.meta', {
              n: ataCount,
              usd: `$${(ataSol * estimateSolUsd(holdings)).toFixed(2)}`,
            })}
            buttonText={t('ata.btn')}
            onAction={onClaimAta}
          />
        ) : (
          <GlassCard radius={16}>
            <div className="px-9 py-6 text-center">
              <div className="text-[var(--ink-100)] font-medium">{t('ata.noneText')}</div>
              <div className="text-xs text-[var(--ink-60)] mt-1">{t('ata.noneMeta')}</div>
            </div>
          </GlassCard>
        )}
      </div>

      {/* footer · trust */}
      <div className="text-center text-[11px] text-[var(--ink-40)] font-mono mt-8">
        <EyebrowPill brand>OCUFI · TRADER</EyebrowPill>
      </div>
    </main>
  );
}

// ─── ExpandedLookup · per-trade reverse · placeholder/best-effort ───
//   savings.per_trade 数组 · 当前后端返空 · 暂用 holding 占位估算
//   等后端 per_trade 真返时 · 这里改成查 it.mint 的 row

function ExpandedLookup({
  t,
  mint,
  symbol,
}: {
  t: ReturnType<typeof useTranslations>;
  mint: string;
  symbol: string;
}) {
  // V1 简化:per_trade 是 array · 没匹配字段 · 显示 placeholder 让用户知道功能存在
  // V2 等后端补字段后真接
  return (
    <TradeReverseLookup
      context={
        <>
          {t('holdings.expandLookup.context', {
            date: '—',
            amount: '—',
            symbol,
            sol: '—',
            price: '—',
          })}
        </>
      }
      us={{
        label: t('holdings.expandLookup.usLabel'),
        value: '—',
        ratio: t('holdings.expandLookup.usRatio'),
      }}
      them={{
        label: t('holdings.expandLookup.themLabel'),
        value: '—',
        ratio: t('holdings.expandLookup.themRatio'),
      }}
      saved={{
        label: t('holdings.expandLookup.savedLabel'),
        value: '—',
        ratio: t('holdings.expandLookup.savedRatio', { usd: '—' }),
      }}
      actions={[
        {
          label: t('holdings.expandLookup.actionTx'),
          href: `https://solscan.io/token/${mint}`,
        },
        {
          label: t('holdings.expandLookup.actionCopy'),
          onClick: () => {
            if (typeof navigator !== 'undefined' && navigator.clipboard) {
              navigator.clipboard.writeText(mint).catch(() => {});
            }
          },
        },
      ]}
    />
  );
}

// ─── helpers ──────────────────────────────────────────

function computeTotalUsd(holdings: HoldingsResponse | null): number {
  if (!holdings) return 0;
  if (holdings.total_usd != null) return holdings.total_usd;
  return (holdings.items ?? []).reduce((acc, it) => acc + (it.value_usd ?? 0), 0);
}

function computeChangeDir(pct: number | null | undefined): ChangeDirection {
  if (pct == null) return 'flat';
  if (pct > 0) return 'up';
  if (pct < 0) return 'down';
  return 'flat';
}

function formatThousand(n: number): string {
  if (!Number.isFinite(n)) return '0.00';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTokenAmount(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return n.toFixed(2);
  return n.toPrecision(3);
}

function estimateSolUsd(holdings: HoldingsResponse | null): number {
  if (!holdings) return 0;
  // 找 SOL/wrapped SOL · 取 price_usd · 兜底 0
  const sol = (holdings.items ?? []).find(
    (x) => x.mint === 'So11111111111111111111111111111111111111112' || x.symbol === 'SOL',
  );
  return sol?.price_usd ?? 0;
}
