'use client';

/**
 * Landing 页 · 行情列表(T-956 GMGN 风格升级)
 *
 * tabs: 🔥 Trending(子 tab 5m/15m/1h/24h)/ 🆕 New Pairs / ⭐ 自选 / 📈 主流
 * 列:Token / Price / 5m / 1h / 24h / Liq+MC / Vol+Age / Buy/Sell / ⚡
 *
 * #25 删 ShoppingCart icon → Zap ⚡
 * #26 行内 0.1 SOL ⚡ 快买(QuickBuyConfirm)
 * #27 SOL/USDC 默认隐藏 toggle
 *
 * 后端来源:
 *  - /markets/trending?timeframe=5m|15m|1h|24h(60s 缓存)
 *  - /markets/new-pairs(30s 缓存)
 *  - 自选 / 主流:本地 fetchTokensInfoBatch DexScreener
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  TrendingUp, TrendingDown, Star, Zap, Flame, Sparkles, BarChart3,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchTokensInfoBatch, type TokenInfo } from '@/lib/portfolio';
import { SkeletonRow } from '@/components/ui/skeleton';
import { PRESET_MAJORS, SOL_MINT, USDC_MINT } from '@/lib/preset-tokens';
import { useFavorites } from '@/lib/favorites';
import {
  fetchMarketsTrending, fetchMarketsNewPairs, isApiConfigured,
  type MarketItem, type MarketsTimeframe,
} from '@/lib/api-client';
import { QuickBuyConfirm } from '@/components/trade/quick-buy-confirm';

type Tab = 'trending' | 'newpairs' | 'fav' | 'major';
const TIMEFRAMES: MarketsTimeframe[] = ['5m', '15m', '1h', '24h'];

const HIDE_KEY = 'ocufi.markets.hideMajors';

/** 把 TokenInfo 转成 MarketItem 形态(自选/主流 tab 用) */
function infoToMarket(info: TokenInfo): MarketItem {
  return {
    mint: info.mint,
    symbol: info.symbol,
    name: info.name,
    logo: info.logoUri ?? null,
    priceUsd: info.priceUsd ?? null,
    change5m: info.priceChange5m ?? null,
    change1h: info.priceChange1h ?? null,
    change24h: info.priceChange24h ?? null,
    liquidityUsd: info.liquidityUsd ?? null,
    marketCapUsd: info.marketCap ?? null,
    fdvUsd: null,
    volumeH24: info.volume24h ?? null,
    ageHours: info.pairCreatedAt ? (Date.now() - info.pairCreatedAt) / 3.6e6 : null,
    buys24h: null,
    sells24h: null,
    holdersCount: null,
    topPoolAddress: info.topPoolAddress ?? null,
  };
}

