import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TradeTabs } from '@/components/trade/trade-tabs';

export default async function TradePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-xl flex flex-col items-center gap-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {t('trade.page.title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('trade.page.subtitle')}</p>
        </div>
        <TradeTabs />
      </div>
    </main>
  );
}
