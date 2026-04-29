'use client';

/**
 * 交易页主屏 · 整合布局
 *
 * 上 : Combo 选币
 * 中 : TradingHeader(T-984b 桌面横排 7 字段 / 移动紧凑)
 * 下 :
 *   左 :ChartCard(K 线 · 桌面 lg+ 高 560px)
 *        ActivityBoard(活动 / 订单 / 持有者 / 流动 / Top / 风险 tabs)
 *   右 :TradeTabs(Buy/Sell × 市价/限价)
 *
 * T-984c · 桌面已删 InfoPanel(已搬到 trading-header)+ SafetyPanel(TrustSignals 替代)
 * T-985a · 桌面再删 TrustSignals(信息冗余 trading-header 风险标签 + ActivityBoard 风险 tab)
 * 移动端走 T-977 a-g 双栏 OKX 一屏密度
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PublicKey } from '@solana/web3.js';

import { TokenSearchCombo } from '@/components/common/token-search-combo';
import { RpcHealthBanner } from '@/components/common/rpc-health-banner';
import { TradingHeader } from './trading-header';
import { ChartCard } from './chart-card';
import { ActivityBoard } from './activity-board';
import { TradeTabs } from './trade-tabs';
import { MobileActionBar } from './mobile-action-bar';
import { MobileDataColumn } from './mobile-data-column';
import { MiniTradeFlow } from './mini-trade-flow';
import { WalletTokenStats } from './wallet-token-stats';
import { RightInfoTabs } from './right-info-tabs';
import { PoolStatsOneHour } from './pool-stats-1h';
import { fetchTokenDetail, overallRisk, riskReasons, type TokenDetail } from '@/lib/token-info';
import { DEFAULT_TRADE_MINT } from '@/lib/preset-tokens';
import { ErrorBoundary } from '@/components/common/error-boundary';

function isValidMint(s: string): boolean {
  try {
    new PublicKey(s);
    return s.length >= 32 && s.length <= 44;
  } catch {
    return false;
  }
}

// fetchTokenDetail 全部数据源都挂时的降级值(所有字段未知,UI 显示 — / $0)
function buildFallbackDetail(mint: string): TokenDetail {
  return {
    mint,
    symbol: mint.slice(0, 4) + '…',
    name: '',
    priceUsd: 0,
    priceNative: 0,
    marketCap: 0,
    liquidityUsd: 0,
    mintAuthority: null,
    freezeAuthority: null,
    top10Pct: null,
    totalHolders: null,
    lpLockedPct: null,
    rugged: null,
    scoreNormalised: null,
    creatorBalance: null,
    transferFeePct: null,
    nonTransferable: null,
    mintActive: null,
    freezeActive: null,
    balanceMutable: null,
    maliciousCreator: null,
    goPlusTrusted: null,
    risks: [],
    topHolders: [],
    hasDexData: false,
    hasRugCheckData: false,
    hasGoPlusData: false,
  };
}

export function TradeScreen() {
  const searchParams = useSearchParams();
  const [mint, setMint] = useState<string>(DEFAULT_TRADE_MINT);
  const [detail, setDetail] = useState<TokenDetail | null>(null);
  const [defaultSide, setDefaultSide] = useState<'buy' | 'sell' | undefined>(undefined);

  // T-SEARCH-FIX · 反应式跟踪 URL ?mint= 变化(原版只 mount 读一次,
  // header search router.push 后 URL 变了但 trade-screen 不感知,然后下面的
  // write 副作用又把 URL 同步回旧 mint · 用户表象"搜索无反应")
  useEffect(() => {
    const m = searchParams.get('mint');
    if (m && isValidMint(m) && m !== mint) setMint(m);
    const s = searchParams.get('side');
    if (s === 'buy' || s === 'sell') setDefaultSide(s);
  }, [searchParams, mint]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isValidMint(mint)) return;
    const url = new URL(window.location.href);
    if (mint === DEFAULT_TRADE_MINT) url.searchParams.delete('mint');
    else url.searchParams.set('mint', mint);
    window.history.replaceState({}, '', url.toString());
  }, [mint]);

  // 中央 fetch 一次,所有子组件复用
  // BUG-027:fetchTokenDetail 可能抛错(无缓存 + 上游全挂),detail 永远 null UI 永远 skeleton
  // catch 里设降级 detail,所有字段空 / 0 / null,让 UI 至少能退出 loading 态
  useEffect(() => {
    setDetail(null);
    let cancelled = false;
    fetchTokenDetail(mint)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch(() => {
        if (!cancelled) setDetail(buildFallbackDetail(mint));
      });
    return () => { cancelled = true; };
  }, [mint]);

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-6 lg:max-w-none lg:mx-0 lg:px-4 py-2 sm:py-6 space-y-2 sm:space-y-4">
      <RpcHealthBanner />
      {/* 桌面端独立选币卡;移动端被 TradingHeader 内嵌的切币 popover 取代 */}
      <div className="hidden lg:block">
        <TokenSearchCombo value={mint} onSelect={setMint} />
      </div>

      {/* T-962/T-977b:移动端 TradingHeader sticky top + 桌面正常流(padding 压扁) */}
      <div className="lg:static lg:bg-transparent lg:backdrop-blur-none sticky top-0 lg:top-auto z-30 -mx-2 sm:-mx-6 px-2 sm:px-6 lg:mx-0 lg:px-0 py-1 lg:py-0 bg-background/95 backdrop-blur lg:backdrop-blur-none">
        <TradingHeader mint={mint} detail={detail} onSelectMint={setMint} />
      </div>

      {/* T-984c · 删 InfoPanel + SafetyPanel(已并入 trading-header + TrustSignals)
          T-985a · 桌面右栏再删 TrustSignals · 风险信息已在 trading-header 横排"风险"标签 + ActivityBoard "风险" tab 重复 · OKX 也无此卡 */}
      <div className="hidden lg:grid lg:grid-cols-[1fr_400px] gap-4 items-start">
        <div className="space-y-4 lg:order-2">
          <ErrorBoundary>
            <TradeTabs
              mint={mint}
              compact
              risk={detail ? overallRisk(detail) : undefined}
              reasons={detail ? riskReasons(detail) : undefined}
              defaultSide={defaultSide}
              onPickMint={(m, s) => { setMint(m); setDefaultSide(s); }}
            />
          </ErrorBoundary>
          {/* T-985b · 4 数字栏 总买入/总卖出/余额/总收益 · 仅桌面 */}
          <WalletTokenStats mint={mint} tokenPriceUsd={detail?.priceUsd} />
          {/* T-985c · 1h 聚合 + 买卖力量 · 仅桌面 · 30s 刷新 */}
          <PoolStatsOneHour mint={mint} />
          {/* T-OKX-1B · 详情 / 开发者代币 / 同名代币 3 tab */}
          <RightInfoTabs mint={mint} detail={detail} />
        </div>
        <div className="min-w-0 space-y-4 lg:order-1">
          <ChartCard mint={mint} />
          <ActivityBoard detail={detail} />
        </div>
      </div>

      {/* T-977 · OKX 风格移动端一屏密度
          1. TrustSignals 红绿灯保留(顶)
          2. K 线 always visible · aspect-[16/9] 视觉占比 30%(不再折叠)
          3. grid-cols-2:左 buy form / 右 MobileDataColumn 紧凑数据列
          4. 底部 ActivityBoard 持仓/订单/活动 tab(全宽)
          5. 删 MobileTabSwitcher 5 tab(数据已挪到右栏)
          底部 MobileActionBar 仍保留快买入口 · pb-20 防遮挡 */}
      <div className="lg:hidden flex flex-col gap-2 pb-20">
        {/* T-977d · 删 TrustSignals 重复卡(右栏 MobileDataColumn 已含 LP/Mint/Freeze/Top10)
            桌面 lg+ 仍保留 · 移动端不再渲染节省 ~120px */}

        {/* T-977 #2 · K 线常驻 · aspect-[16/9] 占视口约 30% */}
        <div className="rounded-lg border border-border/40 overflow-hidden">
          <ChartCard mint={mint} />
        </div>

        {/* T-977f · 50/50 双栏:items-stretch · 右栏 trades 撑满左栏 buy form 高度 */}
        <div className="grid grid-cols-2 gap-2 items-stretch">
          <div className="min-w-0">
            <TradeTabs
              mint={mint}
              compact
              risk={detail ? overallRisk(detail) : undefined}
              reasons={detail ? riskReasons(detail) : undefined}
              defaultSide={defaultSide}
              onPickMint={(m, s) => { setMint(m); setDefaultSide(s); }}
            />
          </div>
          <div className="min-w-0 flex flex-col gap-2">
            <div className="flex-shrink-0">
              <MobileDataColumn detail={detail} />
            </div>
            {/* T-977f · trades 撑满剩余空间 · 显 20 笔内滚 */}
            <div className="flex-1 min-h-0">
              <MiniTradeFlow mint={mint} limit={20} />
            </div>
          </div>
        </div>

        {/* T-977f · 底部 ActivityBoard 删 activity tab(右栏 mini trades 替代)
            保留 orders/holders/liquidity 3 tabs · 默认 orders */}
        <ActivityBoard
          detail={detail}
          tabs={['orders', 'holders', 'liquidity']}
          initialTab="orders"
        />
      </div>

      {/* 移动端底部固定双按钮 CTA(T-505b · 仅 lg:hidden) */}
      <MobileActionBar
        mint={mint}
        symbol={detail?.symbol}
        risk={detail ? overallRisk(detail) : undefined}
        reasons={detail ? riskReasons(detail) : undefined}
        onPickMint={(m, s) => { setMint(m); setDefaultSide(s); }}
      />
    </div>
  );
}
