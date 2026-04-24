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
      <TradeScreen />
    </main>
  );
}
