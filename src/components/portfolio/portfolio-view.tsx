'use client';

/**
 * 持仓页主 UI(升级版)
 *
 * 布局:
 *  ┌── 总值卡(大数字)── 7d/30d 曲线 ─┐
 *  │                                  │
 *  │  ┌── 资产分布饼 ──┐  ┌── 图例 ──┐│
 *  │  └────────────────┘  └──────────┘│
 *  │                                  │
 *  │  Tabs: 持仓 / 已平仓             │
 *  └──────────────────────────────────┘
 */
import { useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { RefreshCw, Wallet, AlertCircle, Copy, Check, Award } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePortfolio } from '@/hooks/use-portfolio';
import { useCostBasis } from '@/hooks/use-cost-basis';
import { getClosedPositions } from '@/lib/cost-basis';
import {
  appendSnapshot,
  readSnapshots,
  type Snapshot,
} from '@/lib/portfolio-history';
import { readFees, type FeeTotal } from '@/lib/fee-tracker';

import { HoldingsTable } from './holdings-table';
import { ClosedPositions } from './closed-positions';
import { AssetPie, AssetPieLegend } from './asset-pie';
import {
  DailyPnlBars,
  TopGainerBars,
  WinDistRows,
  SavedFeesLine,
  type TopGainer,
} from './stat-charts';
import { PnlShareButton } from '@/components/share/pnl-share-button';
import { BadgeIcon } from '@/components/badges/badge-icon';
import { useBadges, type EarnedBadge } from '@/hooks/use-badges';
import { useCurrency } from '@/lib/currency-store';
import { formatAmount } from '@/lib/format';

