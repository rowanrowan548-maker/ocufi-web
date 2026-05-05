'use client';

/**
 * 双层交易面板:
 *   外层 Buy / Sell
 *   内层 市价 / 限价
 *
 * mint===SOL 特殊处理:不能 SOL→SOL,改成"用 USDC/USDT 买 SOL"快捷入口,
 *   实际是路由到 /trade?mint=USDC&side=sell(USDC 页的卖出 = 用 USDC 换 SOL)
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, DollarSign } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BuyForm } from './buy-form';
import { SellForm } from './sell-form';
import { LimitForm } from '@/components/limit/limit-form';
import { SOL_MINT } from '@/lib/preset-tokens';
import type { OverallRisk, RiskReason } from '@/lib/token-info';

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

interface Props {
  mint?: string;
  compact?: boolean;
  onLimitOrderCreated?: () => void;
  /** 上层 trade-screen 已经 fetch 过 detail,把 risk 传下来给确认弹窗用 */
  risk?: OverallRisk;
  /** 风险原因列表(由 trade-screen 算好) */
  reasons?: RiskReason[];
  /** 默认 tab,从 ?side= URL 读 */
  defaultSide?: 'buy' | 'sell';
  /** 上层(trade-screen)切换 mint + side 的回调 — SOL 页"用 USDC 买 SOL"按钮调用 */
  onPickMint?: (mint: string, side: 'buy' | 'sell') => void;
  /**
   * V2 用 · 砍内层"市价/限价" tab · 完全不渲染 LimitForm · 满足 MUST NOT DO 第 5 条
   * 默认 false 保 V1 兼容 · V2 wrapper 必须传 true
   */
  marketOnly?: boolean;
  /**
   * P2-CARD-UNIFY · V2 wrapper 已套 .v2-card 外 chrome · 砍 V1 内 Card chrome
   * 防双 chrome 嵌套致真手机 4 卡参差 · 默 false 保 V1 trade-screen / mobile-action-bar 视觉
   */
  chromeless?: boolean;
  /** P3-FE-2 · swap confirm 后回调真 sig · 透传给 BuyForm/SellForm */
  onSuccess?: (sig: string) => void;
}

type Side = 'buy' | 'sell';
type OrderType = 'market' | 'limit';

// P2-CARD-UNIFY · 砍 shadcn Card 默 chrome(bg-card / ring / rounded / py-4 / gap-4 / overflow-hidden)
// Tailwind v4 后缀 ! · 战胜 cn() merge 后的默类
const CHROMELESS_CARD = 'w-full flex flex-col h-full bg-transparent! ring-0! rounded-none! py-0! gap-0! overflow-visible!';

