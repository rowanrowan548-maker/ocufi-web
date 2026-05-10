/**
 * P5-FE-26 · /saved/[wallet] · 钱包累计省钱总账公开页 · OG 友好
 *
 * - server fetch /portfolio/savings · saved + trade_count 真值
 * - OG meta absolute URL 不带 locale prefix(治 P5-FE-22 X 卡片不显图)
 * - 找不到 wallet / 0 trade · 渲染 fallback 空态
 */
import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchPortfolioSavings, type PortfolioSavingsResponse } from '@/lib/api-client';

const WALLET_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function shortAddr(a: string): string {
  return a.length <= 8 ? a : `${a.slice(0, 4)}...${a.slice(-4)}`;
}

function fmtSol(n: number, dp = 4): string {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(dp);
}

function pickSolDp(n: number): number {
  if (n >= 1) return 3;
  if (n >= 0.001) return 4;
  return 6;
}

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; wallet: string }>;
}): Promise<Metadata> {
  const { wallet } = await params;
  const short = shortAddr(wallet);

  // P5-FE-22 / P5-FE-26 · OG image absolute URL · 不带 locale prefix · 治 next-intl as-needed redirect
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://www.ocufi.io';
  const ogImageUrl = `${baseUrl}/saved/${wallet}/opengraph-image`;

  if (!WALLET_RE.test(wallet)) {
    return {
      title: `Saved · Ocufi`,
      description: 'Wallet savings ledger on Ocufi · Solana trading terminal · 0.10% fee.',
    };
  }

  return {
    title: `${short} · Saved on Ocufi`,
    description: `Solana wallet savings ledger · 0.10% fee vs 1% industry · public on-chain.`,
    openGraph: {
      title: `${short} · Saved on Ocufi`,
      description: `Solana wallet savings ledger · 0.10% fee vs 1% industry · public on-chain.`,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${short} · Saved on Ocufi`,
      description: `Solana wallet savings ledger · 0.10% fee vs 1% industry.`,
      images: [ogImageUrl],
    },
  };
}

export default async function SavedPage({
  params,
}: {
  params: Promise<{ locale: string; wallet: string }>;
}) {
  const { locale, wallet } = await params;
  setRequestLocale(locale);

  if (!WALLET_RE.test(wallet)) notFound();

  const t = await getTranslations('v2.saved');

  let data: PortfolioSavingsResponse | null = null;
  try {
    data = await fetchPortfolioSavings(wallet);
  } catch {
    data = null;
  }

  const tradeCount = data?.trade_count ?? 0;
  const savedSol = data?.totals?.saved_sol ?? 0;
  const savedUsd = data?.totals?.saved_usd ?? 0;
  const dp = pickSolDp(savedSol);
  const short = shortAddr(wallet);

  return (
    <main style={{ maxWidth: 920, margin: '0 auto', padding: '64px 24px 80px' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 40 }}>
        <div
          style={{
            fontSize: 12,
            color: 'var(--ink-40)',
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {t('subTitle')}
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-geist), system-ui, sans-serif',
            fontSize: 'clamp(28px, 5vw, 40px)',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            margin: 0,
            color: 'var(--ink-100)',
          }}
        >
          {short}
        </h1>
      </header>

      {tradeCount === 0 ? (
        <section
          className="v2-card-glow"
          style={{
            padding: '40px 32px',
            borderRadius: 20,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontSize: 'clamp(20px, 4vw, 28px)',
              color: 'var(--brand-up)',
              marginBottom: 16,
            }}
          >
            {t('noTrades', { wallet: short })}
          </div>
          <Link
            href="/"
            style={{
              display: 'inline-block',
              marginTop: 8,
              padding: '12px 24px',
              borderRadius: 10,
              background: 'var(--brand-up)',
              color: '#000',
              fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
              fontSize: 14,
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            {t('cta')}
          </Link>
        </section>
      ) : (
        <>
          {/* hero · 累计省下 */}
          <section
            className="v2-card-glow"
            style={{
              padding: '40px 36px',
              borderRadius: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              maxWidth: 720,
              animation: 'v2-float 5s ease-in-out infinite',
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: 'var(--ink-40)',
                fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {t('savedLabel')}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                fontSize: 'clamp(48px, 9vw, 88px)',
                color: 'var(--brand-up)',
                letterSpacing: '-0.03em',
                lineHeight: 1,
              }}
            >
              {fmtSol(savedSol, dp)} SOL
            </div>
            <div
              style={{
                fontSize: 14,
                color: 'var(--ink-60)',
                fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
                display: 'flex',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <span>{t('usdLabel', { usd: fmtUsd(savedUsd > 0 ? savedUsd : null) })}</span>
              <span>·</span>
              <span>{t('tradeCountLabel', { n: String(tradeCount) })}</span>
            </div>
          </section>

          {/* 脚注 · 不点名竞品 */}
          <div
            style={{
              marginTop: 14,
              fontSize: 12,
              color: 'var(--ink-40)',
              fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
              maxWidth: 720,
            }}
          >
            {t('footnote')}
          </div>

          {/* CTA · 去 Ocufi 一键交易 */}
          <div style={{ marginTop: 32, maxWidth: 720 }}>
            <Link
              href="/"
              style={{
                display: 'inline-block',
                padding: '14px 28px',
                borderRadius: 10,
                background: 'var(--brand-up)',
                color: '#000',
                fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
                fontSize: 14,
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              {t('cta')}
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
