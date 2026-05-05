'use client';

/**
 * V2 Sweep ATA Modal · in-page · 不跳 V1 /rewards
 *
 * P2-HOTFIX-3 #4:用户反馈"清扫 ATA"跳 V1 /rewards · V1 nav 突然显出 · 视觉断
 *
 * 复用 V1 链上 lib(0 改):
 *   - fetchEmptyAccounts(wallet)
 *   - buildBatchCloseAccountTxs(targets, owner, blockhash)
 *   - wallet.signAllTransactions / signTransaction
 *   - connection.sendRawTransaction + confirmTx
 *
 * V2 视觉:
 *   - backdrop blur 24 + bg-deep 92%
 *   - 玻璃容器 + brand-soft border + shadow-glow-v2
 *   - Newsreader italic 大字 "X.XXXX SOL"
 *   - brand 大按钮 "一键全收"
 *   - 列表行简版 (logo · symbol · +X SOL)
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, type VersionedTransaction } from '@solana/web3.js';
import { toast } from 'sonner';
import { Loader2, X, CheckCircle2 } from 'lucide-react';
import { fetchEmptyAccounts, type EmptyAccount } from '@/lib/api-client';
import { buildBatchCloseAccountTxs, type CloseTarget } from '@/lib/close-accounts';
import { confirmTx } from '@/lib/trade-tx';
import { addClaimedLamports } from '@/lib/rewards-storage';
import { lookupTokenDisplay, shortMint } from '@/lib/token-display';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SweepAtaModal({ open, onClose }: Props) {
  const t = useTranslations('rewards.reclaim');
  const wallet = useWallet();
  const { connection } = useConnection();
  const addr = wallet.publicKey?.toBase58();

  const [accounts, setAccounts] = useState<EmptyAccount[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 锁滚 + Esc 关
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  // 拉空 ATA · open 切 true 时
  useEffect(() => {
    if (!open || !addr) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    fetchEmptyAccounts(addr)
      .then((r) => {
        if (cancelled) return;
        setAccounts(r.accounts ?? []);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, addr]);

  const totalLamports = useMemo(() => {
    if (!accounts) return 0;
    return accounts.reduce((sum, a) => sum + (a.rent_lamports ?? 0), 0);
  }, [accounts]);

  const handleSweep = async () => {
    if (!wallet.publicKey || !accounts || accounts.length === 0) return;
    if (!wallet.signAllTransactions) {
      toast.error(t('walletMissingSignAll'));
      return;
    }
    const targets: CloseTarget[] = accounts.map((a) => ({ ata: new PublicKey(a.ata_address) }));
    setBusy(true);
    try {
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
          const lamportsThisTx = accounts
            .filter((a) => targetsInTx.some((tg) => tg.ata.toBase58() === a.ata_address))
            .reduce((s, a) => s + (a.rent_lamports ?? 0), 0);
          successLamports += lamportsThisTx;
        } catch {
          failedCount++;
        }
      }

      if (successLamports > 0) {
        addClaimedLamports(successLamports);
        toast.success(t('successToast', { sol: (successLamports / 1e9).toFixed(4) }), {
          description: failedCount > 0 ? t('partialFail', { n: failedCount }) : undefined,
        });
        // 列表清空 · 关 modal
        setAccounts([]);
        setTimeout(() => onClose(), 800);
      } else {
        toast.error(t('allFailed'));
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(t('error') + ' · ' + msg.slice(0, 80));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      className="v2-sweep-modal-root"
    >
      {/* backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      />
      {/* 玻璃 modal · mobile sheet from bottom · desktop center · 视觉自治 */}
      <div
        className="v2-sweep-modal"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 520,
          margin: '0 16px 0 16px',
          background: 'linear-gradient(135deg, rgba(14,17,23,0.96), rgba(11,13,18,0.92))',
          border: '1px solid var(--border-brand-soft)',
          borderRadius: '20px 20px 0 0',
          padding: '28px 24px 24px',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          boxShadow: 'var(--shadow-glow-v2)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* 头 · 标题 + 关闭 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div
              style={{
                fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
                fontSize: 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--brand-up)',
                marginBottom: 8,
              }}
            >
              清扫 · 空 ATA
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                fontSize: 'clamp(28px, 6vw, 36px)',
                color: 'var(--ink-100)',
                letterSpacing: '-0.02em',
                lineHeight: 1.05,
              }}
            >
              {loading
                ? '查询中…'
                : accounts && accounts.length > 0
                ? `+${(totalLamports / 1e9).toFixed(4)} SOL`
                : '钱包很干净'}
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ink-60)' }}>
              {loading
                ? '正在扫所有空 ATA · 不需签名'
                : accounts && accounts.length > 0
                ? `${accounts.length} 个空账户 · 一键签名全部回收`
                : '没有可回收的空 ATA · 你的钱包已经精简过了'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            style={{
              background: 'transparent',
              border: 0,
              color: 'var(--ink-60)',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 8,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 列表 · 滚动区 */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, marginBottom: 16 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: 'var(--ink-60)' }}>
              <Loader2 size={18} className="v2-spin" style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} />
              加载中
            </div>
          ) : err ? (
            <div style={{ padding: 24, color: 'var(--warn, #FF6B6B)', fontSize: 13, textAlign: 'center' }}>
              加载失败 · {err.slice(0, 80)}
            </div>
          ) : accounts && accounts.length > 0 ? (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {accounts.slice(0, 50).map((a) => {
                const display = lookupTokenDisplay(a.mint, a.token_symbol);
                return (
                  <li
                    key={a.ata_address}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 8px',
                      borderBottom: '1px solid var(--border-v2)',
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #00ffa3, #03e1ff)',
                        display: 'grid',
                        placeItems: 'center',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 11,
                        flexShrink: 0,
                      }}
                    >
                      {(display.symbol || '?').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{display.symbol}</div>
                      <div
                        style={{
                          fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
                          fontSize: 10,
                          color: 'var(--ink-40)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {shortMint(a.mint)}
                      </div>
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
                        fontSize: 13,
                        color: 'var(--brand-up)',
                        flexShrink: 0,
                      }}
                    >
                      +{(a.rent_lamports / 1e9).toFixed(6)} SOL
                    </div>
                  </li>
                );
              })}
              {accounts.length > 50 && (
                <li style={{ padding: 12, fontSize: 11, color: 'var(--ink-40)', textAlign: 'center' }}>
                  + 另 {accounts.length - 50} 个 · 一键签名时全收
                </li>
              )}
            </ul>
          ) : (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-60)' }}>
              <CheckCircle2 size={36} style={{ color: 'var(--brand-up)', opacity: 0.7, margin: '0 auto 8px' }} />
              <div style={{ fontSize: 14 }}>没空 ATA · 干净</div>
            </div>
          )}
        </div>

        {/* 大按钮 · brand glow */}
        <button
          type="button"
          onClick={handleSweep}
          disabled={busy || loading || !accounts || accounts.length === 0}
          style={{
            height: 56,
            background: 'var(--brand-up)',
            color: 'var(--bg-base)',
            border: 0,
            borderRadius: 14,
            fontFamily: 'inherit',
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            cursor: busy || loading || !accounts || accounts.length === 0 ? 'not-allowed' : 'pointer',
            opacity: busy || loading || !accounts || accounts.length === 0 ? 0.45 : 1,
            boxShadow: '0 0 30px rgba(25,251,155,0.28)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {busy ? (
            <>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              一键回收中…
            </>
          ) : (
            <>一键全收 · 签 1 次拿回所有 SOL</>
          )}
        </button>
      </div>
    </div>
  );
}
