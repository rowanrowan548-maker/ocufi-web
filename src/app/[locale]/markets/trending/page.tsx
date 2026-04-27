import { setRequestLocale } from 'next-intl/server';
import { ComingSoonView } from '@/components/common/coming-soon-view';

export default async function TrendingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <ComingSoonView
      iconName="TrendingUp"
      titleKey="nav.trending"
      descKey="comingSoon.trendingDesc"
    />
  );
}
