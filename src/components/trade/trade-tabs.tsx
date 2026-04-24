'use client';

/**
 * 双层交易面板:
 *   外层 Buy / Sell
 *   内层 市价 / 限价
 */
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BuyForm } from './buy-form';
import { SellForm } from './sell-form';
import { LimitForm } from '@/components/limit/limit-form';

interface Props {
  mint?: string;
  compact?: boolean;
  onLimitOrderCreated?: () => void;
}

type Side = 'buy' | 'sell';
type OrderType = 'market' | 'limit';

export function TradeTabs({ mint, compact, onLimitOrderCreated }: Props = {}) {
  const t = useTranslations();
  const [side, setSide] = useState<Side>('buy');
  const [orderType, setOrderType] = useState<OrderType>('market');

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
            <BuyForm mint={mint} compact />
          ) : (
            <SellForm mint={mint} compact />
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
