'use client';

/**
 * 自选页 · 单独路由 /watchlist
 *
 * T-942 升级:
 *  - #53 加成本/浮盈亏列(用 useCostBasis join)
 *  - #54 操作列改 0.1 SOL ⚡快买 + 卖出链接
 *  - #55 subtitle "{count} / 50"
 *  - #56 顶部"上一笔交易"banner(notification-store 持久)
 *  - #58 顶部 portfolio 总值卡缩略(链上 SOL 余额 + 可见持仓估值)
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  TrendingUp, TrendingDown, Star, Search, Zap, ArrowUpFromLine,
  ArrowDownToLine, ArrowUpFromLine as SellIcon, Wallet, ExternalLink,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { fetchTokenInfo, fetchSolUsdPrice, type TokenInfo } from '@/lib/portfolio';
import { useFavorites, MAX_FAVORITES } from '@/lib/favorites';
import { useCostBasis } from '@/hooks/use-cost-basis';
import { useTradeNotifications } from '@/lib/notification-store';
import { QuickBuyConfirm } from '@/components/trade/quick-buy-confirm';
import { SkeletonRow } from '@/components/ui/skeleton';
import { getCurrentChain } from '@/config/chains';

const QUICK_BUY_SOL = 0.1;

export function WatchlistScreen() {
  const t = useTranslations('watchlist');
  const router = useRouter();
  const wallet = useWallet();
  const { connection } = useConnection();
  const { favorites, toggle } = useFavorites();
  const { costs } = useCostBasis();
  const lastTrade = useTradeNotifications((s) => s.list[0]);
  const chain = getCurrentChain();

  const [infos, setInfos] = useState<Map<string, TokenInfo>>(new Map());
  const [loading, setLoading] = useState(false);
  const [solUsd, setSolUsd] = useState<number>(0);
  const [solBalance, setSolBalance] = useState<number | null>(null);

  // T-942 #54 · 快速买入 dialog 状态
  const [quickBuyOpen, setQuickBuyOpen] = useState(false);
  const [quickBuyMint, setQuickBuyMint] = useState<string | null>(null);
  const [quickBuySymbol, setQuickBuySymbol] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (favorites.length === 0) {
      setInfos(new Map());
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all(favorites.map((m) => fetchTokenInfo(m)))
      .then((arr) => {
        if (cancelled) return;
        const next = new Map<string, TokenInfo>();
        arr.forEach((info, i) => { if (info) next.set(favorites[i], info); });
        setInfos(next);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [favorites]);

  // SOL 美元价 + 钱包 SOL 余额(给顶部 portfolio 缩略卡用)
  useEffect(() => {
    fetchSolUsdPrice().then(setSolUsd).catch(() => setSolUsd(0));
  }, []);
  useEffect(() => {
    if (!wallet.publicKey) { setSolBalance(null); return; }
    let cancelled = false;
    connection.getBalance(wallet.publicKey)
      .then((lamports) => { if (!cancelled) setSolBalance(lamports / LAMPORTS_PER_SOL); })
      .catch(() => { if (!cancelled) setSolBalance(null); });
    return () => { cancelled = true; };
  }, [wallet.publicKey, connection]);

  const rows = useMemo(() => {
    return favorites
      .map((m) => infos.get(m))
      .filter((info): info is TokenInfo => !!info);
  }, [favorites, infos]);

  // T-942 #58 · 自选估值汇总(只算有持仓 + 当前价的代币)
  const watchedHoldingsUsd = useMemo(() => {
    let sum = 0;
    for (const info of rows) {
      const cost = costs.get(info.mint);
      if (!cost || cost.derivedBalance <= 0) continue;
      sum += cost.derivedBalance * info.priceUsd;
    }
    return sum;
  }, [rows, costs]);

  function openQuickBuy(mint: string, symbol?: string) {
    if (!wallet.connected) {
      router.push(`/trade?mint=${mint}&side=buy`);
      return;
    }
    setQuickBuyMint(mint);
    setQuickBuySymbol(symbol);
    setQuickBuyOpen(true);
  }

  return (
    <main className="flex flex-1 flex-col">
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-5">
        <header>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading">
            {t('page.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {/* T-942 #55 · {count} / 50 */}
            {t('page.subtitleCapped', { count: favorites.length, max: MAX_FAVORITES })}
          </p>
        </header>

        {/* T-942 #58 · portfolio 缩略卡 + #56 上一笔交易 banner */}
        {wallet.connected && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Wallet className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t('summary.portfolio')}
                  </div>
                  <div className="text-base font-semibold font-mono tabular-nums">
                    {solBalance != null ? (
                      <>
                        {solBalance.toFixed(3)} SOL
                        {solUsd > 0 && (
                          <span className="text-xs text-muted-foreground font-normal ml-2">
                            ≈ ${(solBalance * solUsd + watchedHoldingsUsd).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </>
                    ) : '—'}
                  </div>
                </div>
                <Link href="/portfolio" className="text-xs text-primary hover:underline flex-shrink-0">
                  {t('summary.viewAll')} →
                </Link>
              </CardContent>
            </Card>

            {lastTrade ? (
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                    lastTrade.side === 'buy' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                  }`}>
                    {lastTrade.side === 'buy' ? <ArrowDownToLine className="h-4 w-4" /> : <SellIcon className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {t(`summary.lastTrade.${lastTrade.side}`)} · {formatRelativeTime(lastTrade.createdAt)}
                    </div>
                    <div className="text-sm font-medium truncate">
                      {lastTrade.symbol} · {lastTrade.amountSol.toFixed(4)} SOL
                    </div>
                  </div>
                  <a
                    href={`${chain.explorer}/tx/${lastTrade.signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                    aria-label="Solscan"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <Star className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {t('summary.lastTrade.empty.label')}
                    </div>
                    <div className="text-xs text-muted-foreground/70 truncate">
                      {t('summary.lastTrade.empty.hint')}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {favorites.length === 0 ? (
          <Card className="p-10 sm:p-14 flex flex-col items-center text-center gap-4">
            <div className="h-16 w-16 rounded-full bg-warning/10 flex items-center justify-center">
              <Star className="h-8 w-8 text-warning/70" />
            </div>
            <div className="space-y-1">
              <div className="text-base font-semibold">{t('empty.title')}</div>
              <div className="text-sm text-muted-foreground max-w-sm">
                {t('empty.subtitle')}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap justify-center pt-2">
              <Link href="/">
                <Button size="sm" variant="outline">
                  <Search className="h-4 w-4 mr-2" />
                  {t('empty.browseTokens')}
                </Button>
              </Link>
              <Link href="/trade">
                <Button size="sm">
                  {t('empty.goTrade')}
                </Button>
              </Link>
            </div>
          </Card>
        ) : loading && rows.length === 0 ? (
          <Card className="p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonRow key={i} cols={4} />
            ))}
          </Card>
        ) : (
          <Card className="overflow-x-auto">
            <Table className="min-w-[820px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>{t('cols.name')}</TableHead>
                  <TableHead className="text-right">{t('cols.price')}</TableHead>
                  <TableHead className="text-right">{t('cols.change')}</TableHead>
                  {/* T-942 #53 · 成本 + 浮盈亏 */}
                  <TableHead className="text-right hidden md:table-cell">{t('cols.costBasis')}</TableHead>
                  <TableHead className="text-right">{t('cols.unrealized')}</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">
                    {t('cols.volume')}
                  </TableHead>
                  <TableHead className="text-right">{t('cols.action')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((tok) => (
                  <Row
                    key={tok.mint}
                    tok={tok}
                    cost={costs.get(tok.mint)}
                    solUsd={solUsd}
                    onUnstar={() => toggle(tok.mint)}
                    onQuickBuy={() => openQuickBuy(tok.mint, tok.symbol)}
                    t={t}
                  />
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* T-942 #54 · 快速买入 dialog · 复用 mobile-action-bar 同款 */}
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
    </main>
  );
}

function Row({
  tok, cost, solUsd, onUnstar, onQuickBuy, t,
}: {
  tok: TokenInfo;
  cost: ReturnType<typeof useCostBasis>['costs'] extends Map<string, infer V> ? V | undefined : never;
  solUsd: number;
  onUnstar: () => void;
  onQuickBuy: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const change = tok.priceChange24h;
  const up = change != null && change > 0;
  const down = change != null && change < 0;
  const ChangeIcon = up ? TrendingUp : down ? TrendingDown : null;
  const color = up ? 'text-success' : down ? 'text-danger' : 'text-muted-foreground';

  // T-942 #53 · 浮盈亏(只在持仓 > 0 + 有成本 + 有价时算)
  const hasPosition = !!cost && cost.derivedBalance > 0 && cost.avgCostSol > 0 && solUsd > 0;
  const costUsd = hasPosition ? cost.avgCostSol * cost.derivedBalance * solUsd : 0;
  const valueUsd = hasPosition ? tok.priceUsd * cost.derivedBalance : 0;
  const unrealizedUsd = hasPosition ? valueUsd - costUsd : 0;
  const unrealizedPct = hasPosition && costUsd > 0 ? (unrealizedUsd / costUsd) * 100 : 0;

  return (
    <TableRow className="hover:bg-muted/30 transition-colors">
      <TableCell className="pr-0">
        <button
          type="button"
          onClick={onUnstar}
          aria-label="Remove from watchlist"
          className="p-1 hover:bg-muted/40 rounded transition-colors"
        >
          <Star className="h-4 w-4 fill-warning text-warning" />
        </button>
      </TableCell>
      <TableCell>
        <Link href={`/trade?mint=${tok.mint}`} className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
            {tok.logoUri ? (
              <Image
                src={tok.logoUri}
                alt={tok.symbol}
                width={28}
                height={28}
                className="object-cover"
                unoptimized
              />
            ) : (
              <span className="text-[10px] font-bold text-muted-foreground">
                {tok.symbol.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{tok.symbol}</div>
            <div className="text-[10px] font-mono text-muted-foreground/60">
              {tok.mint.slice(0, 6)}…{tok.mint.slice(-4)}
            </div>
          </div>
        </Link>
      </TableCell>
      <TableCell className="text-right font-mono text-sm whitespace-nowrap">
        ${formatPrice(tok.priceUsd)}
      </TableCell>
      <TableCell className="text-right">
        <span className={`text-xs font-mono inline-flex items-center gap-0.5 justify-end ${color}`}>
          {ChangeIcon && <ChangeIcon className="h-3 w-3" />}
          {change != null ? `${up ? '+' : ''}${change.toFixed(2)}%` : '—'}
        </span>
      </TableCell>
      <TableCell className="text-right font-mono text-[11px] text-muted-foreground hidden md:table-cell whitespace-nowrap">
        {hasPosition ? (
          <>
            {cost.derivedBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            <span className="text-muted-foreground/60 ml-1">@ {(cost.avgCostSol).toFixed(6)} SOL</span>
          </>
        ) : '—'}
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">
        {hasPosition ? (
          <span className={`text-xs font-mono ${unrealizedUsd >= 0 ? 'text-success' : 'text-danger'}`}>
            {unrealizedUsd >= 0 ? '+' : ''}${Math.abs(unrealizedUsd).toFixed(2)}
            <span className="text-[10px] ml-1 opacity-80">
              ({unrealizedUsd >= 0 ? '+' : ''}{unrealizedPct.toFixed(1)}%)
            </span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/50">—</span>
        )}
      </TableCell>
      <TableCell className="text-right font-mono text-xs text-muted-foreground hidden lg:table-cell">
        {tok.volume24h ? `$${formatCompact(tok.volume24h)}` : '—'}
      </TableCell>
      <TableCell className="text-right">
        <div className="inline-flex items-center gap-1">
          {/* T-942 #54 · 快速买 0.1 SOL ⚡ */}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-success hover:bg-success/10"
            onClick={onQuickBuy}
            title={t('actions.quickBuyTitle', { sol: QUICK_BUY_SOL })}
          >
            <Zap className="h-3 w-3 mr-0.5" />
            <span className="text-[10px] font-mono">{QUICK_BUY_SOL}</span>
          </Button>
          {/* 卖 Max → 跳交易页 sell tab */}
          {hasPosition ? (
            <Link
              href={`/trade?mint=${tok.mint}&side=sell`}
              className="inline-flex items-center h-7 px-2 rounded text-xs text-danger hover:bg-danger/10 transition-colors"
              title={t('actions.sellMaxTitle')}
            >
              <ArrowUpFromLine className="h-3 w-3 mr-0.5" />
              <span className="text-[10px]">Max</span>
            </Link>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
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

function formatRelativeTime(ms: number): string {
  const diffSec = (Date.now() - ms) / 1000;
  if (diffSec < 60) return `${Math.floor(diffSec)}s`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  return `${Math.floor(diffSec / 86400)}d`;
}
