'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { LimitForm } from '@/components/limit/limit-form';
import { OrderList } from '@/components/limit/order-list';

export default function LimitPage() {
  const t = useTranslations();
  const [refreshTick, setRefreshTick] = useState(0);

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <div className="w-full flex flex-col items-center gap-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {t('limit.page.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('limit.page.subtitle')}
          </p>
        </div>

        <LimitForm onCreated={() => setRefreshTick((t) => t + 1)} />

        <OrderList refreshTick={refreshTick} />
      </div>
    </main>
  );
}
