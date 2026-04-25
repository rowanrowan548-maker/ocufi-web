import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { StatusBoard } from '@/components/status/status-board';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t('status.title') };
}

export default async function StatusPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <StatusBoard />;
}
