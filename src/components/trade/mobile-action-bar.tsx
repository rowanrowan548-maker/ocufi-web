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
import { Zap, Settings2 } from 'lucide-react';

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
const PRESETS = ['0.01', '0.05', '0.1', '0.5', '1'] as const;
const MIN_AMOUNT = 0.001;
const MAX_AMOUNT = 1000; // 上限只是兜底,真正校验在 BuyForm / Quote / 钱包余额

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lastAmount, setLastAmount] = useState(DEFAULT_AMOUNT);
  const [customInput, setCustomInput] = useState('');

  // 读 localStorage 上次买入量,显示在按钮副标
  // 依赖 quickBuyOpen / settingsOpen:每次关弹窗后回读,捕获 BuyForm 或设置面板的写入
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(LAST_AMOUNT_KEY);
      if (stored && Number(stored) > 0) setLastAmount(stored);
    } catch {
      /* localStorage 不可用,沿用 default */
    }
  }, [quickBuyOpen, settingsOpen]);

  const isCritical = risk === 'critical';

  function handleQuickBuy() {
    if (isCritical) return;
    if (!wallet.connected || !wallet.publicKey) {
      openWalletModal(true);
      return;
    }
    setQuickBuyOpen(true);
  }

  function persistAmount(value: string) {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LAST_AMOUNT_KEY, value);
      }
    } catch { /* localStorage 满 / 隐私模式 */ }
    setLastAmount(value);
  }

  function pickPreset(value: string) {
    persistAmount(value);
    setSettingsOpen(false);
  }

  function applyCustom() {
    const trimmed = customInput.trim();
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < MIN_AMOUNT || n > MAX_AMOUNT) return;
    persistAmount(String(n));
    setCustomInput('');
    setSettingsOpen(false);
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

        {/* 右侧 cell 拆两块:大按钮(快速买入,~85%)+ 齿轮(设置,~15%) */}
        <div className="flex gap-1">
          <Button
            onClick={handleQuickBuy}
            disabled={isCritical}
            title={isCritical ? t('quickBuyDisabled') : undefined}
            className="flex-1 h-11 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex flex-col items-center justify-center gap-0 leading-tight px-2"
          >
            <span className="flex items-center gap-1 text-sm font-medium">
              <Zap className="h-4 w-4" />
              {t('quickBuy')}
            </span>
            <span className="text-[10px] font-mono opacity-80">
              {t('quickBuyAmount', { amount: lastAmount })}
            </span>
          </Button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label={t('quickBuySettings')}
            className="h-11 w-9 rounded-md border border-border/60 bg-background hover:bg-muted/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Sheet open={tradeOpen} onOpenChange={setTradeOpen}>
        <SheetContent
          side="bottom"
          className="h-[85vh] p-0 rounded-t-xl flex flex-col gap-0"
        >
          {/* BUG-031c:用 shadcn 默认 close button(absolute top-3 right-3,
              脱离文档流,长内容也永远可见)+ SheetHeader 提供无障碍语义 */}
          <SheetHeader className="flex flex-row items-center bg-popover border-b border-border/40 px-4 py-3 flex-shrink-0 space-y-0 gap-0 pr-12">
            <SheetTitle className="text-base">
              {t('tradeSheetTitle')}
            </SheetTitle>
          </SheetHeader>
          {/* 内容区独立滚动,SheetHeader 永远在视口顶 */}
          <div className="flex-1 overflow-y-auto p-4">
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

      {/* 快速买入金额设置 · BUG-034b:暴露可视入口 */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent
          side="bottom"
          className="p-0 rounded-t-xl flex flex-col max-h-[60vh] gap-0"
        >
          <SheetHeader className="flex flex-row items-center bg-popover border-b border-border/40 px-4 py-3 flex-shrink-0 space-y-0 gap-0 pr-12">
            <SheetTitle className="text-base">{t('quickBuySettings')}</SheetTitle>
          </SheetHeader>
          <div className="p-4 space-y-4 overflow-y-auto">
            <div className="grid grid-cols-5 gap-2">
              {PRESETS.map((p) => {
                const active = lastAmount === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => pickPreset(p)}
                    className={`h-11 rounded-md border text-sm font-mono transition-colors ${
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/60 hover:border-primary/40 hover:bg-muted/30'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                {t('customAmount')}
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.001"
                  min={MIN_AMOUNT}
                  max={MAX_AMOUNT}
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="0.05"
                  className="flex-1 h-11 px-3 rounded-md border border-border/60 bg-background text-sm font-mono focus:outline-none focus:border-primary/50"
                />
                <Button
                  onClick={applyCustom}
                  disabled={(() => {
                    const n = Number(customInput);
                    return !Number.isFinite(n) || n < MIN_AMOUNT || n > MAX_AMOUNT;
                  })()}
                  className="h-11"
                >
                  {t('apply')}
                </Button>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground/80 text-center pt-1 border-t border-border/40">
              {t('amountSavedHint')}
            </div>
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
