import { setRequestLocale } from 'next-intl/server';
import { PortfolioV2View } from '@/components/portfolio-v2/portfolio-v2-view';

// T-UI-OVERHAUL Stage 5.3b · luxury 持仓页双视角
// 老用户:total + savings + breakdown + holdings(展开 reverse-lookup)
// 新用户(trade_count == 0):EmptyStatePortfolio · 不空白 · 教育 + CTA
//
// 数据全在 client 拉(钱包绑定客户端 · 无法 server pre-fetch)
export default async function PortfolioPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <PortfolioV2View />;
}
