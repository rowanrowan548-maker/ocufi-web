'use client';

/**
 * 交易活动面板 · gmgn 风
 *
 * tabs:
 *  - 活动:GeckoTerminal 拉最近 100 笔成交
 *  - 订单:占位(限价单聚合,Day 13+)
 *  - 持有者:链上 getProgramAccounts 拉前 100,失败回落 RugCheck topHolders
 *  - 风险明细:RugCheck risks
 *  - 流动性:DexScreener pairs(T-503c · 链上 hook fetchDexPairs)
 *  - Top 交易者:从已加载 trades 聚合(T-503c · 链上 hook aggregateTraders)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { useTranslations, useLocale } from 'next-intl';
import { translateRiskName, translateRiskDesc } from '@/lib/rugcheck-i18n';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity, ListOrdered, Users, AlertTriangle, Wallet, Construction,
  ExternalLink, ArrowUpRight, ArrowDownLeft, Loader2,
  Droplets, Trophy, Eye,
} from 'lucide-react';
import type { TokenDetail } from '@/lib/token-info';
import { getCurrentChain } from '@/config/chains';
import { fetchMintTrades, type GTTrade } from '@/lib/geckoterminal';
import { fetchTopHolders, type Holder } from '@/lib/holders';
import { fetchDexPairs, type DexPairInfo } from '@/lib/dex-pairs';
import { aggregateTraders, type TraderStats } from '@/lib/top-traders';
import { formatCompact as formatLibCompact, formatUsdCompact } from '@/lib/format';
import { TradesTagFilter } from './trades-tag-filter';

export type ActivityBoardTab =
  | 'activity'
  | 'orders'
  | 'holders'
  | 'liquidity'
  | 'top-traders'
  | 'risks'
  // T-OKX-4A · OKX 7 tab 新增
  | 'watching'      // 关注地址
  | 'my-positions'; // 我的持仓

interface Props {
  detail: TokenDetail | null;
  /** 默认聚焦哪个内 tab(给 T-505a 移动端 5 tab 复用 ActivityBoard 用) */
  initialTab?: ActivityBoardTab;
  /** T-977f · 限制只渲染指定 tab(移动端去重 mini trades 用) */
  tabs?: ActivityBoardTab[];
}

const ACTIVITY_REFRESH_MS = 30_000;

