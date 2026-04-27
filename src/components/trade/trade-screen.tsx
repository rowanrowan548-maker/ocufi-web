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
import { fetchTokenDetail, overallRisk, riskReasons, type TokenDetail } from '@/lib/token-info';
import { SOL_MINT } from '@/lib/preset-tokens';

function isValidMint(s: string): boolean {
  try {
    new PublicKey(s);
    return s.length >= 32 && s.length <= 44;
  } catch {
    return false;
  }
}

export function TradeScreen() {
  const [mint, setMint] = useState<string>(SOL_MINT);
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
    if (mint === SOL_MINT) url.searchParams.delete('mint');
    else url.searchParams.set('mint', mint);
    window.history.replaceState({}, '', url.toString());
  }, [mint]);

  // 中央 fetch 一次,所有子组件复用
  useEffect(() => {
    setDetail(null);
    let cancelled = false;
    fetchTokenDetail(mint).then((d) => {
      if (!cancelled) setDetail(d);
    });
    return () => { cancelled = true; };
  }, [mint]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <RpcHealthBanner />
      <TokenSearchCombo value={mint} onSelect={setMint} />
      <TradingHeader mint={mint} detail={detail} />

      {/* 桌面 lg+:现有 grid 完全不动(T-501/502/503/504 视觉) */}
      <div className="hidden lg:grid lg:grid-cols-[1fr_400px] gap-4 items-start">
        <div className="space-y-4 lg:order-2">
          <TrustSignals detail={detail} />
          <TradeTabs
            mint={mint}
            compact
            risk={detail ? overallRisk(detail) : undefined}
            reasons={detail ? riskReasons(detail) : undefined}
            defaultSide={defaultSide}
            onPickMint={(m, s) => { setMint(m); setDefaultSide(s); }}
          />
          <InfoPanel detail={detail} />
          <SafetyPanel detail={detail} />
        </div>
        <div className="min-w-0 space-y-4 lg:order-1">
          <ChartCard mint={mint} />
          <ActivityBoard detail={detail} />
        </div>
      </div>

      {/* 移动 < lg:5 tab 切换布局(T-505a) */}
      <div className="lg:hidden flex flex-col gap-4">
        <MobileTabSwitcher value={mobileTab} onChange={setMobileTab} />
        {mobileTab === 'chart' && <ChartCard mint={mint} />}
        {mobileTab === 'detail' && (
          <div className="space-y-4">
            <TrustSignals detail={detail} />
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
  );
}
