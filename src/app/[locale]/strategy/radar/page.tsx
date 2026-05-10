import { setRequestLocale } from 'next-intl/server';
import { ComingSoonView } from '@/components/common/coming-soon-view';

export default async function RadarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <ComingSoonView
      iconName="Radar"
      titleKey="nav.smartMoney"
      descKey="comingSoon.radarDesc"
    />
  );
}
