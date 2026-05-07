/**
 * V2 /v2/tx/[sig] · 动态 OG 图(P3-FE-1 / P4-FE-2)
 * 真数据填 · 找不到 sig fallback · demo sig 用 mock 文案
 *
 * Twitter / TG / Slack 分享时显示这张 1200×630 卡 · 文案:
 *   - "Saved 0.0045 SOL on $BONK · vs BullX 1%"
 *   - 下方副标:数量 + 防夹保护 + 路由
 *
 * P4-FE-2 · server side fetch V1 后端 /price/<mint> 拿真 logo + 真 symbol
 *   · 后端 birdeye proxy(server BIRDEYE_API_KEY)
 *   · 渲染 <img src={logoURI}> 64×64 圆头像 · 散户一眼认出币种
 */
import { ImageResponse } from 'next/og';
import { getTransparencyReport, mapReportToView } from '@/lib/transparency';
import { MOCK_TX_SIG } from '@/components/v2/shared/mock-sig';

export const runtime = 'edge';

export const alt = 'Ocufi · transparency report';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

type Props = { params: Promise<{ locale: string; sig: string }> };

function fmtNum(n: number, dp = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

// P5-FE-15 改 2 · 真记 OG 抓取 · 后端 /og-hit (P5-BE-2 ship · 写 og_hits 表)
// P5-FE-16 修:后端真路径是 /og-hit(无 admin 前缀)
// P5-FE-17 修:必须 await · Edge Runtime 在 response 返回后立即终止 worker · fire-and-forget 永远不真发
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
    // 静默 · 后端不可用不阻塞图返回
  }
}

// P4-FE-2 · server side fetch · edge runtime · 标准 fetch · 不依赖 api-client cache
async function fetchTokenMeta(mint: string): Promise<{ symbol: string | null; logoURI: string | null }> {
  if (!mint) return { symbol: null, logoURI: null };
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return { symbol: null, logoURI: null };
  try {
    const r = await fetch(`${apiUrl.replace(/\/$/, '')}/price/${encodeURIComponent(mint)}`, {
      // OG 图要快 · 1.5s 超时 · 拉不到不阻塞 · 拿到就更好
      signal: AbortSignal.timeout(1_500),
    });
    if (!r.ok) return { symbol: null, logoURI: null };
    const j = (await r.json()) as { symbol?: string; logo_uri?: string | null };
    return { symbol: j?.symbol ?? null, logoURI: j?.logo_uri ?? null };
  } catch {
    return { symbol: null, logoURI: null };
  }
}

export default async function Image({ params }: Props) {
  const { sig } = await params;
  await trackOgHit(`/v2/tx/${sig}/opengraph-image`);
  const isDemo = sig === MOCK_TX_SIG;

  // demo · 用 mockup 文案
  let savedSol = 0.0045;
  let savedUsd: number | null = 0.9;
  let tokenSymbol = 'BONK';
  let tokenLogo: string | null = null;
  let sideVerb = 'Bought';
  let tokenAmount = 1_234_567;
  let notionalSol = 0.5;
  let competitorSol = 0.5045;
  let mevProtected = true;
  let feePct = 0.1;
  let competitorFeePct = 1;
  let solDp = 4; // P3-FE-4 polish 2 · 跟 savedSol 量级匹配
  let isPending = false;

  if (!isDemo) {
    const report = await getTransparencyReport(sig);
    if (report) {
      const v = mapReportToView(report);
      savedSol = v.savedSol;
      savedUsd = v.savedUsd;
      tokenSymbol = v.tokenSymbol;
      sideVerb = v.side === 'buy' ? 'Bought' : 'Sold';
      tokenAmount = v.tokenAmount;
      notionalSol = v.notionalSol;
      competitorSol = v.vsCompetitorSol;
      mevProtected = v.mevProtected;
      feePct = v.feePct;
      competitorFeePct = v.competitorFeePct;
      solDp = v.solDp;
      // P4-FE-2 · server fetch 真 logo + 真 symbol · 救场链上 fallback "Aw5S" mint slice
      const focus = v.side === 'buy' ? v.tokenOut : v.tokenIn;
      const meta = await fetchTokenMeta(focus.mint);
      if (meta.symbol) tokenSymbol = meta.symbol;
      if (meta.logoURI) tokenLogo = meta.logoURI;
    } else {
      // 找不到 sig · 不显 mock 误导 · 显"报告生成中"中性 OG
      isPending = true;
    }
  }

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
        {/* Top · OCUFI brand · 右上 fee 标签 */}
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
            <span>OCUFI · TX REPORT</span>
          </div>
          <span>{`${fmtNum(feePct, 2)}% FEE`}</span>
        </div>

        {/* Mid · 大字 · brand→cyan 渐变 · pending 时显"报告生成中" */}
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
          >{isPending ? 'Report generating' : (savedSol === 0 ? '0.1% fee · industry 1%' : `Saved ${fmtNum(savedSol, solDp)} SOL`)}</div>
          {/* P4-FE-2 · token logo + symbol row · server fetch 真 logo · 散户一眼认出币种 */}
          {!isPending && tokenLogo && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tokenLogo}
                alt={tokenSymbol}
                width={64}
                height={64}
                style={{ borderRadius: '50%', display: 'block' }}
              />
              <span
                style={{
                  fontSize: '36px',
                  color: '#F5F5F2',
                  fontWeight: 500,
                  letterSpacing: '-0.01em',
                }}
              >{`$${tokenSymbol}`}</span>
            </div>
          )}
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
            {/* Satori 要 single text child · 多 expression 当 multi-children · 用 template literal 合并 */}
            <div>{isPending ? 'After on-chain confirmation · report writes in 30s - 2min' : `${sideVerb} ${tokenAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })} $${tokenSymbol} · ${sideVerb === 'Bought' ? 'paid' : 'got'} ${fmtNum(notionalSol, solDp)} SOL`}</div>
            <div>{isPending ? 'Visit the full link for the live transparency report' : `vs BullX ${fmtNum(competitorSol, solDp)} SOL · ${fmtNum(feePct, 2)}% fee vs ${fmtNum(competitorFeePct, 0)}%${mevProtected ? ' · MEV protected' : ''}`}</div>
          </div>
        </div>

        {/* Footer · url + saved usd */}
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
          <span>{`ocufi.io/v2/tx/${sig.length >= 12 ? `${sig.slice(0, 6)}...${sig.slice(-4)}` : sig}`}</span>
          {isPending ? <span>Solana · transparency report</span> : savedUsd != null ? <span>{`≈ $${fmtNum(savedUsd, 2)} saved`}</span> : <span>Solana · 0.1% fee</span>}
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
