import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { InviteScreen } from '@/components/invite/invite-screen';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t('invite.page.title') };
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <InviteScreen />;
}
