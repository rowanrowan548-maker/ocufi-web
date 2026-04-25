import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { ComingSoonScreen } from '@/components/launch/coming-soon-screen';

export const metadata: Metadata = {
  title: 'Ocufi · 即将上线',
  description: '非托管 · 低费 · 透明 · 开源的 Solana 链上交易终端',
  robots: { index: false, follow: false },
};

export default async function ComingSoonPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ComingSoonScreen />;
}
