'use client';

/**
 * T-985c · 桌面右栏 1h 聚合 + 买卖力量
 *
 * 后端 GET /pool/stats-1h?pool=  返买/卖 count + volume_usd + 净/总
 * mint → 通过 fetchTokenInfo(mint).topPoolAddress 拿 pool · 30s 自动刷新
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { fetchTokenInfo } from '@/lib/portfolio';
import { fetchPoolStats1h, isApiConfigured, type PoolStats1h } from '@/lib/api-client';

interface Props {
  mint: string;
}

const REFRESH_MS = 30_000;

export function PoolStatsOneHour({ mint }: Props) {
  const t = useTranslations('trade.poolStats');
  const [pool, setPool] = useState<string | null | undefined>(undefined);
  const [stats, setStats] = useState<PoolStats1h | null>(null);
  const [loading, setLoading] = useState(false);

  // mint → pool
  useEffect(() => {
    if (!mint) { setPool(null); return; }
    let cancelled = false;
    fetchTokenInfo(mint)
      .then((info) => { if (!cancelled) setPool(info?.topPoolAddress ?? null); })
      .catch(() => { if (!cancelled) setPool(null); });
    return () => { cancelled = true; };
  }, [mint]);

  // pool → stats(30s 自动刷新)
  useEffect(() => {
    if (!pool || !isApiConfigured()) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    async function load(p: string) {
      setLoading(true);
      try {
        const r = await fetchPoolStats1h(p);
        if (!cancelled) setStats(r);
      } catch {
        if (!cancelled) setStats(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load(pool);
    timer = setInterval(() => load(pool), REFRESH_MS);
    return () => { cancelled = true; if (timer) clearInterval(timer); };
  }, [pool]);

  // 加载/错误态:3 灰条 skeleton
  if (pool === undefined || (loading && !stats)) {
    return (
      <Card className="p-3 space-y-1.5">
        <div className="h-3 w-full bg-muted/40 animate-pulse rounded" />
        <div className="h-3 w-3/4 bg-muted/40 animate-pulse rounded" />
        <div className="h-3 w-2/3 bg-muted/40 animate-pulse rounded" />
      </Card>
    );
  }

  if (pool === null || !stats || !stats.ok) {
    return (
      <Card className="p-3 text-[11px] text-muted-foreground/60 text-center">
        {t('unavailable')}
      </Card>
    );
  }

  const net = stats.net_volume_usd;
  const NetIcon = net >= 0 ? TrendingUp : TrendingDown;
  const netCls = net >= 0 ? 'text-success' : 'text-destructive';

  return (
    <Card className="p-3 space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{t('totalVolume')}</span>
        <span className="font-mono font-semibold tabular-nums">{formatUsd(stats.total_volume_usd)}</span>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground inline-flex items-center gap-1">
          <NetIcon className={`h-3 w-3 ${netCls}`} />
          {t('netVolume')}
        </span>
        <span className={`font-mono font-semibold tabular-nums ${netCls}`}>
          {net >= 0 ? '+' : ''}{formatUsd(net)}
        </span>
      </div>
      <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-border/40">
        <span className="text-success font-mono tabular-nums">
          {t('buys')} {stats.buy_count} / {formatUsd(stats.buy_volume_usd)}
        </span>
        <span className="text-destructive font-mono tabular-nums">
          {t('sells')} {stats.sell_count} / {formatUsd(stats.sell_volume_usd)}
        </span>
      </div>
    </Card>
  );
}

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return '$0';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}
