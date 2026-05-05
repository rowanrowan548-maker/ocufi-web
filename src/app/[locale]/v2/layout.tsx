import { setRequestLocale } from 'next-intl/server';
import { TopNavV3 } from '@/components/v2/nav/top-nav-v3';
import { BottomTabBar } from '@/components/v2/nav/bottom-tab-bar';
import { ScrollHint } from '@/components/v2/shared/scroll-hint';

/**
 * V2 layout · 套 V2 top nav + mobile bottom tab bar · 复用 root [locale]/layout 的 Wallet/Theme/i18n
 *
 * 注意:V1 TopNavV2 已加 pathname 早退避免双 nav · 详 top-nav-v2.tsx 顶部
 *
 * P2-HOTFIX-2 #5:mobile 砍抽屉 → BottomTabBar(Phantom/Twitter/Jupiter 都这样)
 *   桌面 BottomTabBar 走 .v2-bottom-tab-bar 媒查 hide
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
      <BottomTabBar />
    </>
  );
}
