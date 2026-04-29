'use client';

/**
 * T-OKX-4C-fe · GMGN 风子 tab 行 · 按地址标签筛选 trades
 *
 * 后端: GET /trades/by-tag?pool=&tag=&limit= (T-OKX-4C-be a668538)
 *
 * 行为:
 *  - 主 tab "交易活动" 内,表格上方加 ToggleGroup 12 选 1
 *  - 默认 'all' → 用 GT trades(parent 提供)
 *  - 选其他 tag → fetch by-tag 数据,加"标签"列
 *  - 桌面 lg+ 显 · 移动不显(sub tab 占空间)
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowUpRight, ArrowDownLeft, ExternalLink, Loader2 } from 'lucide-react';
import {
  fetchTradesByTag,
  isApiConfigured,
  type TradeTag,
  type TradeByTagItem,
} from '@/lib/api-client';
import type { GTTrade } from '@/lib/geckoterminal';
import { fetchTokenInfo } from '@/lib/portfolio';

const TAGS: TradeTag[] = [
  'all', 'kol', 'rat', 'whale', 'sniper', 'phishing',
  'smart_money', 'dev', 'top10', 'new_wallet', 'bundler',
];

interface Props {
  mint?: string;
  gtTrades: GTTrade[] | null;
  gtLoading: boolean;
  explorer: string;
}

export function TradesTagFilter({ mint, gtTrades, gtLoading, explorer }: Props) {
  const t = useTranslations('trade.activity');
  const tTag = useTranslations('trade.activity.tags');
  const [activeTag, setActiveTag] = useState<TradeTag>('all');
  const [pool, setPool] = useState<string | null>(null);
  const [byTagItems, setByTagItems] = useState<TradeByTagItem[] | null>(null);
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

  // tag !== 'all' → fetch /trades/by-tag
  useEffect(() => {
    if (activeTag === 'all' || !pool || !isApiConfigured()) {
      setByTagItems(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchTradesByTag(pool, activeTag, 100)
      .then((r) => { if (!cancelled) setByTagItems(r.items ?? []); })
      .catch(() => { if (!cancelled) setByTagItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeTag, pool]);

  return (
    <div className="space-y-2">
      {/* T-OKX-4C-fe · 子 tab 行 · 12 选 1(GMGN 风) */}
      <div className="hidden lg:flex flex-wrap gap-1 pb-2 border-b border-border/40">
        {TAGS.map((tag) => {
          const active = activeTag === tag;
          return (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(tag)}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
              }`}
            >
              {tTag(tag)}
            </button>
          );
        })}
      </div>

      {/* 表格内容 · all 用 GT,其他用 by-tag */}
      {activeTag === 'all'
        ? <AllTradesTable trades={gtTrades} loading={gtLoading} explorer={explorer} t={t} />
        : <TaggedTradesTable items={byTagItems} loading={loading} explorer={explorer} t={t} tTag={tTag} />}
    </div>
  );
}

type T = ReturnType<typeof useTranslations>;

function AllTradesTable({
  trades, loading, explorer, t,
}: { trades: GTTrade[] | null; loading: boolean; explorer: string; t: T }) {
  if (loading && !trades) {
    return <div className="text-center py-6 text-muted-foreground/60 text-xs"><Loader2 className="inline h-3 w-3 animate-spin mr-1" />{t('loading')}</div>;
  }
  if (!trades || trades.length === 0) {
    return <div className="text-center py-6 text-muted-foreground/60 text-xs">{t('noActivity.title')}</div>;
  }
  return (
    <div className="text-xs">
      <div className="grid grid-cols-[60px_1fr_1fr_50px] gap-2 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">
        <span>{t('cols.side')}</span>
        <span className="text-right">{t('cols.usd')}</span>
        <span>{t('cols.maker')}</span>
        <span className="text-right">{t('cols.time')}</span>
      </div>
      <div className="max-h-[480px] overflow-y-auto">
        {trades.slice(0, 100).map((tr) => (
          <a
            key={tr.txSignature}
            href={`${explorer}/tx/${tr.txSignature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="grid grid-cols-[60px_1fr_1fr_50px] gap-2 px-2 py-1 text-xs hover:bg-muted/30 transition-colors items-center"
          >
            <span className={`inline-flex items-center gap-0.5 ${tr.kind === 'buy' ? 'text-success' : 'text-danger'}`}>
              {tr.kind === 'buy' ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
              {tr.kind}
            </span>
            <span className="font-mono tabular-nums text-right">${tr.usdValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
            <span className="font-mono text-[10px] text-muted-foreground truncate">{tr.fromAddress.slice(0, 4)}…{tr.fromAddress.slice(-4)}</span>
            <span className="text-[10px] text-muted-foreground/60 text-right">{formatAge(tr.blockTimestampMs)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function TaggedTradesTable({
  items, loading, explorer, t, tTag,
}: { items: TradeByTagItem[] | null; loading: boolean; explorer: string; t: T; tTag: T }) {
  if (loading && !items) {
    return <div className="text-center py-6 text-muted-foreground/60 text-xs"><Loader2 className="inline h-3 w-3 animate-spin mr-1" />{t('loading')}</div>;
  }
  if (!items || items.length === 0) {
    return <div className="text-center py-6 text-muted-foreground/60 text-xs">{t('noTaggedTrades')}</div>;
  }
  return (
    <div className="text-xs">
      <div className="grid grid-cols-[60px_1fr_1fr_1fr_50px] gap-2 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">
        <span>{t('cols.side')}</span>
        <span className="text-right">{t('cols.usd')}</span>
        <span>{t('cols.maker')}</span>
        <span>{t('cols.tags')}</span>
        <span className="text-right">{t('cols.time')}</span>
      </div>
      <div className="max-h-[480px] overflow-y-auto">
        {items.slice(0, 100).map((it) => (
          <a
            key={it.tx_signature}
            href={`${explorer}/tx/${it.tx_signature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="grid grid-cols-[60px_1fr_1fr_1fr_50px] gap-2 px-2 py-1 text-xs hover:bg-muted/30 transition-colors items-center"
          >
            <span className={`inline-flex items-center gap-0.5 ${it.kind === 'buy' ? 'text-success' : 'text-danger'}`}>
              {it.kind === 'buy' ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
              {it.kind}
            </span>
            <span className="font-mono tabular-nums text-right">${it.usd_value.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
            <span className="font-mono text-[10px] text-muted-foreground truncate">{it.from_address.slice(0, 4)}…{it.from_address.slice(-4)}</span>
            <span className="flex flex-wrap gap-0.5 min-w-0">
              {(it.tags ?? []).slice(0, 2).map((tg) => (
                <span
                  key={tg}
                  className={`px-1 py-0 rounded text-[9px] ${tagBadgeClass(tg)}`}
                >
                  {tTag(tg)}
                </span>
              ))}
            </span>
            <span className="text-[10px] text-muted-foreground/60 text-right">{formatAge(it.block_time_ms)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function tagBadgeClass(tag: TradeTag): string {
  switch (tag) {
    case 'kol': return 'bg-purple-500/15 text-purple-500';
    case 'rat': return 'bg-amber-500/15 text-amber-500';
    case 'whale': return 'bg-blue-500/15 text-blue-500';
    case 'sniper': return 'bg-orange-500/15 text-orange-500';
    case 'phishing': return 'bg-red-500/15 text-red-500';
    case 'smart_money': return 'bg-emerald-500/15 text-emerald-500';
    case 'dev': return 'bg-cyan-500/15 text-cyan-500';
    case 'top10': return 'bg-yellow-500/15 text-yellow-600';
    case 'new_wallet': return 'bg-pink-500/15 text-pink-500';
    case 'bundler': return 'bg-fuchsia-500/15 text-fuchsia-500';
    default: return 'bg-muted text-muted-foreground';
  }
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
