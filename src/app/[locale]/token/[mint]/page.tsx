import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TokenDetailView } from '@/components/token/token-detail';

export default async function TokenDetailPage({
  params,
}: {
  params: Promise<{ locale: string; mint: string }>;
}) {
  const { locale, mint } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full flex flex-col items-center gap-4">
        <p className="text-xs text-muted-foreground">{t('token.page.poweredBy')}</p>
        <TokenDetailView mint={mint} />
      </div>
    </main>
  );
}