export function ActivityBoard({ detail, initialTab, tabs }: Props) {
  const t = useTranslations('trade.activity');
  const locale = useLocale();
  const chain = getCurrentChain();
  const { connection } = useConnection();
  const showTab = (tab: ActivityBoardTab) => !tabs || tabs.includes(tab);
  const [tab, setTab] = useState<ActivityBoardTab>(initialTab ?? tabs?.[0] ?? 'activity');

  const mint = detail?.mint;

  // ── 活动:GeckoTerminal trades(30s 自动刷新) ──
  const [trades, setTrades] = useState<GTTrade[] | null>(null);
  const [tradesLoading, setTradesLoading] = useState(false);
  useEffect(() => {
    if (!mint) {
      setTrades(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setTradesLoading(true);
      const list = await fetchMintTrades(mint, 100);
      if (!cancelled) {
        setTrades(list);
        setTradesLoading(false);
      }
    };
    load();
    const id = setInterval(load, ACTIVITY_REFRESH_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [mint]);

  // ── 持有者:链上拉前 100,失败回落 RugCheck ──
  // BUG-025:用 ref 标记"已加载过",避免把 holders 放进 deps 导致空数组返回时死循环
  const holdersLoadedRef = useRef(false);
  const [holders, setHolders] = useState<Holder[] | null>(null);
  const [holdersLoading, setHoldersLoading] = useState(false);
  useEffect(() => {
    if (!mint || tab !== 'holders') return;
    if (holdersLoadedRef.current) return;
    let cancelled = false;
    holdersLoadedRef.current = true;
    setHoldersLoading(true);
    fetchTopHolders(connection, mint, 20)
      .then((h) => { if (!cancelled) setHolders(h); })
      .finally(() => { if (!cancelled) setHoldersLoading(false); });
    return () => { cancelled = true; };
  }, [mint, tab, connection]);

  // ── 流动性:DexScreener pairs(懒加载,切到 tab 才拉) ──
  // BUG-025:同上,用 ref 标记
  const pairsLoadedRef = useRef(false);
  const [pairs, setPairs] = useState<DexPairInfo[] | null>(null);
  const [pairsLoading, setPairsLoading] = useState(false);
  useEffect(() => {
    if (!mint || tab !== 'liquidity') return;
    if (pairsLoadedRef.current) return;
    let cancelled = false;
    pairsLoadedRef.current = true;
    setPairsLoading(true);
    fetchDexPairs(mint)
      .then((p) => { if (!cancelled) setPairs(p); })
      .finally(() => { if (!cancelled) setPairsLoading(false); });
    return () => { cancelled = true; };
  }, [mint, tab, connection]);

  // ── Top 交易者:从 trades 聚合(无独立 fetch) ──
  const traders: TraderStats[] = useMemo(
    () => (trades ? aggregateTraders(trades, 10) : []),
    [trades],
  );

  // mint 切换重置(数据 + ref 加载标记一起清,允许新 mint 重新加载)
  useEffect(() => {
    setHolders(null);
    setPairs(null);
    holdersLoadedRef.current = false;
    pairsLoadedRef.current = false;
  }, [mint]);

  return (
    <Card className="p-4">
      {/* T-OKX-4B · 桌面 lg+ 顶部 toolbar · USD/SOL · 面板视图 · 一键买卖 · 分享 */}
      <ActivityToolbar mint={mint} className="hidden lg:flex" />

      <Tabs value={tab} onValueChange={(v) => v && setTab(v as ActivityBoardTab)}>
        {/* T-OKX-4A · OKX 7 tab 顺序:交易活动 / 盈利地址 / 持币地址 / 关注地址 / 流动性 / 我的持仓 / 我的订单 · 桌面 lg+ 应用 · 移动通过 tabs prop 限制 */}
        <TabsList className="bg-transparent border-b border-border/40 rounded-none w-full justify-start gap-5 px-0 mb-4 h-auto overflow-x-auto">
          {showTab('activity') && (
            <TabBtn value="activity" Icon={Activity}>
              {t('activity')}{trades?.length ? ` ${trades.length}` : ''}
            </TabBtn>
          )}
          {showTab('top-traders') && (
            <TabBtn value="top-traders" Icon={Trophy}>
              {t('profitAddrs')}{traders.length ? ` ${traders.length}` : ''}
            </TabBtn>
          )}
          {showTab('holders') && (
            <TabBtn value="holders" Icon={Users}>
              {t('holders')}
              {detail?.totalHolders ? ` ${detail.totalHolders.toLocaleString()}` : ''}
            </TabBtn>
          )}
          {showTab('watching') && (
            <TabBtn value="watching" Icon={Eye}>
              {t('watching')}
            </TabBtn>
          )}
          {showTab('liquidity') && (
            <TabBtn value="liquidity" Icon={Droplets}>
              {t('liquidity')}{pairs?.length ? ` ${pairs.length}` : ''}
            </TabBtn>
          )}
          {showTab('my-positions') && (
            <TabBtn value="my-positions" Icon={Wallet}>
              {t('myPositions')}
            </TabBtn>
          )}
          {showTab('orders') && (
            <TabBtn value="orders" Icon={ListOrdered}>{t('myOrders')}</TabBtn>
          )}
          {showTab('risks') && (
            <TabBtn value="risks" Icon={AlertTriangle}>
              {t('risks')}{detail?.risks?.length ? ` ${detail.risks.length}` : ''}
            </TabBtn>
          )}
        </TabsList>

        {/* ── 活动 · T-OKX-4C-fe 子 tag 筛选 ── */}
        <TabsContent value="activity">
          {!mint ? (
            <Empty Icon={Construction} title={t('comingSoon.activity.title')} subtitle={t('comingSoon.activity.subtitle')} />
          ) : (
            <TradesTagFilter
              mint={mint}
              gtTrades={trades}
              gtLoading={tradesLoading}
              explorer={chain.explorer}
            />
          )}
        </TabsContent>

        {/* ── 订单 ── */}
        <TabsContent value="orders">
          <Empty Icon={Wallet} title={t('comingSoon.orders.title')} subtitle={t('comingSoon.orders.subtitle')} />
        </TabsContent>

        {/* ── 持有者 ── */}
        <TabsContent value="holders">
          {!mint ? (
            <Empty Icon={Users} title={t('comingSoon.holders.title')} subtitle={t('comingSoon.holders.subtitle')} />
          ) : holdersLoading ? (
            <LoadingRow />
          ) : holders && holders.length > 0 ? (
            <div className="space-y-1 text-xs max-h-[480px] overflow-y-auto">
              {/* 表头 */}
              <div className="grid grid-cols-[40px_1fr_60px] gap-2 px-1 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium sticky top-0 bg-card">
                <span>#</span>
                <span>{t('cols.owner')}</span>
                <span className="text-right">{t('cols.pct')}</span>
              </div>
              {holders.map((h, i) => (
                <HolderRow
                  key={h.account}
                  rank={i + 1}
                  holder={h}
                  explorer={chain.explorer}
                  maxPct={holders[0]?.pct ?? 0}
                />
              ))}
            </div>
          ) : detail?.topHolders && detail.topHolders.length > 0 ? (
            // 链上失败,降级显示 RugCheck
            <div className="space-y-1 text-xs">
              {detail.topHolders.slice(0, 100).map((h, i) => (
                <div key={i} className="grid grid-cols-[40px_1fr_60px] gap-2 py-1 border-b border-border/30 last:border-b-0">
                  <span className="font-mono text-muted-foreground">#{i + 1}</span>
                  <span className="font-mono text-muted-foreground/80 truncate">
                    {h.address ? `${h.address.slice(0, 6)}…${h.address.slice(-4)}` : '—'}
                  </span>
                  <span className="font-mono text-right">{(h.pct ?? 0).toFixed(2)}%</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty Icon={Users} title={t('comingSoon.holders.title')} subtitle={t('comingSoon.holders.subtitle')} />
          )}
        </TabsContent>

        {/* ── 流动性 ── */}
        <TabsContent value="liquidity">
          <LiquidityTab
            mint={mint}
            pairs={pairs}
            loading={pairsLoading}
          />
        </TabsContent>

        {/* ── 盈利地址(原 Top 交易者) ── */}
        <TabsContent value="top-traders">
          <TopTradersTab
            mint={mint}
            traders={traders}
            tradesLoading={tradesLoading}
            tradesLoaded={trades !== null}
            explorer={chain.explorer}
          />
        </TabsContent>

        {/* ── T-OKX-4A · 关注地址 · 占位(待用户标记钱包功能 ship) ── */}
        <TabsContent value="watching">
          <Empty Icon={Eye} title={t('comingSoon.watching.title')} subtitle={t('comingSoon.watching.subtitle')} />
        </TabsContent>

        {/* ── T-OKX-4A · 我的持仓 · 占位(WalletTokenStats 已在右栏 · 此处可深化) ── */}
        <TabsContent value="my-positions">
          <Empty Icon={Wallet} title={t('comingSoon.myPositions.title')} subtitle={t('comingSoon.myPositions.subtitle')} />
        </TabsContent>

        {/* ── 风险明细 ── */}
        <TabsContent value="risks">
          {detail?.risks && detail.risks.length > 0 ? (
            <div className="space-y-2">
              {detail.risks.map((r, i) => (
                <div
                  key={i}
                  className={[
                    'flex gap-2 p-2.5 rounded-md text-xs',
                    r.level === 'danger'
                      ? 'bg-danger/10 text-danger border border-danger/20'
                      : r.level === 'warn'
                      ? 'bg-warning/10 text-warning border border-warning/20'
                      : 'bg-muted text-muted-foreground',
                  ].join(' ')}
                >
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium">{translateRiskName(safeText(r.name), locale)}</div>
                    {r.description && (
                      <div className="text-[11px] mt-0.5 opacity-80">
                        {translateRiskDesc(safeText(r.description), locale)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty Icon={AlertTriangle} title={t('noRisks.title')} subtitle={t('noRisks.subtitle')} />
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
}

// ──────────────────────────────────────────────
// Liquidity tab
// ──────────────────────────────────────────────

function LiquidityTab({
  mint,
  pairs,
  loading,
}: {
  mint: string | undefined;
  pairs: DexPairInfo[] | null;
  loading: boolean;
}) {
  const t = useTranslations('trade.activity');

  if (!mint) {
    return <Empty Icon={Droplets} title={t('empty.liquidity')} subtitle={''} />;
  }
  if (loading && !pairs) return <LoadingRow />;
  if (!pairs || pairs.length === 0) {
    return <Empty Icon={Droplets} title={t('empty.liquidity')} subtitle={''} />;
  }

  return (
    <>
      {/* 桌面表格 ≥ sm */}
      <div className="hidden sm:block text-xs max-h-[480px] overflow-y-auto">
        <div className="grid grid-cols-[1fr_1fr_100px_100px] gap-2 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium border-b border-border/30 sticky top-0 bg-card">
          <span>{t('liquidityCols.dex')}</span>
          <span>{t('liquidityCols.pair')}</span>
          <span className="text-right">{t('liquidityCols.liquidity')}</span>
          <span className="text-right">{t('liquidityCols.volume24h')}</span>
        </div>
        {pairs.map((p) => (
          <a
            key={p.pairAddress}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="grid grid-cols-[1fr_1fr_100px_100px] gap-2 px-2 py-2 hover:bg-muted/30 transition-colors border-b border-border/30 last:border-b-0"
          >
            <span className="flex items-center gap-1 font-medium truncate">
              {p.dexLabel}
              <ExternalLink className="h-2.5 w-2.5 opacity-50 flex-shrink-0" />
            </span>
            <span className="font-mono text-muted-foreground truncate">{p.pairSymbol}</span>
            <span className="text-right font-mono">{formatUsdCompact(p.liquidityUsd)}</span>
            <span className="text-right font-mono text-muted-foreground">
              {formatUsdCompact(p.volume24h)}
            </span>
          </a>
        ))}
      </div>

      {/* 移动卡片 < sm */}
      <div className="sm:hidden space-y-2 max-h-[480px] overflow-y-auto">
        {pairs.map((p) => (
          <a
            key={p.pairAddress}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col gap-1.5 p-2.5 rounded-md border border-border/40 hover:bg-muted/30 transition-colors text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 font-medium">
                {p.dexLabel}
                <ExternalLink className="h-2.5 w-2.5 opacity-50" />
              </span>
              <span className="font-mono text-muted-foreground truncate">{p.pairSymbol}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex flex-col">
                <span className="text-muted-foreground/60 text-[10px] uppercase tracking-wide">
                  {t('liquidityCols.liquidity')}
                </span>
                <span className="font-mono">{formatUsdCompact(p.liquidityUsd)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground/60 text-[10px] uppercase tracking-wide">
                  {t('liquidityCols.volume24h')}
                </span>
                <span className="font-mono text-muted-foreground">
                  {formatUsdCompact(p.volume24h)}
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </>
  );
}

// ──────────────────────────────────────────────
// Top Traders tab
// ──────────────────────────────────────────────

function TopTradersTab({
  mint,
  traders,
  tradesLoading,
  tradesLoaded,
  explorer,
}: {
  mint: string | undefined;
  traders: TraderStats[];
  tradesLoading: boolean;
  tradesLoaded: boolean;
  explorer: string;
}) {
  const t = useTranslations('trade.activity');

  if (!mint) {
    return <Empty Icon={Trophy} title={t('empty.traders')} subtitle={''} />;
  }
  if (tradesLoading && !tradesLoaded) return <LoadingRow />;
  if (traders.length === 0) {
    return <Empty Icon={Trophy} title={t('empty.traders')} subtitle={''} />;
  }

  return (
    <>
      {/* 桌面表格 ≥ sm */}
      <div className="hidden sm:block text-xs max-h-[480px] overflow-y-auto">
        <div className="grid grid-cols-[1fr_70px_90px_90px] gap-2 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium border-b border-border/30 sticky top-0 bg-card">
          <span>{t('tradersCols.address')}</span>
          <span className="text-right">{t('tradersCols.buySell')}</span>
          <span className="text-right">{t('tradersCols.volume')}</span>
          <span className="text-right">{t('tradersCols.netFlow')}</span>
        </div>
        {traders.map((tr) => (
          <TraderRow key={tr.address} tr={tr} explorer={explorer} />
        ))}
      </div>

      {/* 移动卡片 < sm */}
      <div className="sm:hidden space-y-2 max-h-[480px] overflow-y-auto">
        {traders.map((tr) => (
          <TraderCard key={tr.address} tr={tr} explorer={explorer} t={t} />
        ))}
      </div>
    </>
  );
}

function TraderRow({ tr, explorer }: { tr: TraderStats; explorer: string }) {
  const netPositive = tr.netUsd >= 0;
  const netColor = netPositive ? 'text-success' : 'text-danger';
  return (
    <a
      href={`${explorer}/account/${tr.address}`}
      target="_blank"
      rel="noopener noreferrer"
      className="grid grid-cols-[1fr_70px_90px_90px] gap-2 px-2 py-2 hover:bg-muted/30 transition-colors border-b border-border/30 last:border-b-0"
    >
      <span className="font-mono text-muted-foreground/80 truncate flex items-center gap-1">
        {`${tr.address.slice(0, 6)}…${tr.address.slice(-4)}`}
        <ExternalLink className="h-2.5 w-2.5 opacity-50 flex-shrink-0" />
      </span>
      <span className="text-right font-mono">
        <span className="text-success">{tr.buyCount}</span>
        <span className="text-muted-foreground/50">/</span>
        <span className="text-danger">{tr.sellCount}</span>
      </span>
      <span className="text-right font-mono">${formatLibCompact(tr.totalUsdVolume)}</span>
      <span className={`text-right font-mono ${netColor}`}>
        {netPositive ? '+' : '−'}${formatLibCompact(Math.abs(tr.netUsd))}
      </span>
    </a>
  );
}

function TraderCard({
  tr,
  explorer,
  t,
}: {
  tr: TraderStats;
  explorer: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const netPositive = tr.netUsd >= 0;
  const netColor = netPositive ? 'text-success' : 'text-danger';
  return (
    <a
      href={`${explorer}/account/${tr.address}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col gap-1.5 p-2.5 rounded-md border border-border/40 hover:bg-muted/30 transition-colors text-xs"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-muted-foreground/80 truncate flex items-center gap-1">
          {`${tr.address.slice(0, 6)}…${tr.address.slice(-4)}`}
          <ExternalLink className="h-2.5 w-2.5 opacity-50" />
        </span>
        <span className="font-mono">
          <span className="text-success">{tr.buyCount}</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="text-danger">{tr.sellCount}</span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="flex flex-col">
          <span className="text-muted-foreground/60 text-[10px] uppercase tracking-wide">
            {t('tradersCols.volume')}
          </span>
          <span className="font-mono">${formatLibCompact(tr.totalUsdVolume)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground/60 text-[10px] uppercase tracking-wide">
            {t('tradersCols.netFlow')}
          </span>
          <span className={`font-mono ${netColor}`}>
            {netPositive ? '+' : '−'}${formatLibCompact(Math.abs(tr.netUsd))}
          </span>
        </div>
      </div>
    </a>
  );
}

// ──────────────────────────────────────────────
// 已有的 TradeRow / HolderRow / 工具函数(原样保留)
// ──────────────────────────────────────────────

function TradeRow({ tr, explorer }: { tr: GTTrade; explorer: string }) {
  const isBuy = tr.kind === 'buy';
  const sideColor = isBuy ? 'text-success' : 'text-danger';
  const SideIcon = isBuy ? ArrowDownLeft : ArrowUpRight;
  return (
    <a
      href={tr.txSignature ? `${explorer}/tx/${tr.txSignature}` : '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="grid grid-cols-[60px_1fr_1fr_50px] gap-2 px-2 py-1.5 hover:bg-muted/30 transition-colors border-b border-border/30 last:border-b-0"
    >
      <span className={`flex items-center gap-1 font-medium ${sideColor}`}>
        <SideIcon className="h-3 w-3" />
        {isBuy ? 'BUY' : 'SELL'}
      </span>
      <span className="text-right font-mono">
        ${formatCompact(tr.usdValue)}
      </span>
      <span className="font-mono text-muted-foreground/70 truncate">
        {tr.fromAddress ? `${tr.fromAddress.slice(0, 4)}…${tr.fromAddress.slice(-4)}` : '—'}
      </span>
      <span className="text-right text-muted-foreground/60 text-[10px]">
        {timeAgo(tr.blockTimestampMs)}
      </span>
    </a>
  );
}

function HolderRow({
  rank, holder, explorer, maxPct,
}: {
  rank: number;
  holder: Holder;
  decimals?: number;
  explorer: string;
  maxPct: number;
}) {
  const owner = holder.owner;
  // 柱状图宽度按 maxPct(top1)归一化,top1 = 100% bar 宽度
  const barWidth = maxPct > 0 ? Math.max(2, (holder.pct / maxPct) * 100) : 0;
  // 单一持有占比颜色:>50% 红 / >20% 黄 / <20% 绿
  const barColor =
    holder.pct > 50 ? 'bg-danger/40' : holder.pct > 20 ? 'bg-warning/50' : 'bg-primary/40';

  return (
    <a
      href={owner ? `${explorer}/account/${owner}` : '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="grid grid-cols-[40px_1fr_60px] gap-2 px-1 py-1.5 hover:bg-muted/30 transition-colors text-xs"
    >
      <span className="font-mono text-muted-foreground">#{rank}</span>
      <div className="min-w-0 flex flex-col gap-1">
        <span className="font-mono text-muted-foreground/80 truncate flex items-center gap-1">
          {owner ? `${owner.slice(0, 6)}…${owner.slice(-4)}` : '—'}
          {owner && <ExternalLink className="h-2.5 w-2.5 opacity-50" />}
        </span>
        {/* 占比柱(归一化到 top1) */}
        <div className="h-1 rounded-full bg-muted/40 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>
      <span className="font-mono text-right tabular-nums">{holder.pct.toFixed(2)}%</span>
    </a>
  );
}

function LoadingRow() {
  return (
    <div className="py-12 flex items-center justify-center text-muted-foreground text-xs gap-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      loading…
    </div>
  );
}

/** 安全文本:剥离控制字符 + 截断,防外部 API 注入超长/恶意字符串 */
function safeText(s: string, max = 200): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max);
}

function formatCompact(n: number): string {
  if (!n || !Number.isFinite(n)) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  if (n >= 1) return n.toFixed(2);
  return n.toPrecision(3);
}

function timeAgo(ms: number): string {
  if (!ms) return '—';
  const diff = Date.now() - ms;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

function TabBtn({ value, Icon, children }: { value: string; Icon: typeof Activity; children: React.ReactNode }) {
  return (
    <TabsTrigger
      value={value}
      className="px-0 py-2 rounded-none border-b-2 border-transparent data-[selected=true]:bg-transparent data-[selected=true]:text-foreground data-[selected=true]:border-primary text-muted-foreground gap-1.5"
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="text-xs whitespace-nowrap">{children}</span>
    </TabsTrigger>
  );
}

function Empty({ Icon, title, subtitle }: { Icon: typeof Activity; title: string; subtitle: string }) {
  return (
    <div className="py-10 text-center">
      <Icon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
      <div className="text-sm font-medium text-muted-foreground">{title}</div>
      {subtitle && <div className="text-xs text-muted-foreground/60 mt-1">{subtitle}</div>}
    </div>
  );
}

// T-OKX-4B · ActivityBoard 顶部 OKX 风 toolbar
// USD/SOL 单位 toggle(占位 · GT trades 默认 USD,内部翻译需要 SOL price 重算)
// 面板视图 · 一键买卖 · 分享 — 全占位等需求明确再 wire
function ActivityToolbar({ mint, className = '' }: { mint?: string; className?: string }) {
  const t = useTranslations('trade.activity.toolbar');
  const [unit, setUnit] = useState<'usd' | 'sol'>('usd');
  return (
    <div className={`items-center gap-2 pb-3 border-b border-border/40 mb-3 text-[11px] ${className}`}>
      {/* USD / SOL toggle */}
      <div className="inline-flex rounded border border-border/40 overflow-hidden">
        <button
          type="button"
          onClick={() => setUnit('usd')}
          className={`px-2 py-0.5 transition-colors ${
            unit === 'usd'
              ? 'bg-primary text-primary-foreground font-medium'
              : 'text-muted-foreground hover:bg-muted/40'
          }`}
        >
          USD
        </button>
        <button
          type="button"
          onClick={() => setUnit('sol')}
          className={`px-2 py-0.5 transition-colors ${
            unit === 'sol'
              ? 'bg-primary text-primary-foreground font-medium'
              : 'text-muted-foreground hover:bg-muted/40'
          }`}
        >
          SOL
        </button>
      </div>
      <span className="text-muted-foreground/40">·</span>
      <button
        type="button"
        className="text-muted-foreground/70 hover:text-foreground transition-colors"
        title={t('panelView')}
      >
        {t('panelView')}
      </button>
      <span className="text-muted-foreground/40">·</span>
      <button
        type="button"
        className="text-muted-foreground/70 hover:text-foreground transition-colors"
        title={t('quickTrade')}
      >
        {t('quickTrade')}
      </button>
      <span className="text-muted-foreground/40 ml-auto">·</span>
      {mint && (
        <button
          type="button"
          onClick={() => {
            if (typeof navigator !== 'undefined' && navigator.share) {
              navigator.share({ url: `${window.location.origin}/trade?mint=${mint}` }).catch(() => {});
            } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
              navigator.clipboard.writeText(`${window.location.origin}/trade?mint=${mint}`).catch(() => {});
            }
          }}
          className="text-muted-foreground/70 hover:text-foreground transition-colors"
        >
          {t('share')}
        </button>
      )}
    </div>
  );
}
