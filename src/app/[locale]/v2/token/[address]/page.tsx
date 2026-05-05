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
}: {
  params: Promise<{ locale: string; address: string }>;
}) {
  const { locale, address } = await params;
  setRequestLocale(locale);

  if (!MINT_RE.test(address)) notFound();

  let detail;
  try {
    detail = await fetchTokenDetail(address);
  } catch {
    notFound();
  }

  return (
    <main>
      <div
        className="v2-token-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 360px',
          gap: 24,
          maxWidth: 1320,
          margin: '0 auto',
          padding: '32px 56px 80px',
        }}
      >
        <div className="v2-token-main" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <TokenHead detail={detail} />
          <TokenChart mint={detail.mint} symbol={detail.symbol || 'TOKEN'} />
          <TokenTradeShell mint={detail.mint} />
        </div>
        <TokenSideShell mint={detail.mint} />
      </div>
    </main>
  );
}
