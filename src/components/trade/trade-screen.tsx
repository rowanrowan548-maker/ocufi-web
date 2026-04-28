'use client';

/**
 * 交易页主屏 · 整合布局
 *
 * 上 : Combo 选币
 * 中 : TradingHeader(紧凑)
 * 下 :
 *   左 :ChartCard(K 线)
 *        ActivityBoard(活动 / 订单 / 持有者 / 风险 tabs)
 *   右 :TradeTabs(Buy/Sell × 市价/限价)
 *        InfoPanel(行情数据)
 *        SafetyPanel(安全核查)
 */
import { useEffect, useState } from 'react';
import { PublicKey } from '@solana/web3.js';

import { TokenSearchCombo } from '@/components/common/token-search-combo';
import { RpcHealthBanner } from '@/components/common/rpc-health-banner';
import { TradingHeader } from './trading-header';
import { ChartCard } from './chart-card';
import { ActivityBoard } from './activity-board';
import { TradeTabs } from './trade-tabs';
import { TrustSignals } from './trust-signals';
import { InfoPanel } from './info-panel';
import { SafetyPanel } from './safety-panel';
import { MobileTabSwitcher, type MobileTab } from './mobile-tab-switcher';
import { MobileActionBar } from './mobile-action-bar';
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
  const [mint, setMint] = useState<string>(DEFAULT_TRADE_MINT);
  const [detail, setDetail] = useState<TokenDetail | null>(null);
  const [defaultSide, setDefaultSide] = useState<'buy' | 'sell' | undefined>(undefined);
  const [mobileTab, setMobileTab] = useState<MobileTab>('chart');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const m = params.get('mint');
    if (m && isValidMint(m)) setMint(m);
    const s = params.get('side');
    if (s === 'buy' || s === 'sell') setDefaultSide(s);
  }, []);

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
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <RpcHealthBanner />
      {/* 桌面端独立选币卡;移动端被 TradingHeader 内嵌的切币 popover 取代 */}
      <div className="hidden lg:block">
        <TokenSearchCombo value={mint} onSelect={setMint} />
      </div>

      {/* T-962:移动端 TradingHeader sticky top + 桌面正常流 */}
      <div className="lg:static lg:bg-transparent lg:backdrop-blur-none sticky top-0 lg:top-auto z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 lg:mx-0 lg:px-0 py-2 lg:py-0 bg-background/95 backdrop-blur lg:backdrop-blur-none">
        <TradingHeader mint={mint} detail={detail} onSelectMint={setMint} />
      </div>

      {/* 桌面 lg+:现有 grid 完全不动(T-501/502/503/504 视觉) */}
      <div className="hidden lg:grid lg:grid-cols-[1fr_400px] gap-4 items-start">
        <div className="space-y-4 lg:order-2">
          <TrustSignals detail={detail} />
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
          <InfoPanel detail={detail} />
          <SafetyPanel detail={detail} />
        </div>
        <div className="min-w-0 space-y-4 lg:order-1">
          <ChartCard mint={mint} />
          <ActivityBoard detail={detail} />
        </div>
      </div>

      {/* T-962 移动端 < lg 重构:
          1. 安全审查(红绿灯)始终可见
          2. 折叠式 K 线(默认收起)
          3. 主操作 BuyForm/SellForm panel
          4. 数据 / 活动 tabs 推到底部
          底部 MobileActionBar 仍保留快买入口 · pb-20 防遮挡 */}
      <div className="lg:hidden flex flex-col gap-3 pb-20">
        {/* T-962 #6 · 安全审查浮在 buy form 上方(红绿灯标)*/}
        <TrustSignals detail={detail} />

        {/* T-962 #1 · K 线折叠(默认收起)· details/summary 原生组件,无 JS 状态 */}
        <details className="group rounded-lg border border-border/40 bg-card/40 [&[open]]:bg-card">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium flex items-center justify-between gap-2 list-none [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <span>📈 K 线</span>
              <span className="text-[10px] text-muted-foreground/60">
                {detail?.priceUsd ? `$${detail.priceUsd < 1 ? detail.priceUsd.toPrecision(4) : detail.priceUsd.toFixed(2)}` : ''}
              </span>
            </span>
            <span className="text-xs text-muted-foreground group-open:hidden">▼</span>
            <span className="text-xs text-muted-foreground hidden group-open:inline">▲</span>
          </summary>
          <div className="p-2">
            <ChartCard mint={mint} />
          </div>
        </details>

        {/* T-962 #2-#5 · 主操作 panel(buy/sell 表单 inline · 抽屉感由 MobileActionBar 浮按钮触发完整 sheet)*/}
        <TradeTabs
          mint={mint}
          compact
          risk={detail ? overallRisk(detail) : undefined}
          reasons={detail ? riskReasons(detail) : undefined}
          defaultSide={defaultSide}
          onPickMint={(m, s) => { setMint(m); setDefaultSide(s); }}
        />

        {/* 数据 / 持有 / 风险 / 活动 — 折叠 tabs 推到底部 */}
        <div className="space-y-2">
          <MobileTabSwitcher value={mobileTab} onChange={setMobileTab} />
          {mobileTab === 'chart' && (
            <div className="text-[11px] text-muted-foreground/60 text-center py-4">
              {/* chart tab 此处空,因 K 线已上移到折叠组件 */}
              ↑ K 线已上移
            </div>
          )}
          {mobileTab === 'detail' && (
            <div className="space-y-3">
              <InfoPanel detail={detail} />
              <SafetyPanel detail={detail} />
            </div>
          )}
          {mobileTab === 'data' && (
            <ActivityBoard detail={detail} initialTab="liquidity" />
          )}
          {mobileTab === 'risk' && (
            <ActivityBoard detail={detail} initialTab="risks" />
          )}
          {mobileTab === 'activity' && (
            <ActivityBoard detail={detail} initialTab="activity" />
          )}
        </div>
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