export function PortfolioView() {
  const t = useTranslations();
  const wallet = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();
  const { sol, tokens, totalUsd, loading, error, refresh } = usePortfolio();
  const { costs, loading: cbLoading, records } = useCostBasis();
  // T-906b · 顶部 mini badge wall 数据
  const { earned: earnedBadges } = useBadges(wallet.publicKey?.toBase58() ?? null);
  const [tab, setTab] = useState<'holdings' | 'closed'>('holdings');
  // T-903:顶层双 tab 盈亏分析 / 资产组合
  const [topTab, setTopTab] = useState<'pnl' | 'portfolio'>('pnl');
  // T-900a:时间筛选 state hoist · T-900c 阶段联动 stat 卡 + 表格数据
  const [range, setRange] = useState<'1d' | '7d' | '30d' | 'all'>('all');
  // T-908b · 全站货币(替换 T-902 局部 unit)· 顶部局部 toggle 已删
  const currency = useCurrency();
  // T-902:刷新时间戳,用来显示「更新于 X 秒前」
  const [lastRefreshAt, setLastRefreshAt] = useState(() => Date.now());
  const [refreshTick, setRefreshTick] = useState(0);
  const [copied, setCopied] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [fees, setFees] = useState<FeeTotal>({
    ocufiSol: 0, networkSol: 0, txCount: 0, volumeSol: 0, startedAt: 0, lastAt: 0,
  });

  const walletAddr = wallet.publicKey?.toBase58() ?? '';

  async function copyAddr() {
    try {
      await navigator.clipboard.writeText(walletAddr);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* */ }
  }

  // 钱包切换时读快照 + 累计手续费
  useEffect(() => {
    if (!walletAddr) {
      setSnapshots([]);
      setFees({ ocufiSol: 0, networkSol: 0, txCount: 0, volumeSol: 0, startedAt: 0, lastAt: 0 });
      return;
    }
    setSnapshots(readSnapshots(walletAddr));
    setFees(readFees(walletAddr));
  }, [walletAddr]);

  // 持仓加载完毕,且金额大于 0,才追加快照(避免 loading 期间记 0)
  useEffect(() => {
    if (!walletAddr || loading || totalUsd <= 0) return;
    const updated = appendSnapshot(walletAddr, totalUsd);
    setSnapshots(updated);
  }, [walletAddr, loading, totalUsd]);

  // T-902:loading 转 false → 视为一次新刷新完成
  useEffect(() => {
    if (!loading) setLastRefreshAt(Date.now());
  }, [loading]);

  // T-902:每 5 秒重渲让"更新于 X 秒前"动起来
  useEffect(() => {
    const id = window.setInterval(() => setRefreshTick((t) => t + 1), 5000);
    return () => window.clearInterval(id);
  }, []);

  const closedAll = useMemo(() => getClosedPositions(costs), [costs]);

  // T-900c:range → 秒级 cutoff(0 表示 all)
  const cutoffSec = useMemo(() => {
    if (range === 'all') return 0;
    const days = range === '1d' ? 1 : range === '7d' ? 7 : 30;
    return Math.floor(Date.now() / 1000) - days * 86400;
  }, [range]);

  // 按 range 过滤的已平仓
  const closed = useMemo(
    () => (cutoffSec > 0 ? closedAll.filter((p) => p.closedAt > cutoffSec) : closedAll),
    [closedAll, cutoffSec]
  );

  // 按 range 过滤的 tx 记录(给 stat #4 买卖笔数 / 总成交 SOL 用)
  const recordsInRange = useMemo(
    () =>
      cutoffSec > 0
        ? records.filter((r) => (r.blockTime ?? 0) > cutoffSec)
        : records,
    [records, cutoffSec]
  );

  // 按 range 过滤的总值快照(给 ValueChart)
  const snapshotsInRange = useMemo(() => {
    if (cutoffSec <= 0) return snapshots;
    const cutoffMs = cutoffSec * 1000;
    return snapshots.filter((s) => s.ts >= cutoffMs);
  }, [snapshots, cutoffSec]);

  // 组装 pie 数据:SOL + 每个 token
  const pieItems = useMemo(() => {
    const items: Array<{ symbol: string; valueUsd: number }> = [];
    if (sol.amount > 0 && sol.valueUsd > 0) {
      items.push({ symbol: 'SOL', valueUsd: sol.valueUsd });
    }
    for (const tk of tokens) {
      if (tk.valueUsd > 0) items.push({ symbol: tk.symbol, valueUsd: tk.valueUsd });
    }
    return items;
  }, [sol, tokens]);

  // ── 总盈亏数据(分享卡用) ──
  const solUsdPrice = sol.amount > 0 ? sol.valueUsd / sol.amount : 0;
  const pnlSummary = useMemo(() => {
    // 已实现:closed positions 累计 SOL PnL × 当前 SOL 价
    let realizedSol = 0;
    let winCount = 0;
    for (const p of closed) {
      realizedSol += p.realizedPnlSol;
      if (p.realizedPnlSol > 0) winCount++;
    }
    const realizedUsd = realizedSol * solUsdPrice;

    // 未实现:每个 token (currentPriceUsd - avgCostUsd) × balance
    let unrealizedUsd = 0;
    for (const tk of tokens) {
      const cost = costs.get(tk.mint);
      if (!cost || cost.avgCostSol <= 0) continue;
      const avgCostUsd = cost.avgCostSol * solUsdPrice;
      if (avgCostUsd <= 0 || tk.priceUsd <= 0) continue;
      unrealizedUsd += (tk.priceUsd - avgCostUsd) * tk.amount;
    }

    const totalUsd = realizedUsd + unrealizedUsd;
    // 总投入 = 累计买入 SOL × 当前 SOL 价(粗略基线)
    let totalBuySol = 0;
    for (const c of costs.values()) totalBuySol += c.totalBoughtSol;
    const baselineUsd = totalBuySol * solUsdPrice;
    const totalPct = baselineUsd > 0 ? (totalUsd / baselineUsd) * 100 : 0;

    return {
      realizedUsd,
      unrealizedUsd,
      totalUsd,
      totalPct,
      winCount,
      closedCount: closed.length,
    };
  }, [closed, tokens, costs, solUsdPrice]);

  // T-900a/c:buy/sell 笔数 + 总成交额 + 买端体量(SOL)· 按 range 过滤
  const tradeStats = useMemo(() => {
    let buyTxCount = 0;
    let sellTxCount = 0;
    let buyVolumeSol = 0;
    let totalVolumeSol = 0;
    for (const r of recordsInRange) {
      if (r.err) continue;
      if (r.type === 'buy' && r.solAmount > 0) {
        buyTxCount++;
        buyVolumeSol += r.solAmount;
        totalVolumeSol += r.solAmount;
      } else if (r.type === 'sell' && r.solAmount > 0) {
        sellTxCount++;
        totalVolumeSol += r.solAmount;
      }
    }
    return { buyTxCount, sellTxCount, totalVolumeSol, buyVolumeSol };
  }, [recordsInRange]);

  // T-900a:已节省手续费 · 复用 SavingsCard 计算逻辑
  // ocufi 0.2% · 平均费率 0.5% · 节省 = volumeSol × 0.3%
  const savedSol =
    fees.volumeSol > 0 ? fees.volumeSol * 0.003 : 0;
  const savedUsd = savedSol * solUsdPrice;

  // 胜率
  const winRatePct =
    pnlSummary.closedCount > 0
      ? (pnlSummary.winCount / pnlSummary.closedCount) * 100
      : 0;

  // T-901:TOP 3 收益代币(按未实现 PnL%)
  const topGainers = useMemo<TopGainer[]>(() => {
    const list: TopGainer[] = [];
    for (const tk of tokens) {
      const cost = costs.get(tk.mint);
      if (!cost || cost.avgCostSol <= 0) continue;
      const avgCostUsd = cost.avgCostSol * solUsdPrice;
      if (avgCostUsd <= 0 || tk.priceUsd <= 0) continue;
      const pnlPct = ((tk.priceUsd - avgCostUsd) / avgCostUsd) * 100;
      const pnlUsd = (tk.priceUsd - avgCostUsd) * tk.amount;
      list.push({ symbol: tk.symbol, pnlPct, pnlUsd });
    }
    list.sort((a, b) => b.pnlPct - a.pnlPct);
    return list.slice(0, 3);
  }, [tokens, costs, solUsdPrice]);

  // T-901:平均每笔买入(SOL)给买卖卡副信息
  const avgBuySol =
    tradeStats.buyTxCount > 0 ? tradeStats.buyVolumeSol / tradeStats.buyTxCount : 0;

  // T-902:更新于 X 秒/分前(ticks 触发重算,值是参考)
  const updatedAgo = useMemo(() => {
    void refreshTick;
    const sec = Math.floor((Date.now() - lastRefreshAt) / 1000);
    if (sec < 5) return t('portfolio.stats.justNow');
    if (sec < 60) return t('portfolio.stats.secondsAgo', { n: sec });
    return t('portfolio.stats.minutesAgo', { n: Math.floor(sec / 60) });
  }, [lastRefreshAt, refreshTick, t]);

  // 未连接
  if (!wallet.connected || !wallet.publicKey) {
    return (
      <Card className="w-full max-w-2xl">
        <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <Wallet className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">{t('portfolio.notConnected')}</p>
          <Button onClick={() => openWalletModal(true)}>
            {t('wallet.connect')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const hasAnyHolding = sol.amount > 0 || tokens.length > 0;

  return (
    <div className="w-full max-w-6xl space-y-4">
      {/* T-900a:顶部信息条(钱包 / 总值 / SOL / 币数 / 时间筛选 + 刷新) */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-6">
            {/* T-905a:移动端钱包行 — wallet 左 + 3 图标右,填补右侧空白 */}
            <div className="flex items-center justify-between gap-2 lg:contents">
              {/* 钱包地址 */}
              <button
                type="button"
                onClick={copyAddr}
                className="flex items-center gap-2 group min-w-0 hover:bg-muted/40 -m-1 p-1 rounded transition-colors"
                title={t('wallet.copyAddress')}
              >
                <Wallet className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />
                <span className="font-mono text-xs sm:text-sm text-muted-foreground truncate">
                  {shortAddr(walletAddr)}
                </span>
                {copied ? (
                  <Check className="h-3 w-3 text-success flex-shrink-0" />
                ) : (
                  <Copy className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground flex-shrink-0" />
                )}
              </button>
              {/* 移动端 only · 3 图标右排 */}
              <div className="flex items-center gap-1 lg:hidden">
                <ActionIcons
                  loading={loading}
                  refresh={refresh}
                  refreshTooltip={`${t('portfolio.refreshNow')} · ${t('portfolio.stats.updatedAgo', { ago: updatedAgo })}`}
                  badgesTooltip={t('portfolio.badgesEntry')}
                  earnedBadges={earnedBadges}
                  badgesEmptyLabel={t('badges.empty')}
                  showShare={(closed.length > 0 || tokens.length > 0) && solUsdPrice > 0}
                  shareProps={{
                    realizedUsd: pnlSummary.realizedUsd,
                    unrealizedUsd: pnlSummary.unrealizedUsd,
                    totalUsd: pnlSummary.totalUsd,
                    totalPct: pnlSummary.totalPct,
                    winCount: pnlSummary.winCount,
                    closedCount: pnlSummary.closedCount,
                    rangeLabel: range === 'all' ? 'All-time' : `Last ${range}`,
                  }}
                />
              </div>
              <div className="hidden lg:block h-8 w-px bg-border/40" />
            </div>

            {/* 总值 + SOL + 币数 横排 */}
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 flex-1">
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {t('portfolio.totalValue')}
                </span>
                <span className="text-3xl sm:text-4xl font-bold tabular-nums leading-none">
                  {formatAmount(totalUsd, currency, solUsdPrice)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {t('portfolio.stats.solBalance')}
                </span>
                <span className="text-base font-mono font-semibold tabular-nums">
                  {sol.amount.toFixed(3)}
                  <span className="text-[10px] text-muted-foreground/60 ml-1">SOL</span>
                </span>
                <span className="text-[10px] text-muted-foreground/60 font-mono">
                  ${formatUsd(sol.valueUsd)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {t('portfolio.stats.tokenCount')}
                </span>
                <span className="text-base font-mono font-semibold tabular-nums">
                  {tokens.length + (sol.amount > 0 ? 1 : 0)}
                </span>
              </div>
            </div>

            {/* T-905a:桌面右上控制区 — 2 行,顶层时间+USD/SOL,底层 3 图标 */}
            <div className="flex flex-col items-stretch lg:items-end gap-2">
              {/* 顶层:时间筛选 + USD/SOL · 移动端两端分布填满整行,桌面端右对齐 */}
              <div className="flex items-center gap-2 justify-between lg:justify-end">
                <Tabs value={range} onValueChange={(v) => v && setRange(v as typeof range)}>
                  <TabsList className="h-8">
                    <TabsTrigger value="1d" className="text-xs px-2.5 h-6">
                      {t('portfolio.stats.range1d')}
                    </TabsTrigger>
                    <TabsTrigger value="7d" className="text-xs px-2.5 h-6">
                      {t('portfolio.stats.range7d')}
                    </TabsTrigger>
                    <TabsTrigger value="30d" className="text-xs px-2.5 h-6">
                      {t('portfolio.stats.range30d')}
                    </TabsTrigger>
                    <TabsTrigger value="all" className="text-xs px-2.5 h-6">
                      {t('portfolio.stats.rangeAll')}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              {/* 底层:桌面 only · 3 图标 — 移动端图标已在钱包行 */}
              <div className="hidden lg:flex items-center gap-1 justify-end">
                <ActionIcons
                  loading={loading}
                  refresh={refresh}
                  refreshTooltip={`${t('portfolio.refreshNow')} · ${t('portfolio.stats.updatedAgo', { ago: updatedAgo })}`}
                  badgesTooltip={t('portfolio.badgesEntry')}
                  earnedBadges={earnedBadges}
                  badgesEmptyLabel={t('badges.empty')}
                  showShare={(closed.length > 0 || tokens.length > 0) && solUsdPrice > 0}
                  shareProps={{
                    realizedUsd: pnlSummary.realizedUsd,
                    unrealizedUsd: pnlSummary.unrealizedUsd,
                    totalUsd: pnlSummary.totalUsd,
                    totalPct: pnlSummary.totalPct,
                    winCount: pnlSummary.winCount,
                    closedCount: pnlSummary.closedCount,
                    rangeLabel: range === 'all' ? 'All-time' : `Last ${range}`,
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex gap-2 items-start p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span className="break-all">{error}</span>
        </div>
      )}

      {/* T-900c:加载骨架屏(钱包连了但数据还没回来) */}
      {(loading || cbLoading) && !hasAnyHolding ? (
        <PortfolioSkeleton />
      ) : !hasAnyHolding ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <p className="text-muted-foreground">{t('portfolio.empty')}</p>
            <Link href="/trade">
              <Button>{t('portfolio.goTrade')}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={topTab} onValueChange={(v) => v && setTopTab(v as typeof topTab)}>
          <TabsList className="bg-transparent border-b border-border/40 rounded-none w-full justify-start gap-5 px-0 mb-3 h-auto">
            <TabsTrigger
              value="pnl"
              className="px-0 py-2 rounded-none border-b-2 border-transparent data-[selected=true]:bg-transparent data-[selected=true]:text-foreground data-[selected=true]:border-primary text-muted-foreground text-sm"
            >
              {t('portfolio.topTabs.pnl')}
            </TabsTrigger>
            <TabsTrigger
              value="portfolio"
              className="px-0 py-2 rounded-none border-b-2 border-transparent data-[selected=true]:bg-transparent data-[selected=true]:text-foreground data-[selected=true]:border-primary text-muted-foreground text-sm"
            >
              {t('portfolio.topTabs.portfolio')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pnl" className="space-y-4">
          {/* T-900a/T-901:5 张 stat 卡片(grid lg:5 / sm:2)· 每张加 mini 可视化 */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {/* 1. 已实现收益 + 7 日柱状图 */}
            <Card className="hover:border-primary/30 transition-colors min-h-[140px]">
              <CardContent className="py-3 flex flex-col h-full gap-2">
                <div className="space-y-1">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {t('portfolio.stats.realized')}
                  </div>
                  <div
                    className={`text-xl font-bold font-mono tabular-nums leading-tight ${
                      pnlSummary.realizedUsd > 0
                        ? 'text-success'
                        : pnlSummary.realizedUsd < 0
                        ? 'text-danger'
                        : 'text-foreground'
                    }`}
                  >
                    {pnlSummary.realizedUsd >= 0 ? '+' : '-'}$
                    {formatUsd(Math.abs(pnlSummary.realizedUsd))}
                  </div>
                  <div className="text-[10px] text-muted-foreground/60 tabular-nums flex flex-col">
                    <span>
                      {t('portfolio.stats.totalShort')}{' '}
                      <span
                        className={
                          pnlSummary.totalUsd > 0
                            ? 'text-success'
                            : pnlSummary.totalUsd < 0
                            ? 'text-danger'
                            : ''
                        }
                      >
                        {pnlSummary.totalUsd >= 0 ? '+' : '-'}$
                        {formatUsd(Math.abs(pnlSummary.totalUsd))}
                      </span>
                    </span>
                    <span>
                      {t('portfolio.stats.unrealizedShort')}{' '}
                      <span
                        className={
                          pnlSummary.unrealizedUsd > 0
                            ? 'text-success'
                            : pnlSummary.unrealizedUsd < 0
                            ? 'text-danger'
                            : ''
                        }
                      >
                        {pnlSummary.unrealizedUsd >= 0 ? '+' : '-'}$
                        {formatUsd(Math.abs(pnlSummary.unrealizedUsd))}
                      </span>
                    </span>
                  </div>
                </div>
                <div className="mt-auto pt-1">
                  <DailyPnlBars closed={closed} />
                  <div className="text-[9px] text-muted-foreground/50 font-mono mt-0.5 text-right">
                    {t('portfolio.stats.last7d')}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 2. 收益最高代币 + TOP3 柱 */}
            <Card className="hover:border-primary/30 transition-colors min-h-[140px]">
              <CardContent className="py-3 flex flex-col h-full gap-2">
                <div className="space-y-1">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {t('portfolio.stats.topGainer')}
                  </div>
                  {topGainers.length > 0 ? (
                    <>
                      <div
                        className={`text-xl font-bold font-mono tabular-nums leading-tight ${
                          topGainers[0].pnlPct > 0
                            ? 'text-success'
                            : topGainers[0].pnlPct < 0
                            ? 'text-danger'
                            : ''
                        }`}
                      >
                        {topGainers[0].pnlPct >= 0 ? '+' : ''}
                        {topGainers[0].pnlPct.toFixed(1)}%
                      </div>
                      <div className="text-[10px] text-muted-foreground/60 font-mono truncate">
                        {topGainers[0].symbol}{' · '}
                        {topGainers[0].pnlUsd >= 0 ? '+' : '-'}$
                        {formatUsd(Math.abs(topGainers[0].pnlUsd))}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-xl font-bold font-mono tabular-nums leading-tight text-muted-foreground">
                        —
                      </div>
                      <div className="text-[10px] text-muted-foreground/60">
                        {t('portfolio.stats.noHoldingsYet')}
                      </div>
                    </>
                  )}
                </div>
                <div className="mt-auto pt-1">
                  <TopGainerBars items={topGainers} />
                </div>
              </CardContent>
            </Card>

            {/* 3. 胜率 + 4 档分布 */}
            <Card className="hover:border-primary/30 transition-colors min-h-[140px]">
              <CardContent className="py-3 flex flex-col h-full gap-2">
                <div className="space-y-1">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {t('portfolio.stats.winRate')}
                  </div>
                  <div className="text-xl font-bold font-mono tabular-nums leading-tight">
                    {pnlSummary.closedCount > 0 ? `${winRatePct.toFixed(0)}%` : '—'}
                  </div>
                  <div className="text-[10px] text-muted-foreground/60">
                    {pnlSummary.closedCount > 0
                      ? t('portfolio.stats.winRateDetail', {
                          win: pnlSummary.winCount,
                          total: pnlSummary.closedCount,
                        })
                      : t('portfolio.stats.noClosedYet')}
                  </div>
                </div>
                <div className="mt-auto pt-1">
                  <WinDistRows closed={closed} />
                </div>
              </CardContent>
            </Card>

            {/* 4. 买入/卖出 */}
            <Card className="hover:border-primary/30 transition-colors min-h-[140px]">
              <CardContent className="py-3 flex flex-col h-full gap-2">
                <div className="space-y-1">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {t('portfolio.stats.buySellRatio')}
                  </div>
                  <div className="text-xl font-bold font-mono tabular-nums leading-tight">
                    <span className="text-success">{tradeStats.buyTxCount}</span>
                    <span className="text-muted-foreground/40 mx-1">|</span>
                    <span className="text-danger">{tradeStats.sellTxCount}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground/60 tabular-nums">
                    {avgBuySol > 0
                      ? t('portfolio.stats.avgBuyPerTx', { sol: avgBuySol.toFixed(3) })
                      : t('portfolio.stats.noTradesYet')}
                  </div>
                </div>
                <div className="mt-auto pt-1 space-y-1">
                  <div className="flex h-2 rounded-full overflow-hidden bg-muted/40">
                    {(() => {
                      const total = tradeStats.buyTxCount + tradeStats.sellTxCount;
                      const buyPct = total > 0 ? (tradeStats.buyTxCount / total) * 100 : 50;
                      return (
                        <>
                          <div
                            className="transition-all"
                            style={{
                              width: `${buyPct}%`,
                              background: 'oklch(0.78 0.18 145)',
                              opacity: 0.85,
                            }}
                          />
                          <div
                            className="flex-1"
                            style={{
                              background: 'oklch(0.65 0.22 25)',
                              opacity: 0.85,
                            }}
                          />
                        </>
                      );
                    })()}
                  </div>
                  <div className="text-[9px] text-muted-foreground/50 font-mono tabular-nums text-right">
                    {tradeStats.totalVolumeSol.toFixed(2)} SOL
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 5. 已节省手续费 + mini 累计折线 */}
            <Card className="hover:border-primary/30 transition-colors min-h-[140px] col-span-2 lg:col-span-1">
              <CardContent className="py-3 flex flex-col h-full gap-2">
                <div className="space-y-1">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {t('portfolio.stats.savedFees')}
                  </div>
                  <div className="text-xl font-bold font-mono text-success tabular-nums leading-tight">
                    {fees.txCount > 0 && savedUsd > 0
                      ? `+$${formatUsd(savedUsd)}`
                      : '$0.00'}
                  </div>
                  <div className="text-[10px] text-muted-foreground/60">
                    {t('portfolio.stats.savedFeesNote', { n: fees.txCount })}
                  </div>
                </div>
                <div className="mt-auto pt-1">
                  <SavedFeesLine records={recordsInRange} solUsd={solUsdPrice} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* T-902:删除中间「分享我的战绩」按钮 + 两条折叠条(资产分布/总资产走势)
              · 分享按钮已迁到顶部信息条右上角(icon-only)
              · 资产分布饼图 T-903 移到「资产组合」tab */}

          {/* Tabs:持仓 / 已平仓 */}
          <Card className="p-4">
            <Tabs value={tab} onValueChange={(v) => v && setTab(v as 'holdings' | 'closed')}>
              <TabsList className="bg-transparent border-b border-border/40 rounded-none w-full justify-start gap-5 px-0 mb-4 h-auto">
                <TabsTrigger
                  value="holdings"
                  className="px-0 py-2 rounded-none border-b-2 border-transparent data-[selected=true]:bg-transparent data-[selected=true]:text-foreground data-[selected=true]:border-primary text-muted-foreground"
                >
                  {t('portfolio.tabs.holdings')}
                  {tokens.length > 0 ? ` ${tokens.length + (sol.amount > 0 ? 1 : 0)}` : ''}
                </TabsTrigger>
                <TabsTrigger
                  value="closed"
                  className="px-0 py-2 rounded-none border-b-2 border-transparent data-[selected=true]:bg-transparent data-[selected=true]:text-foreground data-[selected=true]:border-primary text-muted-foreground"
                >
                  {t('portfolio.tabs.closed')}
                  {closed.length > 0 ? ` ${closed.length}` : ''}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="holdings">
                <HoldingsTable
                  sol={sol}
                  tokens={tokens}
                  costs={costs}
                  cutoffSec={cutoffSec}
                />
              </TabsContent>
              <TabsContent value="closed">
                <ClosedPositions list={closed} />
              </TabsContent>
            </Tabs>
          </Card>
          </TabsContent>

          {/* T-903:资产组合 tab — AssetPie + 持仓 table 简化视图 */}
          <TabsContent value="portfolio" className="space-y-4">
            {pieItems.length > 0 && (
              <Card>
                <CardContent className="pt-4">
                  <div className="grid sm:grid-cols-[180px_1fr] gap-6 items-center">
                    <div className="flex items-center justify-center">
                      <AssetPie items={pieItems} totalUsd={totalUsd} size={180} />
                    </div>
                    <AssetPieLegend items={pieItems} totalUsd={totalUsd} />
                  </div>
                </CardContent>
              </Card>
            )}
            <Card className="p-4">
              <HoldingsTable
                sol={sol}
                tokens={tokens}
                costs={costs}
                cutoffSec={cutoffSec}
              />
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <div className="text-xs text-muted-foreground text-center pt-2">
        {t.rich('portfolio.autoRefreshHint', {
          icon: () => (
            <RefreshCw className="inline-block h-3.5 w-3.5 mx-0.5 align-text-bottom" />
          ),
        })}
      </div>
    </div>
  );
}

// T-905a/T-906b:复用图标组 — 刷新 / 徽章 mini wall(0 → CTA / 已得 → BadgeIcon 横排) / 分享
function ActionIcons({
  loading,
  refresh,
  refreshTooltip,
  badgesTooltip,
  earnedBadges,
  badgesEmptyLabel,
  showShare,
  shareProps,
}: {
  loading: boolean;
  refresh: () => void;
  refreshTooltip: string;
  badgesTooltip: string;
  earnedBadges: EarnedBadge[];
  badgesEmptyLabel: string;
  showShare: boolean;
  shareProps: {
    realizedUsd: number;
    unrealizedUsd: number;
    totalUsd: number;
    totalPct: number;
    winCount: number;
    closedCount: number;
    rangeLabel: string;
  };
}) {
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={refresh}
        disabled={loading}
        className="h-8 w-8 p-0"
        title={refreshTooltip}
      >
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      </Button>
      {earnedBadges.length > 0 ? (
        <Link
          href="/badges"
          className="inline-flex items-center gap-0.5 px-1.5 h-8 rounded-md hover:bg-muted/40 transition-colors"
          title={badgesTooltip}
        >
          {earnedBadges.slice(0, 3).map((b) => (
            <BadgeIcon
              key={b.code}
              icon={b.icon}
              rarity={b.rarity}
              earned
              size={24}
            />
          ))}
        </Link>
      ) : (
        <Link
          href="/badges"
          className="inline-flex items-center gap-1 px-2 h-8 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          title={badgesTooltip}
        >
          <Award className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{badgesEmptyLabel}</span>
        </Link>
      )}
      {showShare && <PnlShareButton compact {...shareProps} />}
    </>
  );
}

function shortAddr(s: string): string {
  return s ? s.slice(0, 4) + '…' + s.slice(-4) : '';
}

function formatUsd(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


// T-900c:加载骨架屏 · 5 张 stat 卡 + 表格 4 行 shimmer
function PortfolioSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card
            key={i}
            className={i === 4 ? 'col-span-2 lg:col-span-1' : ''}
          >
            <CardContent className="py-4 space-y-2">
              <div className="h-2.5 w-16 rounded bg-muted/50 animate-pulse" />
              <div className="h-6 w-24 rounded bg-muted/60 animate-pulse" />
              <div className="h-2 w-20 rounded bg-muted/40 animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="p-4">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-muted/50 animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-24 rounded bg-muted/50 animate-pulse" />
                <div className="h-2 w-32 rounded bg-muted/30 animate-pulse" />
              </div>
              <div className="h-4 w-20 rounded bg-muted/50 animate-pulse" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
