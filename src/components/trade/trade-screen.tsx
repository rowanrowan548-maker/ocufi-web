'use client';

/**
 * 交易页主屏 · gmgn 风整合布局
 * 顶部 combo 选币 → 紧凑 TradingHeader → 主布局(左 K线/安全/持有者 + 右 交易面板)
 */
import { useEffect, useState } from 'react';
import { PublicKey } from '@solana/web3.js';

import { TokenDetailView } from '@/components/token/token-detail';
import { TradeTabs } from './trade-tabs';
import { TokenSearchCombo } from '@/components/common/token-search-combo';
import { TradingHeader } from './trading-header';
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const m = new URLSearchParams(window.location.search).get('mint');
    if (m && isValidMint(m)) setMint(m);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isValidMint(mint)) return;
    const url = new URL(window.location.href);
    if (mint === SOL_MINT) {
      url.searchParams.delete('mint');
    } else {
      url.searchParams.set('mint', mint);
    }
    window.history.replaceState({}, '', url.toString());
  }, [mint]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      {/* 顶部 · 代币选择 combo */}
      <TokenSearchCombo value={mint} onSelect={setMint} />

      {/* 紧凑代币信息条 · 横排 */}
      <TradingHeader mint={mint} />

      {/* 主布局 · 左 K线/安全/持有者 + 右 交易面板 */}
      <div className="grid lg:grid-cols-[1fr_400px] gap-4 items-start">
        <div className="min-w-0">
          {/* hideHero 让左侧不再有大 hero(已在 TradingHeader 显示) */}
          <TokenDetailView mint={mint} hideHero />
        </div>
        <div className="lg:sticky lg:top-20">
          <TradeTabs mint={mint} compact />
        </div>
      </div>
    </div>
  );
}
