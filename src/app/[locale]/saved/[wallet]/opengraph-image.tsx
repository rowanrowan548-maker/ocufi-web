/**
 * P5-FE-26 · /saved/[wallet] · 动态 OG 1200×630
 *
 * 视觉同 V2 tx OG · 黑底 + brand glow + 大字 Saved X SOL + 副标 trades + ocufi.io
 * X / TG / Slack 分享 saved page 时显这张
 *
 * Edge runtime · 不阻塞用户 · OG hit 后端记录(P5-BE-2 og_hits 表)
 */
import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Ocufi · wallet savings ledger';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

type Props = { params: Promise<{ locale: string; wallet: string }> };

const WALLET_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function fmtNum(n: number, dp = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function pickSolDp(n: number): number {
  if (n >= 1) return 3;
  if (n >= 0.001) return 4;
  return 6;
}

function shortAddr(a: string): string {
  return a.length <= 8 ? a : `${a.slice(0, 4)}...${a.slice(-4)}`;
}

async function trackOgHit(path: string): Promise<void> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return;
  try {
    await fetch(`${apiUrl.replace(/\/$/, '')}/og-hit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
  } catch {
    // 静默
  }
}

async function fetchSavings(wallet: string): Promise<{
  savedSol: number;
  savedUsd: number;
  tradeCount: number;
} | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return null;
  try {
    const r = await fetch(
      `${apiUrl.replace(/\/$/, '')}/portfolio/savings?wallet=${encodeURIComponent(wallet)}`,
      { signal: AbortSignal.timeout(2_000) },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as {
      trade_count?: number;
      totals?: { saved_sol?: number; saved_usd?: number };
    };
    return {
      savedSol: j?.totals?.saved_sol ?? 0,
      savedUsd: j?.totals?.saved_usd ?? 0,
      tradeCount: j?.trade_count ?? 0,
    };
  } catch {
    return null;
  }
}

export default async function Image({ params }: Props) {
  const { wallet } = await params;
  await trackOgHit(`/saved/${wallet}/opengraph-image`);

  const isValid = WALLET_RE.test(wallet);
  const data = isValid ? await fetchSavings(wallet) : null;

  const savedSol = data?.savedSol ?? 0;
  const savedUsd = data?.savedUsd ?? 0;
  const tradeCount = data?.tradeCount ?? 0;
  const dp = pickSolDp(savedSol);
  const walletShort = shortAddr(wallet);
  const isPending = !isValid || data == null || tradeCount === 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px',
          background: '#0A0B0D',
          backgroundImage:
            'radial-gradient(circle at 90% 10%, #19FB9B22 0%, transparent 50%), radial-gradient(circle at 5% 95%, #19FB9B14 0%, transparent 50%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#F5F5F2',
        }}
      >
        {/* Top · OCUFI brand · 右上 wallet short */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: '#19FB9B',
            fontSize: '20px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <svg width="36" height="36" viewBox="0 0 32 32">
              <path d="M 16 5 A 11 11 0 0 1 27 16" stroke="#19FB9B" strokeWidth="2.8" fill="none" strokeLinecap="round" />
              <path d="M 16 27 A 11 11 0 0 1 5 16" stroke="#19FB9B" strokeWidth="2.8" fill="none" strokeLinecap="round" />
              <path d="M 27 16 A 11 11 0 0 1 16 27" stroke="#19FB9B" strokeWidth="2.8" fill="none" strokeLinecap="round" opacity="0.3" />
              <path d="M 5 16 A 11 11 0 0 1 16 5" stroke="#19FB9B" strokeWidth="2.8" fill="none" strokeLinecap="round" opacity="0.3" />
              <circle cx="16" cy="16" r="2.2" fill="#19FB9B" />
            </svg>
            <span>OCUFI · WALLET LEDGER</span>
          </div>
          <span>{walletShort}</span>
        </div>

        {/* Mid · 大字 · brand→cyan 渐变 · pending 时显占位 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div
            style={{
              fontSize: isPending ? '88px' : '120px',
              fontWeight: 600,
              letterSpacing: '-0.03em',
              lineHeight: 1.0,
              backgroundImage: 'linear-gradient(135deg, #19FB9B 0%, #03e1ff 100%)',
              backgroundClip: 'text',
              color: 'transparent',
              maxWidth: '1080px',
            }}
          >
            {isPending ? 'No trades yet' : `Saved ${fmtNum(savedSol, dp)} SOL`}
          </div>
          <div
            style={{
              fontSize: '30px',
              color: '#C8C8C5',
              lineHeight: 1.4,
              maxWidth: '1080px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div>
              {isPending
                ? 'Connect a wallet on ocufi.io to start saving'
                : `${tradeCount} trades · 0.10% fee vs 1% industry${savedUsd > 0 ? ` · ≈ $${fmtNum(savedUsd, 2)} saved` : ''}`}
            </div>
            <div>{isPending ? 'Solana · transparency · public on-chain' : 'Solana · transparency · public on-chain'}</div>
          </div>
        </div>

        {/* Footer · url + 副标 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '32px',
            borderTop: '1px solid #2A2E3A',
            fontSize: '22px',
            color: '#8A8A87',
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          <span>{`ocufi.io/saved/${walletShort}`}</span>
          <span>0.10% fee · MEV protected</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
