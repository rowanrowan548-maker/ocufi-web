/**
 * V2 /v2/tx/[sig] · P3-FE-1 · 真接 GET /transparency/<sig>
 *
 * - server fetch · 找到 → 渲染真报告
 * - 找不到(404 / 网络错 / 配置缺)→ 渲染 fallback "报告生成中" + retry 按钮
 * - demo sig(MOCK_TX_SIG)始终渲染 mock · 保 nav "Demo" tab 体验
 * - generateMetadata 真数据填 OG title / description · 找不到 fallback 默认
 */
import { setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { TxView, TxViewFallback } from '@/components/v2/tx/tx-view';
import { MOCK_TX_SIG } from '@/components/v2/shared/mock-sig';
import { getTransparencyReport, mapReportToView } from '@/lib/transparency';

// P3-FE-15 Q8 · 散户友好 alias · /v2/tx/demo · /v2/tx/example · /v2/tx/mock 全走 mock 报告
// 让人们可以分享一个稳定的 demo 链路 · 不依赖某个真 sig · 不走 "生成中" polling
const DEMO_ALIASES = new Set(['demo', 'example', 'mock']);
function isDemoSig(sig: string): boolean {
  return sig === MOCK_TX_SIG || DEMO_ALIASES.has(sig.toLowerCase());
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; sig: string }>;
}): Promise<Metadata> {
  const { sig } = await params;
  const short = sig.length >= 12 ? `${sig.slice(0, 6)}...${sig.slice(-4)}` : sig;

  // P5-FE-22 · OG image 显式 absolute URL · 不带 locale prefix · 治 X 抓 /zh-CN/.../opengraph-image 触发
  // next-intl localePrefix=as-needed 去 prefix 307 redirect · X 不 follow → 卡片不显图
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://www.ocufi.io';
  const ogImageUrl = `${baseUrl}/v2/tx/${sig}/opengraph-image`;

  // demo · 用 mockup 文案 · P3-FE-15 Q8 · 接 demo / example / mock alias
  if (isDemoSig(sig)) {
    return {
      title: `Trade #${short} · Ocufi V2 (Demo)`,
      description: 'Transparency report demo · Ocufi · 0.1% fee · MEV protected.',
      openGraph: {
        title: `Saved 0.0045 SOL on BONK · Ocufi`,
        description: `0.5 SOL → 1.23M BONK · vs industry standard 0.5045 SOL · MEV protected`,
        images: [{ url: ogImageUrl, width: 1200, height: 630 }],
      },
      twitter: {
        card: 'summary_large_image',
        images: [ogImageUrl],
      },
    };
  }

  const report = await getTransparencyReport(sig);
  if (!report) {
    return {
      title: `Trade #${short} · Ocufi`,
      description: `Transparency report for Solana trade #${short}.`,
      openGraph: {
        images: [{ url: ogImageUrl, width: 1200, height: 630 }],
      },
      twitter: {
        card: 'summary_large_image',
        images: [ogImageUrl],
      },
    };
  }
  const v = mapReportToView(report);
  const savedFmt = v.savedSol.toFixed(4);
  // P4-FE-2 · OG title + desc 加吸引文案 · 突出 0.1% / 防夹 / 透明度卖点
  const sideLabel = v.side === 'buy' ? 'Bought' : 'Sold';
  const ogTitle = v.savedSol > 0
    ? `Saved ${savedFmt} SOL on $${v.tokenSymbol} · Ocufi`
    : `${sideLabel} $${v.tokenSymbol} on Ocufi · 0.1% fee transparency report`;
  const ogDesc = `${sideLabel} ${v.tokenAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })} $${v.tokenSymbol} · ${v.feePct.toFixed(2)}% fee vs industry standard ${v.competitorFeePct.toFixed(0)}% · route / slippage / network fee${v.mevProtected ? ' / MEV protection' : ''} all public · permanent shareable URL.`;
  return {
    title: `Trade #${short} · Ocufi`,
    description: ogDesc,
    openGraph: {
      title: ogTitle,
      description: ogDesc,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: ogDesc,
      images: [ogImageUrl],
    },
  };
}

export default async function V2TxPage({
  params,
}: {
  params: Promise<{ locale: string; sig: string }>;
}) {
  const { locale, sig } = await params;
  setRequestLocale(locale);

  // demo sig · 永走 mock(nav "Demo" tab 体验保留) · P3-FE-15 Q8 · demo / example / mock alias
  if (isDemoSig(sig)) {
    return <TxView sig={sig} demo />;
  }

  const report = await getTransparencyReport(sig);
  if (!report) {
    return <TxViewFallback sig={sig} />;
  }
  return <TxView sig={sig} data={mapReportToView(report)} />;
}
