'use client';

/**
 * 移动端底部固定 CTA 双按钮(T-505b)
 *
 * 仅 < lg 显示(lg:hidden)。固定 fixed bottom-0,父级移动布局加 pb-20 留空间。
 *
 *  - "交易":outline 按钮,弹底部 Sheet 显示完整 <TradeTabs>(buy/sell/limit)
 *  - "快速买入":品牌绿主色 + ⚡,跳过表单直接 ConfirmDialog
 *      · risk='critical' → disabled,引导去完整流程
 *      · 钱包未连 → 先弹 wallet modal
 *      · 默认参数:localStorage lastBuySolAmount || '0.01' / 推荐滑点 / fast gas
 */
import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useTranslations } from 'next-intl';
import { Zap } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { TradeTabs } from './trade-tabs';
import { QuickBuyConfirm } from './quick-buy-confirm';
import type { OverallRisk, RiskReason } from '@/lib/token-info';

const DEFAULT_AMOUNT = '0.01';
const LAST_AMOUNT_KEY = 'lastBuySolAmount';

interface Props {
  mint: string;
  symbol?: string;
  risk?: OverallRisk;
  reasons?: RiskReason[];
  onPickMint?: (mint: string, side?: 'buy' | 'sell') => void;
}

export function MobileActionBar({
  mint,
  symbol,
  risk,
  reasons,
  onPickMint,
}: Props) {
  const t = useTranslations('trade.mobileAction');
  const wallet = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();

  const [tradeOpen, setTradeOpen] = useState(false);
  const [quickBuyOpen, setQuickBuyOpen] = useState(false);
  const [lastAmount, setLastAmount] = useState(DEFAULT_AMOUNT);

  // 读 localStorage 上次买入量,显示在按钮副标
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(LAST_AMOUNT_KEY);
      if (stored && Number(stored) > 0) setLastAmount(stored);
    } catch {
      /* localStorage 不可用,沿用 default */
    }
  }, [quickBuyOpen]);

  const isCritical = risk === 'critical';

  function handleQuickBuy() {
    if (isCritical) return;
    if (!wallet.connected || !wallet.publicKey) {
      openWalletModal(true);
      return;
    }
    setQuickBuyOpen(true);
  }

  return (
    <>
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t border-border/40 px-3 py-3 grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          onClick={() => setTradeOpen(true)}
          className="h-11"
        >
          {t('trade')}
        </Button>
        <Button
          onClick={handleQuickBuy}
          disabled={isCritical}
          title={isCritical ? t('quickBuyDisabled') : undefined}
          className="h-11 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex flex-col items-center justify-center gap-0 leading-tight"
        >
          <span className="flex items-center gap-1 text-sm font-medium">
            <Zap className="h-4 w-4" />
            {t('quickBuy')}
          </span>
          <span className="text-[10px] font-mono opacity-80">
            {t('quickBuyAmount', { amount: lastAmount })}
          </span>
        </Button>
      </div>

      <Sheet open={tradeOpen} onOpenChange={setTradeOpen}>
        <SheetContent
          side="bottom"
          className="h-[85vh] overflow-auto p-0 rounded-t-xl"
        >
          <SheetHeader>
            <SheetTitle>{t('trade')}</SheetTitle>
          </SheetHeader>
          <div className="p-4 pt-0">
            <TradeTabs
              mint={mint}
              compact
              risk={risk}
              reasons={reasons}
              onPickMint={onPickMint}
            />
          </div>
        </SheetContent>
      </Sheet>

      <QuickBuyConfirm
        open={quickBuyOpen}
        onOpenChange={setQuickBuyOpen}
        mint={mint}
        symbol={symbol}
        risk={risk}
        reasons={reasons}
      />
    </>
  );
}
