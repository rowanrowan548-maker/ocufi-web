import { setRequestLocale } from 'next-intl/server';
import { PortfolioView } from '@/components/v2/portfolio/portfolio-view';

export default async function V2PortfolioPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PortfolioView />;
}
