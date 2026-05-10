import { setRequestLocale } from 'next-intl/server';
import { ReportsView } from '@/components/v2/reports/reports-view';

export default async function V2ReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ReportsView />;
}
