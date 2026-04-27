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
import { RefreshCw, Wallet, AlertCircle, Copy, Check, ChevronDown } from 'lucide-react';

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
import { ValueChart } from './value-chart';
import { PnlShareButton } from '@/components/share/pnl-share-button';

export function PortfolioView() {
  const t = useTranslations();
  const wallet = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();
  const { sol, tokens, totalUsd, loading, error, refresh } = usePortfolio();
  const { costs } = useCostBasis();
  const [tab, setTab] = useState<'holdings' | 'closed'>('holdings');
  // T-900a:时间筛选 state hoist · T-900c 阶段联动 stat 卡 + 表格数据
  const [range, setRange] = useState<'1d' | '7d' | '30d' | 'all'>('all');
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

  const closed = useMemo(() => getClosedPositions(costs), [costs]);

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

  // T-900a:buy/sell 笔数 + 总成交额(SOL)· 给 stat 卡 #4 用
  const tradeStats = useMemo(() => {
    let buyTxCount = 0;
    let sellTxCount = 0;
    let totalVolumeSol = 0;
    for (const c of costs.values()) {
      buyTxCount += c.buyCount;
      sellTxCount += c.sellCount;
      totalVolumeSol += c.totalBoughtSol + c.totalSoldSol;
    }
    return { buyTxCount, sellTxCount, totalVolumeSol };
  }, [costs]);

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

  // 占总值百分比(给 unrealized 卡用)
  const unrealizedPctOfTotal =
    totalUsd > 0 ? (pnlSummary.unrealizedUsd / totalUsd) * 100 : 0;

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
            <div className="hidden lg:block h-8 w-px bg-border/40" />

            {/* 总值 + SOL + 币数 横排 */}
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 flex-1">
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {t('portfolio.totalValue')}
                </span>
                <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight">
                  ${formatUsd(totalUsd)}
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

            {/* 时间筛选 + 刷新 */}
            <div className="flex items-center gap-2">
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
              <Button
                size="sm"
                variant="ghost"
                onClick={refresh}
                disabled={loading}
                className="h-8 w-8 p-0"
                title={t('portfolio.autoRefreshHint')}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
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

      {!hasAnyHolding && !loading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <p className="text-muted-foreground">{t('portfolio.empty')}</p>
            <Link href="/trade">
              <Button>{t('portfolio.goTrade')}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* T-900a:5 张 stat 卡片(grid lg:5 / sm:2) */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {/* 1. 已实现收益 */}
            <Card className="hover:border-primary/30 transition-colors">
              <CardContent className="py-4 space-y-1.5">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {t('portfolio.stats.realized')}
                </div>
                <div
                  className={`text-xl font-bold font-mono tabular-nums ${
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
                <div className="text-[10px] text-muted-foreground/60">
                  {pnlSummary.closedCount > 0
                    ? t('portfolio.stats.winRateDetail', {
                        win: pnlSummary.winCount,
                        total: pnlSummary.closedCount,
                      })
                    : t('portfolio.stats.noClosedYet')}
                </div>
              </CardContent>
            </Card>

            {/* 2. 未实现收益 */}
            <Card className="hover:border-primary/30 transition-colors">
              <CardContent className="py-4 space-y-1.5">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {t('portfolio.stats.unrealized')}
                </div>
                <div
                  className={`text-xl font-bold font-mono tabular-nums ${
                    pnlSummary.unrealizedUsd > 0
                      ? 'text-success'
                      : pnlSummary.unrealizedUsd < 0
                      ? 'text-danger'
                      : 'text-foreground'
                  }`}
                >
                  {pnlSummary.unrealizedUsd >= 0 ? '+' : '-'}$
                  {formatUsd(Math.abs(pnlSummary.unrealizedUsd))}
                </div>
                <div className="text-[10px] text-muted-foreground/60 tabular-nums">
                  {t('portfolio.stats.ofTotal', {
                    pct: unrealizedPctOfTotal.toFixed(2),
                  })}
                </div>
              </CardContent>
            </Card>

            {/* 3. 胜率 + 进度条 */}
            <Card className="hover:border-primary/30 transition-colors">
              <CardContent className="py-4 space-y-1.5">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {t('portfolio.stats.winRate')}
                </div>
                <div className="text-xl font-bold font-mono tabular-nums">
                  {pnlSummary.closedCount > 0 ? `${winRatePct.toFixed(0)}%` : '—'}
                </div>
                <div className="h-1 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className="h-full bg-primary/60 transition-all"
                    style={{ width: `${pnlSummary.closedCount > 0 ? winRatePct : 0}%` }}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground/60">
                  {pnlSummary.closedCount > 0
                    ? t('portfolio.stats.winRateDetail', {
                        win: pnlSummary.winCount,
                        total: pnlSummary.closedCount,
                      })
                    : t('portfolio.stats.noClosedYet')}
                </div>
              </CardContent>
            </Card>

            {/* 4. 买入/卖出 */}
            <Card className="hover:border-primary/30 transition-colors">
              <CardContent className="py-4 space-y-1.5">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {t('portfolio.stats.buySellRatio')}
                </div>
                <div className="text-xl font-bold font-mono tabular-nums">
                  <span className="text-success">{tradeStats.buyTxCount}</span>
                  <span className="text-muted-foreground/40 mx-1">/</span>
                  <span className="text-danger">{tradeStats.sellTxCount}</span>
                </div>
                <div className="flex h-1 rounded-full overflow-hidden bg-muted/40">
                  {(() => {
                    const total = tradeStats.buyTxCount + tradeStats.sellTxCount;
                    const buyPct = total > 0 ? (tradeStats.buyTxCount / total) * 100 : 50;
                    return (
                      <>
                        <div className="bg-success/60" style={{ width: `${buyPct}%` }} />
                        <div className="bg-danger/60 flex-1" />
                      </>
                    );
                  })()}
                </div>
                <div className="text-[10px] text-muted-foreground/60 tabular-nums">
                  {tradeStats.totalVolumeSol.toFixed(2)}
                  <span className="ml-0.5">SOL</span>
                </div>
              </CardContent>
            </Card>

            {/* 5. 已节省手续费 */}
            <Card className="hover:border-primary/30 transition-colors col-span-2 lg:col-span-1">
              <CardContent className="py-4 space-y-1.5">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {t('portfolio.stats.savedFees')}
                </div>
                <div className="text-xl font-bold font-mono text-success tabular-nums">
                  {fees.txCount > 0 && savedUsd > 0
                    ? `+$${formatUsd(savedUsd)}`
                    : '$0.00'}
                </div>
                <div className="text-[10px] text-muted-foreground/60">
                  {t('portfolio.stats.savedFeesNote', { n: fees.txCount })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 分享我的战绩 · 有平仓 OR 有持仓时才显示 */}
          {(closed.length > 0 || tokens.length > 0) && solUsdPrice > 0 && (
            <div className="flex items-center justify-end pt-1">
              <PnlShareButton
                realizedUsd={pnlSummary.realizedUsd}
                unrealizedUsd={pnlSummary.unrealizedUsd}
                totalUsd={pnlSummary.totalUsd}
                totalPct={pnlSummary.totalPct}
                winCount={pnlSummary.winCount}
                closedCount={pnlSummary.closedCount}
                rangeLabel="All-time"
              />
            </div>
          )}

          {/* 资产分布(折叠 details · 默认收起) */}
          {pieItems.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer list-none flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors py-1">
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:-rotate-180" />
                {t('portfolio.distribution')}
              </summary>
              <Card className="mt-2">
                <CardContent className="pt-4">
                  <div className="grid sm:grid-cols-[180px_1fr] gap-6 items-center">
                    <div className="flex items-center justify-center">
                      <AssetPie items={pieItems} totalUsd={totalUsd} size={180} />
                    </div>
                    <AssetPieLegend items={pieItems} totalUsd={totalUsd} />
                  </div>
                </CardContent>
              </Card>
            </details>
          )}

          {/* 总资产走势(折叠 · 默认收起 · 数据采集时间长才有意义) */}
          {snapshots.length >= 2 && (
            <details className="group">
              <summary className="cursor-pointer list-none flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors py-1">
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:-rotate-180" />
                {t('portfolio.chart.title')}
              </summary>
              <Card className="mt-2">
                <CardContent className="pt-6">
                  <ValueChart snapshots={snapshots} currentTotalUsd={totalUsd} />
                </CardContent>
              </Card>
            </details>
          )}

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
                <HoldingsTable sol={sol} tokens={tokens} costs={costs} />
              </TabsContent>
              <TabsContent value="closed">
                <ClosedPositions list={closed} />
              </TabsContent>
            </Tabs>
          </Card>
        </>
      )}

      <div className="text-xs text-muted-foreground text-center pt-2">
        {t('portfolio.autoRefreshHint')}
      </div>
    </div>
  );
}

function shortAddr(s: string): string {
  return s ? s.slice(0, 4) + '…' + s.slice(-4) : '';
}

function formatUsd(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
