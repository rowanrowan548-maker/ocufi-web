'use client';

/**
 * 交易页主屏 · gmgn 风整合布局
 * 默认进入显示 SOL,顶部 combo 搜索 / 切换代币
 */
import { useEffect, useState } from 'react';
import { PublicKey } from '@solana/web3.js';

import { TokenDetailView } from '@/components/token/token-detail';
import { TradeTabs } from './trade-tabs';
import { TokenSearchCombo } from '@/components/common/token-search-combo';
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
  // 默认 SOL,URL ?mint=X 覆盖
  const [mint, setMint] = useState<string>(SOL_MINT);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const m = new URLSearchParams(window.location.search).get('mint');
    if (m && isValidMint(m)) setMint(m);
  }, []);

  // mint 变化时同步 URL(分享链接友好)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isValidMint(mint)) return;
    const url = new URL(window.location.href);
    if (mint === SOL_MINT) {
      url.searchParams.delete('mint'); // SOL 默认,不写 URL
    } else {
      url.searchParams.set('mint', mint);
    }
    window.history.replaceState({}, '', url.toString());
  }, [mint]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      {/* 顶部 · 代币选择 + 搜索 combo */}
      <TokenSearchCombo value={mint} onSelect={setMint} />

      {/* 主布局 · 左 token 详情 / 右 交易表单 */}
      <div className="grid lg:grid-cols-[1fr_400px] gap-4 items-start">
        <div className="min-w-0">
          <TokenDetailView mint={mint} />
        </div>
        <div className="lg:sticky lg:top-20">
          <TradeTabs mint={mint} compact />
        </div>
      </div>
    </div>
  );
}
