import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PointsView } from '@/components/points/points-view';

export default async function PointsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <div className="w-full flex flex-col items-center gap-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {t('points.page.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('points.page.subtitle')}
          </p>
        </div>
        <PointsView />
      </div>
    </main>
  );
}
