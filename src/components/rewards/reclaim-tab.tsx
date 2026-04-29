'use client';

/**
 * T-REWARDS-PAGE · Tab 1 · 一键回收闲置 ATA 押金
 *
 * 流程:
 *   1. 钱包连接 → fetchEmptyAccounts(wallet) 拉空 ATA 列表
 *   2. 用户勾选(默认全选)+ 点 "免费领取 SOL"
 *   3. fresh blockhash → buildBatchCloseAccountTxs(targets) 拿多笔 v0 tx
 *   4. wallet.signAllTransactions 一次签 N 笔(不支持时退化逐笔签)
 *   5. 逐笔 sendRawTransaction + confirmTx
 *   6. 成功 = 累加 addClaimedLamports(回收量) → toast + 列表刷新
 *
 * 失败处理:任意一笔失败 → toast 报错 + 已成功的不丢(localStorage 已记)
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, type VersionedTransaction } from '@solana/web3.js';
import { toast } from 'sonner';
import { Loader2, Coins, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  fetchEmptyAccounts,
  isApiConfigured,
  type EmptyAccount,
} from '@/lib/api-client';
import { buildBatchCloseAccountTxs, type CloseTarget } from '@/lib/close-accounts';
import { confirmTx } from '@/lib/trade-tx';
import { addClaimedLamports } from '@/lib/rewards-storage';

export function ReclaimTab() {
  const t = useTranslations('rewards.reclaim');
  const wallet = useWallet();
  const { connection } = useConnection();
  const addr = wallet.publicKey?.toBase58();

  const [accounts, setAccounts] = useState<EmptyAccount[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 拉列表 · 钱包变 → 重 fetch
  useEffect(() => {
    if (!addr || !isApiConfigured()) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const r = await fetchEmptyAccounts(addr);
        if (cancelled) return;
        setAccounts(r.accounts ?? []);
        setSelected(new Set((r.accounts ?? []).map((a) => a.ata_address)));
      } catch (e: unknown) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [addr]);

  // 钱包未连 → 早返 connect-first UI(下方 if !addr) · 不需要 sync 清 state · UI 早返已挡掉旧数据展示

  const totalRecoverable = useMemo(() => {
    if (!accounts) return 0;
    return accounts
      .filter((a) => selected.has(a.ata_address))
      .reduce((sum, a) => sum + (a.rent_lamports ?? 0), 0);
  }, [accounts, selected]);

  // 钱包没连
  if (!addr) {
    return (
      <Card>
        <CardContent className="p-6 text-center" data-testid="reclaim-not-connected">
          <Coins className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
          <div className="text-sm text-muted-foreground">{t('connectFirst')}</div>
        </CardContent>
      </Card>
    );
  }

  if (loading && !accounts) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground" data-testid="reclaim-loading">
          <Loader2 className="h-5 w-5 mx-auto animate-spin mb-2" />
          <div className="text-sm">{t('loading')}</div>
        </CardContent>
      </Card>
    );
  }

  if (err) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground" data-testid="reclaim-error">
          <div className="text-sm text-[var(--brand-down)] mb-2">{t('error')}</div>
          <div className="text-xs font-mono break-all">{err}</div>
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => window.location.reload()}>
            <RefreshCw className="h-3 w-3 mr-1" />
            {t('retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!accounts || accounts.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center" data-testid="reclaim-empty">
          <CheckCircle2 className="h-10 w-10 mx-auto text-[var(--brand-up)]/70 mb-2" />
          <div className="text-sm font-medium">{t('emptyTitle')}</div>
          <div className="text-xs text-muted-foreground mt-1">{t('emptyDesc')}</div>
        </CardContent>
      </Card>
    );
  }

  const toggleAll = () => {
    if (selected.size === accounts.length) setSelected(new Set());
    else setSelected(new Set(accounts.map((a) => a.ata_address)));
  };
  const toggleOne = (ata: string) => {
    const next = new Set(selected);
    if (next.has(ata)) next.delete(ata); else next.add(ata);
    setSelected(next);
  };

  const handleClaim = async () => {
    if (!wallet.publicKey || !wallet.signAllTransactions) {
      toast.error(t('walletMissingSignAll'));
      return;
    }
    const targets: CloseTarget[] = accounts
      .filter((a) => selected.has(a.ata_address))
      .map((a) => ({ ata: new PublicKey(a.ata_address) }));
    if (targets.length === 0) return;

    setBusy(true);
    try {
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      const txs = buildBatchCloseAccountTxs(targets, wallet.publicKey, blockhash);
      if (txs.length === 0) { setBusy(false); return; }

      // 一次性签 N 笔(Phantom / Solflare / Backpack 全支持)
      let signed: VersionedTransaction[];
      try {
        signed = await wallet.signAllTransactions(txs);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        // 用户拒签 → 静默(不报错 toast)
        if (/User rejected|reject/i.test(msg)) { setBusy(false); return; }
        throw e;
      }

      // 逐笔 send + confirm · 任意一笔失败 → 已成功的不丢
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
          // 这一笔的押金量
          const targetsInTx = targets.slice(
            (i * targets.length) / signed.length,
            ((i + 1) * targets.length) / signed.length
          );
          // 押金每个 ATA 一致(2_039_280 lamports)· 用 backend 给的 rent_lamports
          const lamportsThisTx = accounts
            .filter((a) =>
              targetsInTx.some((tg) => tg.ata.toBase58() === a.ata_address)
            )
            .reduce((s, a) => s + (a.rent_lamports ?? 0), 0);
          successLamports += lamportsThisTx;
        } catch {
          failedCount++;
        }
      }

      if (successLamports > 0) {
        addClaimedLamports(successLamports);
        toast.success(
          t('successToast', {
            sol: (successLamports / 1e9).toFixed(4),
          }),
          {
            description: failedCount > 0 ? t('partialFail', { n: failedCount }) : undefined,
          }
        );
        // refresh 列表
        setAccounts((prev) =>
          prev ? prev.filter((a) => !selected.has(a.ata_address)) : prev
        );
        setSelected(new Set());
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

  return (
    <Card>
      <CardContent className="p-0" data-testid="reclaim-tab-ready">
        {/* 顶部 summary + 主按钮 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b border-border/40">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t('summarySelected', { n: selected.size, total: accounts.length })}
            </div>
            <div className="font-mono text-lg font-semibold text-[var(--brand-up)]">
              +{(totalRecoverable / 1e9).toFixed(4)} SOL
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={toggleAll} disabled={busy}>
              {selected.size === accounts.length ? t('deselectAll') : t('selectAll')}
            </Button>
            <Button
              onClick={handleClaim}
              disabled={busy || selected.size === 0}
              data-testid="reclaim-claim-button"
              className="bg-[var(--brand-up)] hover:bg-[var(--brand-up)]/90 text-black font-medium"
            >
              {busy ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  {t('claiming')}
                </>
              ) : (
                <>
                  <Coins className="h-3.5 w-3.5 mr-1" />
                  {t('claimButton')}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* 列表 */}
        <ul className="divide-y divide-border/40" data-testid="reclaim-list">
          {accounts.map((a) => {
            const checked = selected.has(a.ata_address);
            return (
              <li
                key={a.ata_address}
                className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => !busy && toggleOne(a.ata_address)}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={busy}
                  onChange={(e) => { e.stopPropagation(); toggleOne(a.ata_address); }}
                  onClick={(e) => e.stopPropagation()}
                  className="h-4 w-4 accent-[var(--brand-up)]"
                  aria-label={a.token_symbol ?? a.mint}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">
                    {a.token_symbol || `${a.mint.slice(0, 4)}…${a.mint.slice(-4)}`}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground truncate">
                    {a.ata_address.slice(0, 8)}…{a.ata_address.slice(-6)}
                  </div>
                </div>
                <div className="text-right font-mono text-xs text-[var(--brand-up)]">
                  +{(a.rent_lamports / 1e9).toFixed(6)} SOL
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
