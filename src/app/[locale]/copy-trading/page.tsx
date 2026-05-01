import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CopyTradingView } from '@/components/copy-trading/copy-trading-view';

export default async function CopyTradingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('copyTrading.page');

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-5xl flex flex-col gap-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <CopyTradingView />
      </div>
    </main>
  );
}
