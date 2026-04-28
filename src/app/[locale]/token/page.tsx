import { setRequestLocale } from 'next-intl/server';
import { TokenRadarScreen } from '@/components/token/token-radar-screen';

export default async function TokenSearchPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <TokenRadarScreen />;
}
