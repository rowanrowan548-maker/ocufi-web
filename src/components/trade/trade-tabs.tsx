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
import type { OverallRisk } from '@/lib/token-info';

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

interface Props {
  mint?: string;
  compact?: boolean;
  onLimitOrderCreated?: () => void;
  /** 上层 trade-screen 已经 fetch 过 detail,把 risk 传下来给确认弹窗用 */
  risk?: OverallRisk;
  /** 默认 tab,从 ?side= URL 读 */
  defaultSide?: 'buy' | 'sell';
  /** 上层(trade-screen)切换 mint + side 的回调 — SOL 页"用 USDC 买 SOL"按钮调用 */
  onPickMint?: (mint: string, side: 'buy' | 'sell') => void;
}

type Side = 'buy' | 'sell';
type OrderType = 'market' | 'limit';

export function TradeTabs({ mint, compact, onLimitOrderCreated, risk, defaultSide, onPickMint }: Props = {}) {
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
      <Card className={compact ? 'p-4' : 'p-6 w-full max-w-xl'}>
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
    <Card className={compact ? 'p-3 sm:p-4' : 'p-6 w-full max-w-xl'}>
      {/* 外层 Buy/Sell */}
      <Tabs value={side} onValueChange={(v) => v && setSide(v as Side)}>
        <TabsList className="grid w-full grid-cols-2 mb-3">
          <TabsTrigger value="buy">{t('trade.tabs.buy')}</TabsTrigger>
          <TabsTrigger value="sell">{t('trade.tabs.sell')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 内层 市价/限价 */}
      <Tabs value={orderType} onValueChange={(v) => v && setOrderType(v as OrderType)}>
        <TabsList className="bg-transparent border-b border-border/40 rounded-none w-full justify-start gap-5 px-0 mb-4 h-auto">
          <TabsTrigger
            value="market"
            className="px-0 py-2 rounded-none border-b-2 border-transparent data-[selected=true]:bg-transparent data-[selected=true]:text-foreground data-[selected=true]:border-primary"
          >
            {t('trade.orderType.market')}
          </TabsTrigger>
          <TabsTrigger
            value="limit"
            className="px-0 py-2 rounded-none border-b-2 border-transparent data-[selected=true]:bg-transparent data-[selected=true]:text-foreground data-[selected=true]:border-primary"
          >
            {t('trade.orderType.limit')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="market">
          {side === 'buy' ? (
            <BuyForm mint={mint} compact risk={risk} />
          ) : (
            <SellForm mint={mint} compact risk={risk} />
          )}
        </TabsContent>
        <TabsContent value="limit">
          <LimitForm
            mint={mint}
            side={side}
            compact
            onCreated={onLimitOrderCreated}
          />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
