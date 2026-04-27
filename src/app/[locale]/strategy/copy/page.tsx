import { setRequestLocale } from 'next-intl/server';
import { ComingSoonView } from '@/components/common/coming-soon-view';

export default async function CopyTradePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <ComingSoonView
      iconName="Users"
      titleKey="nav.copyTrade"
      descKey="comingSoon.copyDesc"
    />
  );
}
