'use client';

/**
 * T-985b · 桌面右栏底部 4 数字栏:总买入 / 总卖出 / 余额 / 总收益
 *
 * 数据源:useTxHistory(100) + cost-basis 计算 · current token price 估算余额价值
 * 钱包未连 / 无该币持仓 → 显 $0.00 灰字 + tooltip
 */
import { useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useTranslations } from 'next-intl';
import { useTxHistory } from '@/hooks/use-tx-history';
import { fetchSolUsdPrice } from '@/lib/portfolio';
import { Card } from '@/components/ui/card';

interface Props {
  mint: string;
  /** 当前代币价格(USD)· 估算余额价值用 */
  tokenPriceUsd?: number | null;
}

export function WalletTokenStats({ mint, tokenPriceUsd }: Props) {
  const t = useTranslations('trade.walletStats');
  const { connected } = useWallet();
  const { records } = useTxHistory(100);
  const [solUsd, setSolUsd] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSolUsdPrice()
      .then((p) => { if (!cancelled) setSolUsd(p); })
      .catch(() => { if (!cancelled) setSolUsd(null); });
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    if (!records || !mint) return null;
    let totalBoughtSol = 0;
    let totalBoughtTokens = 0;
    let totalSoldSol = 0;
    let totalSoldTokens = 0;
    for (const r of records) {
      if (r.tokenMint !== mint || r.err) continue;
      if (r.type === 'buy' && r.tokenAmount > 0 && r.solAmount > 0) {
        totalBoughtSol += r.solAmount;
        totalBoughtTokens += r.tokenAmount;
      } else if (r.type === 'sell' && r.tokenAmount > 0) {
        totalSoldSol += r.solAmount;
        totalSoldTokens += r.tokenAmount;
      }
    }
    const balance = Math.max(0, totalBoughtTokens - totalSoldTokens);
    return { totalBoughtSol, totalSoldSol, balance };
  }, [records, mint]);

  const sUsd = solUsd ?? 0;
  const tUsd = tokenPriceUsd ?? 0;

  const boughtUsd = stats ? stats.totalBoughtSol * sUsd : 0;
  const soldUsd = stats ? stats.totalSoldSol * sUsd : 0;
  const balanceUsd = stats ? stats.balance * tUsd : 0;
  // 总收益 = 已卖回 USD + 当前持仓价值 - 总买入
  const pnlUsd = soldUsd + balanceUsd - boughtUsd;

  const noActivity = !stats || (stats.totalBoughtSol === 0 && stats.totalSoldSol === 0 && stats.balance === 0);
  const muted = !connected || noActivity;

  const tooltip = !connected
    ? t('connectWallet')
    : noActivity
      ? t('noActivity')
      : undefined;

  return (
    <Card className="p-3" title={tooltip}>
      <div className="grid grid-cols-2 gap-3">
        <Stat label={t('totalBuy')} value={formatUsd(boughtUsd)} muted={muted} />
        <Stat label={t('totalSell')} value={formatUsd(soldUsd)} muted={muted} />
        <Stat label={t('balance')} value={formatUsd(balanceUsd)} muted={muted} />
        <Stat
          label={t('totalPnl')}
          value={(muted ? '' : pnlUsd >= 0 ? '+' : '') + formatUsd(pnlUsd)}
          muted={muted}
          tone={muted ? undefined : pnlUsd > 0 ? 'success' : pnlUsd < 0 ? 'destructive' : undefined}
        />
      </div>
    </Card>
  );
}

function Stat({
  label, value, muted, tone,
}: {
  label: string;
  value: string;
  muted?: boolean;
  tone?: 'success' | 'destructive';
}) {
  const valueCls = muted
    ? 'text-muted-foreground/50'
    : tone === 'success' ? 'text-success'
      : tone === 'destructive' ? 'text-destructive'
        : 'text-foreground';
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={`text-base font-mono font-semibold tabular-nums truncate ${valueCls}`}>
        {value}
      </span>
    </div>
  );
}

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return '$0.00';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}
