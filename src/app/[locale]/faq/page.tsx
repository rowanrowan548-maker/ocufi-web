import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FaqView } from '@/components/faq/faq-view';
import { FaqSearch } from '@/components/faq/faq-search';

export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-3xl flex flex-col gap-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {t('faq.page.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('faq.page.subtitle')}
          </p>
        </div>
        <FaqSearch />
        <FaqView />
      </div>
    </main>
  );
}
