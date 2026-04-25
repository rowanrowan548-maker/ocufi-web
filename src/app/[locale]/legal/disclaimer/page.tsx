import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { LegalLayout } from '@/components/legal/legal-layout';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t('legal.disclaimer.title') };
}

export default async function DisclaimerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('legal.disclaimer');
  return (
    <LegalLayout
      title={t('title')}
      lastUpdated={t('lastUpdated')}
      sections={[
        { heading: t('s1.h'), body: t('s1.b') },
        { heading: t('s2.h'), body: t('s2.b') },
        { heading: t('s3.h'), body: t('s3.b') },
        { heading: t('s4.h'), body: t('s4.b') },
        { heading: t('s5.h'), body: t('s5.b') },
      ]}
    />
  );
}
