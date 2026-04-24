'use client';

/**
 * 交易页主屏 · gmgn 风整合布局
 *
 * 左:Token 头 + K 线 + 安全检查 + 风险 + Top 持有者(复用 TokenDetailView)
 * 右:Buy/Sell tabs(紧凑版,无 mint 输入,受控于顶部搜索条)
 *
 * URL ?mint=X 预填,顶部搜索条切换
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PublicKey } from '@solana/web3.js';
import { Search, LineChart } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { TokenPricePreview } from '@/components/common/token-price-preview';
import { TokenDetailView } from '@/components/token/token-detail';
import { TradeTabs } from './trade-tabs';

function isValidMint(s: string): boolean {
  try {
    new PublicKey(s);
    return s.length >= 32 && s.length <= 44;
  } catch {
    return false;
  }
}

export function TradeScreen() {
  const t = useTranslations();
  const [mint, setMint] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const m = new URLSearchParams(window.location.search).get('mint');
    if (m && m.length >= 32) setMint(m);
  }, []);

  // 用户在搜索框改 mint 时,把 ?mint=X 写回 URL(不刷新)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const m = mint.trim();
    const url = new URL(window.location.href);
    if (m && isValidMint(m)) url.searchParams.set('mint', m);
    else url.searchParams.delete('mint');
    window.history.replaceState({}, '', url.toString());
  }, [mint]);

  const validMint = isValidMint(mint.trim()) ? mint.trim() : '';

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      {/* 顶部 · 搜索栏 */}
      <Card className="p-3">
        <div className="flex items-center gap-3">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Input
            placeholder={t('trade.searchPlaceholder')}
            value={mint}
            onChange={(e) => setMint(e.target.value)}
            className="font-mono text-sm border-0 focus-visible:ring-0 px-0 bg-transparent shadow-none"
          />
        </div>
        {mint && <div className="mt-3"><TokenPricePreview mint={mint} showSafetyLink={false} /></div>}
      </Card>

      {/* 主内容 */}
      {!validMint ? (
        <Card className="py-16 text-center px-6">
          <LineChart className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-semibold">{t('trade.empty.title')}</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            {t('trade.empty.subtitle')}
          </p>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-[1fr_400px] gap-4 items-start">
          {/* 左:代币详情(复用) */}
          <div className="min-w-0">
            <TokenDetailView mint={validMint} />
          </div>
          {/* 右:交易表单(粘性) */}
          <div className="lg:sticky lg:top-20">
            <TradeTabs mint={validMint} compact />
          </div>
        </div>
      )}
    </div>
  );
}
