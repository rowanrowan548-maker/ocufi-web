import { setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { AdminScreen } from '@/components/admin/admin-screen';

export const metadata: Metadata = {
  title: 'Admin · Ocufi',
  robots: { index: false, follow: false }, // 不让搜索引擎收录
};

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminScreen />;
}
