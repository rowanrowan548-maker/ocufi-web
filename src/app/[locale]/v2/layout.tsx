import { setRequestLocale } from 'next-intl/server';
import { TopNavV3 } from '@/components/v2/nav/top-nav-v3';
import { ScrollHint } from '@/components/v2/shared/scroll-hint';

/**
 * V2 layout · 套 V2 nav · 复用 root [locale]/layout 的 Wallet/Theme/i18n
 *
 * 注意:V1 TopNavV2 已加 pathname 早退避免双 nav · 详 top-nav-v2.tsx 顶部
 */
export default async function V2Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <TopNavV3 />
      <ScrollHint />
      {children}
    </>
  );
}
