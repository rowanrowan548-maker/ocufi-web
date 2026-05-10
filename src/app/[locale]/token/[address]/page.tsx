import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchTokenDetail } from '@/lib/token-info';
import { TokenHead } from '@/components/v2/token/token-head';
import { TokenChart } from '@/components/v2/token/token-chart';
import { TokenTradeShell } from '@/components/v2/token/token-trade-shell';
import { TokenSideShell } from '@/components/v2/token/token-side-shell';

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; address: string }>;
}): Promise<Metadata> {
  const { address } = await params;
  if (!MINT_RE.test(address)) return { title: 'Token · Ocufi' };
  try {
    const detail = await fetchTokenDetail(address);
    return {
      title: `${detail.symbol} · Ocufi V2`,
      description: `${detail.symbol} on Ocufi · 0.1% fee · MEV protected · Solana on-chain.`,
    };
  } catch {
    return { title: 'Token · Ocufi' };
  }
}

export default async function V2TokenPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; address: string }>;
  searchParams: Promise<{ action?: string }>;
}) {
  const { locale, address } = await params;
  const { action } = await searchParams;
  setRequestLocale(locale);

  if (!MINT_RE.test(address)) notFound();

  let detail;
  try {
    detail = await fetchTokenDetail(address);
  } catch {
    notFound();
  }

  // P2-HOTFIX · 持仓行 click → /v2/token/<mint>?action=sell · 默认 Sell tab
  const defaultSide: 'buy' | 'sell' | undefined = action === 'sell' ? 'sell' : action === 'buy' ? 'buy' : undefined;

  return (
    <main>
      {/* P2-HOTFIX-3 #1 · jup.ag 模式 · 桌面左 60% (head + chart + audit) + 右 40% (trade card sticky)
         mobile 单列堆叠靠 .v2-token-grid 媒查 · 顺序:head → chart → trade → audit */}
      <div
        className="v2-token-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 380px',
          gap: 28,
          maxWidth: 1320,
          margin: '0 auto',
          padding: '32px 56px 80px',
          alignItems: 'start',
        }}
      >
        <div className="v2-token-main" style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          <TokenHead detail={detail} />
          <TokenChart mint={detail.mint} symbol={detail.symbol || 'TOKEN'} />
          <TokenSideShell mint={detail.mint} />
        </div>
        {/* 右栏 trade card · sticky · 桌面 jup.ag 模式 · mobile 媒查 unstick + order */}
        <div
          className="v2-token-trade-col"
          style={{
            position: 'sticky',
            top: 92, // sticky nav 76 + 16 buffer
            alignSelf: 'start',
          }}
        >
          <TokenTradeShell mint={detail.mint} defaultSide={defaultSide} />
        </div>
      </div>
    </main>
  );
}
