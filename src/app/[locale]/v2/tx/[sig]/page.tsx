import { setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { TxView } from '@/components/v2/tx/tx-view';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; sig: string }>;
}): Promise<Metadata> {
  const { sig } = await params;
  const short = sig.length >= 12 ? `${sig.slice(0, 6)}...${sig.slice(-4)}` : sig;
  return {
    title: `Trade #${short} · Ocufi V2`,
    description: `Transparency report for Solana trade #${short} on Ocufi · 0.1% fee · MEV protected.`,
    openGraph: {
      title: `Saved 0.0045 SOL on BONK · Ocufi`,
      description: `0.5 SOL → 1.23M BONK · vs BullX 0.5045 SOL · MEV protected`,
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

  return <TxView sig={sig} />;
}