export function TradeTabs({ mint, compact, onLimitOrderCreated, risk, reasons, defaultSide, onPickMint, marketOnly, chromeless, onSuccess }: Props = {}) {
  const t = useTranslations();
  const [side, setSide] = useState<Side>(defaultSide ?? 'buy');
  const [orderType, setOrderType] = useState<OrderType>('market');

  // 外部 defaultSide 变化时同步
  useEffect(() => {
    if (defaultSide) setSide(defaultSide);
  }, [defaultSide]);

  // mint===SOL:跳转用别的稳定币买 SOL(/trade?mint=USDC&side=sell)
  if (mint === SOL_MINT) {
    return (
      <Card className={chromeless ? CHROMELESS_CARD : compact ? 'p-4' : 'p-6 w-full max-w-xl'}>
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-sm font-medium">{t('trade.buySol.title')}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {t('trade.buySol.subtitle')}
            </div>
          </div>
          <div className="space-y-2">
            <Button
              onClick={() => onPickMint?.(USDC_MINT, 'sell')}
              variant="outline"
              className="w-full justify-between"
            >
              <span className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                {t('trade.buySol.withUsdc')}
              </span>
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => onPickMint?.(USDT_MINT, 'sell')}
              variant="outline"
              className="w-full justify-between"
            >
              <span className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                {t('trade.buySol.withUsdt')}
              </span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-[11px] text-muted-foreground/70 text-center pt-2 border-t border-border/40">
            {t('trade.buySol.hint')}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={chromeless ? CHROMELESS_CARD : compact ? 'p-2 flex flex-col h-full' : 'p-6 w-full max-w-xl'}>
      {/* 外层 Buy/Sell · T-BRAND-COLOR-ROLLOUT · 用 --brand-up / --brand-down token
          双前缀 dark:data-active: + ! 后缀仍保留(战胜 ui/tabs.tsx 基类 dark variant specificity) */}
      <Tabs value={side} onValueChange={(v) => v && setSide(v as Side)}>
        <TabsList className={compact ? 'grid w-full grid-cols-2 mb-2 h-8 bg-transparent gap-1 p-0' : 'grid w-full grid-cols-2 mb-3 bg-transparent gap-1.5 p-0'}>
          <TabsTrigger
            value="buy"
            className={[
              compact ? 'text-xs h-8' : 'h-9',
              'rounded-md border font-medium transition-colors',
              'bg-transparent border-border/40 text-muted-foreground hover:bg-muted/40 hover:text-foreground',
              'data-active:bg-[var(--brand-up)]/15! data-active:text-[var(--brand-up)]! data-active:border-[var(--brand-up)]/60!',
              'dark:data-active:bg-[var(--brand-up)]/15! dark:data-active:text-[var(--brand-up)]! dark:data-active:border-[var(--brand-up)]/60!',
            ].join(' ')}
          >
            {t('trade.tabs.buy')}
          </TabsTrigger>
          <TabsTrigger
            value="sell"
            className={[
              compact ? 'text-xs h-8' : 'h-9',
              'rounded-md border font-medium transition-colors',
              'bg-transparent border-border/40 text-muted-foreground hover:bg-muted/40 hover:text-foreground',
              'data-active:bg-[var(--brand-down)]/15! data-active:text-[var(--brand-down)]! data-active:border-[var(--brand-down)]/60!',
              'dark:data-active:bg-[var(--brand-down)]/15! dark:data-active:text-[var(--brand-down)]! dark:data-active:border-[var(--brand-down)]/60!',
            ].join(' ')}
          >
            {t('trade.tabs.sell')}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* T-977g · compact 模式让内层 Tabs 包成 flex-1 flex-col,确保按钮粘底 */}
      <div className={compact ? 'flex-1 flex flex-col' : ''}>
        {marketOnly ? (
          // V2 模式 · MUST NOT DO 第 5 条 · 不渲染限价单 + 不显市价/限价 tab
          // 直接挂 BuyForm / SellForm · 内层 tab 完全砍 · chromeless 透传 V2 .v2-card 接管
          side === 'buy' ? (
            <BuyForm mint={mint} compact risk={risk} reasons={reasons} chromeless={chromeless} onSuccess={onSuccess} />
          ) : (
            <SellForm mint={mint} compact risk={risk} reasons={reasons} chromeless={chromeless} onSuccess={onSuccess} />
          )
        ) : (
          // V1 模式 · 完整 市价/限价
          <Tabs value={orderType} onValueChange={(v) => v && setOrderType(v as OrderType)} className={compact ? 'flex-1 flex flex-col' : undefined}>
            <TabsList className={compact
              ? 'bg-transparent border-b border-border/40 rounded-none w-full justify-start gap-3 px-0 mb-2 h-auto'
              : 'bg-transparent border-b border-border/40 rounded-none w-full justify-start gap-5 px-0 mb-4 h-auto'}>
              <TabsTrigger
                value="market"
                className={`px-0 ${compact ? 'py-1 text-xs' : 'py-2'} rounded-none border-b-2 border-transparent data-[selected=true]:bg-transparent data-[selected=true]:text-foreground data-[selected=true]:border-primary`}
              >
                {t('trade.orderType.market')}
              </TabsTrigger>
              <TabsTrigger
                value="limit"
                className={`px-0 ${compact ? 'py-1 text-xs' : 'py-2'} rounded-none border-b-2 border-transparent data-[selected=true]:bg-transparent data-[selected=true]:text-foreground data-[selected=true]:border-primary`}
              >
                {t('trade.orderType.limit')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="market" className={compact ? 'flex-1 flex flex-col' : undefined}>
              {side === 'buy' ? (
                <BuyForm mint={mint} compact risk={risk} reasons={reasons} chromeless={chromeless} onSuccess={onSuccess} />
              ) : (
                <SellForm mint={mint} compact risk={risk} reasons={reasons} chromeless={chromeless} onSuccess={onSuccess} />
              )}
            </TabsContent>
            <TabsContent value="limit" className={compact ? 'flex-1 flex flex-col' : undefined}>
              <LimitForm
                mint={mint}
                side={side}
                compact
                onCreated={onLimitOrderCreated}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </Card>
  );
}
