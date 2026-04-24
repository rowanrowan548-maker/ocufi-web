'use client';

import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BuyForm } from './buy-form';
import { SellForm } from './sell-form';

export function TradeTabs() {
  const t = useTranslations();
  return (
    <Tabs defaultValue="buy" className="w-full max-w-xl">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="buy">{t('trade.tabs.buy')}</TabsTrigger>
        <TabsTrigger value="sell">{t('trade.tabs.sell')}</TabsTrigger>
      </TabsList>
      <TabsContent value="buy" className="mt-4">
        <BuyForm />
      </TabsContent>
      <TabsContent value="sell" className="mt-4">
        <SellForm />
      </TabsContent>
    </Tabs>
  );
}
