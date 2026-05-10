import { setRequestLocale } from 'next-intl/server';
import { HomeHero } from '@/components/v2/home/home-hero';
import { HomePillars } from '@/components/v2/home/home-pillars';

export const revalidate = 60; // ISR · /public/stats / trending 60s 刷新

export default async function V2Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main>
      <HomeHero />
      <HomePillars />
    </main>
  );
}
