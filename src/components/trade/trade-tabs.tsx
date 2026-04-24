'use client';

import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BuyForm } from './buy-form';
import { SellForm } from './sell-form';

interface Props {
  /** 受控 mint(由 trade-screen 传入,form 隐藏自己的 mint 输入) */
  mint?: string;
  /** 紧凑模式(无最大宽限制,适配右栏布局) */
  compact?: boolean;
}

export function TradeTabs({ mint, compact }: Props = {}) {
  const t = useTranslations();
  return (
    <Tabs defaultValue="buy" className={compact ? 'w-full' : 'w-full max-w-xl'}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="buy">{t('trade.tabs.buy')}</TabsTrigger>
        <TabsTrigger value="sell">{t('trade.tabs.sell')}</TabsTrigger>
      </TabsList>
      <TabsContent value="buy" className="mt-4">
        <BuyForm mint={mint} compact={compact} />
      </TabsContent>
      <TabsContent value="sell" className="mt-4">
        <SellForm mint={mint} compact={compact} />
      </TabsContent>
    </Tabs>
  );
}
