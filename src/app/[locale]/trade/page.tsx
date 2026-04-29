import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { TradeScreen } from '@/components/trade/trade-screen';

export default async function TradePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="flex flex-1 flex-col">
      {/* T-SEARCH-FIX · TradeScreen 用 useSearchParams 反应式跟踪 ?mint=,
          需 Suspense 包裹满足 Next 16 SSR/CSR bailout 要求 */}
      <Suspense fallback={null}>
        <TradeScreen />
      </Suspense>
    </main>
  );
}
