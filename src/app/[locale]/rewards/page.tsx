import { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { RewardsV2View } from '@/components/rewards-v2/rewards-v2-view';

// T-UI-OVERHAUL Stage 5.3c · luxury 奖励页 · 2 tab(回收 SOL · MEV 保护)
// 邀请返佣移到 ⋯ MoreMenu(等 Stage 5.4 nav 改造)· 旧 components/rewards/* 文件保留

export const metadata: Metadata = {
  title: '奖励 · Ocufi',
  description: '回收 ATA 押金 · MEV 保护节省 · 真金白银留在你账户里',
};

export const dynamic = 'force-dynamic';

export default async function RewardsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <RewardsV2View />;
}
