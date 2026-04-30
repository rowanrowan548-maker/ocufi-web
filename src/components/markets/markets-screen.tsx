'use client';

/**
 * T-MARKETS-PAGE-V1 · /markets · 6 tab + 风险标 + 60s 刷新
 *
 * Tab:
 *  - trending     · 热门(GT trending 24h)
 *  - new          · 新发(GT new pairs)
 *  - gainers1h    · 1h 涨幅榜(trending sort by change1h desc)
 *  - losers24h    · 24h 跌幅榜(trending sort by change24h asc)
 *  - verified     · 已审代币(过滤 isVerifiedToken)
 *  - risk         · 风险预警(audit-card 报蜜罐 / 高风险 · 行级 lazy load)
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  Loader2, Flame, Sparkles, TrendingUp, TrendingDown, BadgeCheck, AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  fetchMarketsTrending,
  fetchMarketsNewPairs,
  type MarketItem,
} from '@/lib/api-client';
import { isVerifiedToken } from '@/lib/verified-tokens';
import { MarketsTable } from './markets-table';

type TabKey = 'trending' | 'new' | 'gainers1h' | 'losers24h' | 'verified' | 'risk';

const TABS: TabKey[] = ['trending', 'new', 'gainers1h', 'losers24h', 'verified', 'risk'];
const TAB_ICONS: Record<TabKey, LucideIcon> = {
  trending: Flame,
  new: Sparkles,
  gainers1h: TrendingUp,
  losers24h: TrendingDown,
  verified: BadgeCheck,
  risk: AlertTriangle,
};
const REFRESH_MS = 60_000;

export function MarketsScreen() {
  const t = useTranslations('markets');
  const [tab, setTab] = useState<TabKey>('trending');
  const [items, setItems] = useState<MarketItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function load() {
      setLoading(true);
      try {
        let raw: MarketItem[] = [];
        if (tab === 'new') {
          raw = await fetchMarketsNewPairs(50);
        } else {
          raw = await fetchMarketsTrending('24h', 100);
        }
        if (cancelled) return;
        const filtered = applyTab(raw, tab);
        setItems(filtered);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    timer = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; if (timer) clearInterval(timer); };
  }, [tab]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('subtitle')}</p>
      </div>

      {/* Tabs · T-REWARDS-POLISH:emoji 换 Lucide */}
      <div className="flex flex-wrap gap-1 border-b border-border/40 pb-2">
        {TABS.map((k) => {
          const Icon = TAB_ICONS[k];
          return (
            <button
              key={k}
              type="button"
              data-testid={`markets-tab-${k}`}
              onClick={() => setTab(k)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors ${
                tab === k
                  ? 'bg-[var(--brand-up)]/15 text-[var(--brand-up)] font-medium'
                  : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t(`tabs.${k}`)}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <Card>
        <CardContent className="p-0">
          {loading && !items ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('loading')}
            </div>
          ) : !items || items.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground/60 text-sm">
              {t('empty')}
              <div className="mt-2">
                <Link href="/trade" className="text-xs text-[var(--brand-up)] hover:underline">
                  {t('goTrade')}
                </Link>
              </div>
            </div>
          ) : (
            <MarketsTable items={items} showRisk={tab === 'risk' || tab === 'verified'} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function applyTab(raw: MarketItem[], tab: TabKey): MarketItem[] {
  const list = [...raw];
  switch (tab) {
    case 'trending':
    case 'new':
      return list.slice(0, 50);
    case 'gainers1h':
      return list
        .filter((x) => Number.isFinite(x.change1h))
        .sort((a, b) => (b.change1h ?? 0) - (a.change1h ?? 0))
        .slice(0, 50);
    case 'losers24h':
      return list
        .filter((x) => Number.isFinite(x.change24h))
        .sort((a, b) => (a.change24h ?? 0) - (b.change24h ?? 0))
        .slice(0, 50);
    case 'verified':
      return list.filter((x) => isVerifiedToken(x.mint)).slice(0, 50);
    case 'risk':
      // V1:占位 · 实际 risk 过滤需 audit-card 行级懒加载
      // 这里先返流动性低 + 24h 量小的(粗糙信号)
      return list
        .filter((x) => (x.liquidityUsd ?? 0) < 50_000 || (x.holdersCount ?? 999) < 100)
        .slice(0, 50);
    default:
      return list.slice(0, 50);
  }
}