export function TokenList() {
  const t = useTranslations('markets');
  const wallet = useWallet();
  const [tab, setTab] = useState<Tab>('trending');
  const [tf, setTf] = useState<MarketsTimeframe>('1h');
  const [hideMajors, setHideMajors] = useState(false); // #27 SOL/USDC toggle
  const [trendingItems, setTrendingItems] = useState<MarketItem[]>([]);
  const [newPairsItems, setNewPairsItems] = useState<MarketItem[]>([]);
  const [presetItems, setPresetItems] = useState<MarketItem[]>([]);
  const [favItems, setFavItems] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(false);

  const { favorites, isFavorite, toggle } = useFavorites();

  // 持久 hideMajors
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const v = window.localStorage.getItem(HIDE_KEY);
      if (v === '1') setHideMajors(true);
    } catch { /* */ }
  }, []);
  function toggleHideMajors() {
    setHideMajors((p) => {
      const next = !p;
      try { window.localStorage.setItem(HIDE_KEY, next ? '1' : '0'); } catch { /* */ }
      return next;
    });
  }

  // 拉 trending(timeframe 切换重拉)
  useEffect(() => {
    if (tab !== 'trending' || !isApiConfigured()) return;
    let cancelled = false;
    setLoading(true);
    fetchMarketsTrending(tf, 50)
      .then((items) => { if (!cancelled) setTrendingItems(items); })
      .catch(() => { if (!cancelled) setTrendingItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tab, tf]);

  // 拉 new pairs
  useEffect(() => {
    if (tab !== 'newpairs' || !isApiConfigured()) return;
    let cancelled = false;
    setLoading(true);
    fetchMarketsNewPairs(50)
      .then((items) => { if (!cancelled) setNewPairsItems(items); })
      .catch(() => { if (!cancelled) setNewPairsItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tab]);

  // 主流 + 自选 走 DexScreener 批量
  useEffect(() => {
    if (tab !== 'major') return;
    let cancelled = false;
    setLoading(true);
    fetchTokensInfoBatch(PRESET_MAJORS).then((map) => {
      if (cancelled) return;
      setPresetItems(PRESET_MAJORS.map((m) => map.get(m)).filter((x): x is TokenInfo => !!x).map(infoToMarket));
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tab]);

  useEffect(() => {
    if (tab !== 'fav' || favorites.length === 0) {
      if (tab === 'fav') setFavItems([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchTokensInfoBatch(favorites).then((map) => {
      if (cancelled) return;
      setFavItems(favorites.map((m) => map.get(m)).filter((x): x is TokenInfo => !!x).map(infoToMarket));
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tab, favorites]);

  const rows = useMemo(() => {
    let src: MarketItem[];
    switch (tab) {
      case 'trending': src = trendingItems; break;
      case 'newpairs': src = newPairsItems; break;
      case 'fav': src = favItems; break;
      case 'major': src = presetItems; break;
    }
    if (hideMajors) {
      src = src.filter((it) => it.mint !== SOL_MINT && it.mint !== USDC_MINT);
    }
    return src;
  }, [tab, trendingItems, newPairsItems, favItems, presetItems, hideMajors]);

  // T-956 #26 · 快买 dialog
  const [quickBuyOpen, setQuickBuyOpen] = useState(false);
  const [quickBuyMint, setQuickBuyMint] = useState<string | null>(null);
  const [quickBuySymbol, setQuickBuySymbol] = useState<string | undefined>(undefined);

  function openQuickBuy(mint: string, symbol?: string) {
    setQuickBuyMint(mint);
    setQuickBuySymbol(symbol);
    setQuickBuyOpen(true);
  }

  return (
    <section className="px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight font-heading">
              {t('title')}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">{t('subtitle')}</p>
          </div>
          <Tabs value={tab} onValueChange={(v) => v && setTab(v as Tab)}>
            <TabsList>
              <TabsTrigger value="trending">
                <Flame className="h-3 w-3 mr-1" />
                {t('tabs.trending')}
              </TabsTrigger>
              <TabsTrigger value="newpairs">
                <Sparkles className="h-3 w-3 mr-1" />
                {t('tabs.newpairs')}
              </TabsTrigger>
              <TabsTrigger value="fav">
                <Star className="h-3 w-3 mr-1" />
                {t('tabs.fav')}{favorites.length > 0 ? ` ${favorites.length}` : ''}
              </TabsTrigger>
              <TabsTrigger value="major">
                <BarChart3 className="h-3 w-3 mr-1" />
                {t('tabs.major')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* trending 子 tab + #27 hide majors toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          {tab === 'trending' ? (
            <Tabs value={tf} onValueChange={(v) => v && setTf(v as MarketsTimeframe)}>
              <TabsList>
                {TIMEFRAMES.map((f) => (
                  <TabsTrigger key={f} value={f}>{f}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : <div />}
          <button
            type="button"
            onClick={toggleHideMajors}
            className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
              hideMajors
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border/40 text-muted-foreground hover:text-foreground'
            }`}
          >
            {hideMajors ? t('hideMajorsOn') : t('hideMajorsOff')}
          </button>
        </div>

        {/* 桌面 / 平板:表格 */}
        <Card className="overflow-x-auto hidden sm:block">
          <Table className="min-w-[1100px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>{t('cols.token')}</TableHead>
                <TableHead className="text-right">{t('cols.price')}</TableHead>
                <TableHead className="text-right">5m</TableHead>
                <TableHead className="text-right">1h</TableHead>
                <TableHead className="text-right">24h</TableHead>
                <TableHead className="text-right hidden md:table-cell">{t('cols.liqMcap')}</TableHead>
                <TableHead className="text-right hidden lg:table-cell">{t('cols.volAge')}</TableHead>
                <TableHead className="text-right hidden lg:table-cell">{t('cols.buySell')}</TableHead>
                <TableHead className="text-right">{t('cols.action')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={10} className="px-3">
                        <SkeletonRow cols={5} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="h-20 text-center text-muted-foreground text-xs">
                      {tab === 'fav' ? t('emptyFav') : t('empty')}
                    </TableCell>
                  </TableRow>
                )
              ) : rows.map((it) => (
                <Row
                  key={it.mint}
                  it={it}
                  starred={isFavorite(it.mint)}
                  onToggleStar={() => toggle(it.mint)}
                  onQuickBuy={() => {
                    if (!wallet.connected) return;
                    openQuickBuy(it.mint, it.symbol);
                  }}
                  walletConnected={wallet.connected}
                  t={t}
                />
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* 移动端卡片 */}
        <div className="sm:hidden space-y-2">
          {rows.length === 0 ? (
            loading ? (
              <Card className="p-3">
                <SkeletonRow cols={3} />
              </Card>
            ) : (
              <Card className="p-6 text-center text-xs text-muted-foreground">
                {tab === 'fav' ? t('emptyFav') : t('empty')}
              </Card>
            )
          ) : rows.map((it) => (
            <MobileCard
              key={it.mint}
              it={it}
              starred={isFavorite(it.mint)}
              onToggleStar={() => toggle(it.mint)}
              onQuickBuy={() => {
                if (!wallet.connected) return;
                openQuickBuy(it.mint, it.symbol);
              }}
              walletConnected={wallet.connected}
              t={t}
            />
          ))}
        </div>
      </div>

      {/* T-956 #26 · 快买 dialog */}
      {quickBuyMint && (
        <QuickBuyConfirm
          open={quickBuyOpen}
          onOpenChange={(v) => {
            setQuickBuyOpen(v);
            if (!v) {
              setQuickBuyMint(null);
              setQuickBuySymbol(undefined);
            }
          }}
          mint={quickBuyMint}
          symbol={quickBuySymbol}
        />
      )}
    </section>
  );
}

function ChangePill({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-xs text-muted-foreground/50">—</span>;
  const up = pct > 0;
  const down = pct < 0;
  const color = up ? 'text-success' : down ? 'text-danger' : 'text-muted-foreground';
  const Icon = up ? TrendingUp : down ? TrendingDown : null;
  return (
    <span className={`text-xs font-mono inline-flex items-center gap-0.5 justify-end ${color}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {up ? '+' : ''}{pct.toFixed(2)}%
    </span>
  );
}

function Row({
  it, starred, onToggleStar, onQuickBuy, walletConnected, t,
}: {
  it: MarketItem;
  starred: boolean;
  onToggleStar: () => void;
  onQuickBuy: () => void;
  walletConnected: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <TableRow className="hover:bg-muted/30 transition-colors">
      <TableCell className="pr-0">
        <button
          type="button"
          onClick={onToggleStar}
          aria-label={starred ? 'Remove favorite' : 'Add favorite'}
          className="p-1 hover:bg-muted/40 rounded transition-colors"
        >
          <Star className={`h-4 w-4 ${starred ? 'fill-warning text-warning' : 'text-muted-foreground/40'}`} />
        </button>
      </TableCell>
      <TableCell>
        <Link href={`/trade?mint=${it.mint}`} className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
            {it.logo ? (
              <Image src={it.logo} alt={it.symbol} width={32} height={32} className="object-cover" unoptimized />
            ) : (
              <span className="text-[10px] font-bold text-muted-foreground">
                {it.symbol.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{it.symbol}</div>
            {it.name && it.name !== it.symbol && (
              <div className="text-[10px] text-muted-foreground truncate max-w-[140px]">{it.name}</div>
            )}
          </div>
        </Link>
      </TableCell>
      <TableCell className="text-right font-mono text-sm whitespace-nowrap">
        {it.priceUsd ? `$${formatPrice(it.priceUsd)}` : '—'}
      </TableCell>
      <TableCell className="text-right">
        <ChangePill pct={it.change5m} />
      </TableCell>
      <TableCell className="text-right">
        <ChangePill pct={it.change1h} />
      </TableCell>
      <TableCell className="text-right">
        <ChangePill pct={it.change24h} />
      </TableCell>
      <TableCell className="text-right font-mono text-[11px] text-muted-foreground hidden md:table-cell whitespace-nowrap">
        <div>{it.liquidityUsd ? `$${formatCompact(it.liquidityUsd)}` : '—'}</div>
        <div className="text-muted-foreground/60">
          MC {it.marketCapUsd ? `$${formatCompact(it.marketCapUsd)}` : '—'}
        </div>
      </TableCell>
      <TableCell className="text-right font-mono text-[11px] text-muted-foreground hidden lg:table-cell whitespace-nowrap">
        <div>{it.volumeH24 ? `$${formatCompact(it.volumeH24)}` : '—'}</div>
        <div className="text-muted-foreground/60">{formatAge(it.ageHours)}</div>
      </TableCell>
      <TableCell className="text-right font-mono text-[11px] text-muted-foreground hidden lg:table-cell whitespace-nowrap">
        {it.buys24h != null || it.sells24h != null ? (
          <span>
            <span className="text-success">{it.buys24h ?? 0}</span>
            {' / '}
            <span className="text-danger">{it.sells24h ?? 0}</span>
          </span>
        ) : '—'}
      </TableCell>
      <TableCell className="text-right">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-success hover:bg-success/10"
          onClick={onQuickBuy}
          disabled={!walletConnected}
          title={walletConnected ? t('actions.quickBuyTitle') : t('actions.quickBuyConnectFirst')}
        >
          <Zap className="h-3 w-3 mr-0.5" />
          <span className="text-[10px] font-mono">0.1</span>
        </Button>
      </TableCell>
    </TableRow>
  );
}

function MobileCard({
  it, starred, onToggleStar, onQuickBuy, walletConnected, t,
}: {
  it: MarketItem;
  starred: boolean;
  onToggleStar: () => void;
  onQuickBuy: () => void;
  walletConnected: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleStar}
          aria-label={starred ? 'Remove favorite' : 'Add favorite'}
          className="h-11 w-11 -m-3 flex items-center justify-center hover:bg-muted/40 rounded transition-colors flex-shrink-0"
        >
          <Star className={`h-4 w-4 ${starred ? 'fill-warning text-warning' : 'text-muted-foreground/40'}`} />
        </button>

        <Link href={`/trade?mint=${it.mint}`} className="flex items-center gap-2 flex-1 min-w-0">
          <div className="h-9 w-9 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
            {it.logo ? (
              <Image src={it.logo} alt={it.symbol} width={36} height={36} className="object-cover" unoptimized />
            ) : (
              <span className="text-[10px] font-bold text-muted-foreground">
                {it.symbol.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{it.symbol}</div>
            <div className="text-[10px] font-mono text-muted-foreground/60 truncate">
              LP ${formatCompact(it.liquidityUsd ?? 0)} · MC ${formatCompact(it.marketCapUsd ?? 0)} · {formatAge(it.ageHours)}
            </div>
          </div>
        </Link>

        <div className="text-right flex-shrink-0">
          <div className="text-sm font-mono font-semibold">
            {it.priceUsd ? `$${formatPrice(it.priceUsd)}` : '—'}
          </div>
          <ChangePill pct={it.change24h} />
        </div>

        <button
          type="button"
          onClick={onQuickBuy}
          aria-label="Quick buy 0.1 SOL"
          disabled={!walletConnected}
          className="h-11 w-11 -m-3 ml-0 flex items-center justify-center text-success hover:bg-success/10 disabled:opacity-40 rounded transition-colors flex-shrink-0"
          title={walletConnected ? t('actions.quickBuyTitle') : t('actions.quickBuyConnectFirst')}
        >
          <Zap className="h-4 w-4" />
        </button>
      </div>

      {/* 5m / 1h / 24h 三档 */}
      <div className="mt-2 flex items-center justify-end gap-3 text-[10px] font-mono">
        <span className="text-muted-foreground/60">5m <ChangePill pct={it.change5m} /></span>
        <span className="text-muted-foreground/60">1h <ChangePill pct={it.change1h} /></span>
        <span className="text-muted-foreground/60">24h <ChangePill pct={it.change24h} /></span>
      </div>
    </Card>
  );
}

function formatPrice(n: number): string {
  if (!n) return '—';
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  if (n >= 0.0001) return n.toFixed(6);
  const fixed = n.toFixed(20);
  const m = fixed.match(/^0\.(0+)(\d+)/);
  if (!m) return n.toPrecision(3);
  const lead = m[1].length;
  if (lead < 4) return `0.${m[1]}${m[2].slice(0, 4)}`;
  const subs = '₀₁₂₃₄₅₆₇₈₉';
  return `0.0${String(lead).split('').map((d) => subs[+d]).join('')}${m[2].slice(0, 4)}`;
}

function formatCompact(n: number): string {
  if (!n || !Number.isFinite(n)) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toFixed(0);
}

function formatAge(hours: number | null): string {
  if (hours == null) return '—';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  if (hours < 24 * 30) return `${(hours / 24).toFixed(0)}d`;
  return `${(hours / (24 * 30)).toFixed(0)}mo`;
}
