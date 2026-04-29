import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ChartDemo } from '@/components/trade-preview/chart-demo';
import { RedCandidates } from '@/components/trade-preview/red-candidates';

// T-CHART-DEMO · 临时藏页 · 给用户看自家 K 线效果
// 无 ?demo=1 → 404 防 SEO 收录 · 用户拍板做完整版后整页 git revert
// 用户决定:扩 / 删 → Tech Lead 填
export const dynamic = 'force-dynamic';

export default async function TradePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ demo?: string; mint?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;

  // 隐藏门:无 demo=1 直接 404
  if (sp.demo !== '1') notFound();

  // 默认 BONK(meme · 数据稳 · 蜡烛波动好看)· 可 ?mint= 覆盖
  const mint = sp.mint || 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';

  return (
    <main className="flex flex-1 flex-col px-4 sm:px-6 py-6 max-w-5xl mx-auto w-full">
      <div className="mb-4">
        <div className="text-xs uppercase tracking-wider text-amber-400/80 font-mono">
          T-CHART-DEMO · 临时藏页 · 看完即删
        </div>
        <h1 className="text-2xl font-bold mt-1">自家 K 线 demo · lightweight-charts</h1>
        <p className="text-sm text-muted-foreground mt-2">
          mint: <span className="font-mono text-xs">{mint}</span>
          {' · '}时间段固定 5m · 数据走现有 ocufi-api /chart/ohlc
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          紫色虚线 = 模拟"你的成本价"· 绿三角形 = 模拟"我的买入点"· 真实版会从 portfolio 算
        </p>
      </div>

      <ChartDemo mint={mint} />

      <RedCandidates mint={mint} />
    </main>
  );
}
