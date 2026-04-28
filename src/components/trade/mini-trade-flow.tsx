'use client';

/**
 * T-977d · 移动端右栏底部 mini 实时成交流(类比 OKX 订单簿)
 *
 * 单列紧凑 8 笔 · 10px 行高 · 30s 自动刷新
 * 数据源:GeckoTerminal /trades(同 ActivityBoard)
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { fetchMintTrades, type GTTrade } from '@/lib/geckoterminal';

interface Props {
  mint: string;
  limit?: number;
}

const REFRESH_MS = 30_000;

export function MiniTradeFlow({ mint, limit = 8 }: Props) {
  const t = useTranslations('trade.activity');
  const [trades, setTrades] = useState<GTTrade[] | null>(null);

  useEffect(() => {
    if (!mint) { setTrades(null); return; }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function load() {
      try {
        const list = await fetchMintTrades(mint, limit);
        if (!cancelled) setTrades(list);
      } catch {
        if (!cancelled) setTrades([]);
      }
    }
    load();
    timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [mint, limit]);

  if (!trades) {
    return (
      <div className="rounded-md border border-border/40 bg-card/40 p-2 space-y-1">
        <div className="h-2 w-full bg-muted/40 animate-pulse rounded" />
        <div className="h-2 w-3/4 bg-muted/40 animate-pulse rounded" />
        <div className="h-2 w-2/3 bg-muted/40 animate-pulse rounded" />
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="rounded-md border border-border/40 bg-card/40 p-2 text-[10px] text-muted-foreground/60 text-center">
        {t('noActivity.title')}
      </div>
    );
  }

  return (
    <Link
      href="#mobile-activity-board"
      className="block rounded-md border border-border/40 bg-card/40 p-2 hover:bg-card/60 transition-colors"
      aria-label={t('activity')}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">
        {t('activity')}
      </div>
      <div className="space-y-0.5">
        {trades.slice(0, limit).map((tr) => {
          const isBuy = tr.kind === 'buy';
          const Icon = isBuy ? ArrowDownRight : ArrowUpRight;
          const cls = isBuy ? 'text-success' : 'text-destructive';
          return (
            <div
              key={tr.txSignature}
              className="grid grid-cols-[14px_1fr_auto] items-center gap-1 text-[10px] leading-tight font-mono tabular-nums"
            >
              <Icon className={`h-2.5 w-2.5 ${cls}`} />
              <span className={`${cls} truncate`}>
                ${formatCompact(tr.usdValue)}
              </span>
              <span className="text-muted-foreground/60">{formatAge(tr.blockTimestampMs)}</span>
            </div>
          );
        })}
      </div>
    </Link>
  );
}

function formatCompact(n: number): string {
  if (!n || !Number.isFinite(n)) return '0';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
}

function formatAge(ms: number): string {
  const sec = (Date.now() - ms) / 1000;
  if (sec < 60) return `${Math.floor(sec)}s`;
  const min = sec / 60;
  if (min < 60) return `${Math.floor(min)}m`;
  const hr = min / 60;
  if (hr < 24) return `${Math.floor(hr)}h`;
  return `${Math.floor(hr / 24)}d`;
}
