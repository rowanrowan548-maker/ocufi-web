import { setRequestLocale } from 'next-intl/server';
import { LandingV2View } from '@/components/landing-v2/landing-v2-view';
import { fetchPublicStats, type PublicStats } from '@/lib/api-client';

// T-UI-OVERHAUL Stage 5.3a · luxury dark glass 首页
//   - 服务端拉 /public_stats(Social section 用)· 失败兜底 null
//   - 客户端 LandingV2View · 钱包已连 → router.replace('/portfolio')
//   - 没连 → 5 屏 cold-start landing

// T-PERF · 24h 缓存 public stats(增长慢 · 24h 一次足够)
export const revalidate = 86400;

export default async function Landing({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let publicStats: PublicStats | null = null;
  try {
    publicStats = await fetchPublicStats();
  } catch {
    // 后端挂 / 无 NEXT_PUBLIC_API_URL · 兜底 null · LandingV2View 显 0
    publicStats = null;
  }

  return <LandingV2View publicStats={publicStats} />;
}
