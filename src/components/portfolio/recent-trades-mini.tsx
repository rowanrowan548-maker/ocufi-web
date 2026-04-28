'use client';

/**
 * T-PF-81 · portfolio 顶部最近成交 5 行
 *
 * 数据源:useTxHistory(5)· 取用户自己的最近 5 笔
 * 行为:点任一行跳 /history · 整体 Card 也有"全部"链接
 */
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowDownRight, ArrowUpRight, ArrowRight, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useTxHistory, type EnrichedTxRecord } from '@/hooks/use-tx-history';
import { getCurrentChain } from '@/config/chains';

const LIMIT = 5;

export function RecentTradesMini() {
  const t = useTranslations();
  const chain = getCurrentChain();
  const { records, loading } = useTxHistory(LIMIT);

  const rows = records.slice(0, LIMIT);

  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t('portfolio.recentTrades.title')}
          </span>
          <Link
            href="/history"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-0.5"
          >
            {t('portfolio.recentTrades.viewAll')}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {loading && rows.length === 0 ? (
          <div className="space-y-1.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-6 w-full bg-muted/40 animate-pulse rounded" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-4 text-xs text-muted-foreground/60 text-center">
            {t('portfolio.recentTrades.empty')}
          </div>
        ) : (
          <ul className="divide-y divide-border/30">
            {rows.map((r) => (
              <li key={r.signature}>
                <RecentRow r={r} explorer={chain.explorer} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RecentRow({ r, explorer }: { r: EnrichedTxRecord; explorer: string }) {
  const isBuy = r.type === 'buy';
  const isSell = r.type === 'sell';
  const Icon = isBuy ? ArrowDownRight : isSell ? ArrowUpRight : null;
  const tone = isBuy ? 'text-emerald-500' : isSell ? 'text-red-500' : 'text-muted-foreground';
  const symbol = r.tokenSymbol || (r.tokenMint ? r.tokenMint.slice(0, 4) : 'SOL');
  return (
    <Link
      href="/history"
      className="grid grid-cols-[16px_minmax(0,1fr)_auto_16px] items-center gap-2 py-1.5 px-1 -mx-1 rounded text-xs hover:bg-muted/40 transition-colors"
    >
      {Icon ? <Icon className={`h-3 w-3 ${tone} flex-shrink-0`} /> : <span className="h-3 w-3" />}
      <span className={`truncate ${tone}`}>{symbol}</span>
      <span className="font-mono tabular-nums text-foreground whitespace-nowrap">
        {formatSol(r.solAmount)} SOL
      </span>
      <a
        href={`${explorer}/tx/${r.signature}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        aria-label="explorer"
        className="text-muted-foreground/60 hover:text-foreground"
      >
        <ExternalLink className="h-3 w-3" />
      </a>
    </Link>
  );
}

function formatSol(n: number): string {
  if (!n || !Number.isFinite(n)) return '0';
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}
