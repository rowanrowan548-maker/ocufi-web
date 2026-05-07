/**
 * Root OG image · V2 软发布后视觉锚 · 英文为主国际化主导
 *
 * P4-FE-9 升级 V2 化:
 *   - 视觉对齐 V2 og-card(双 radial brand glow + brand→cyan 渐变大字)
 *   - 文案对齐 V2 卖点:0.1% fee · MEV protected · permanent transparency report URL · non-custodial
 *   - 任何 fallback 路径(钱包风控爬虫 / 微信 / 老 TG 缓存 / X SEO 抓取)显这套统一锚点
 *
 * 1200×630 · OG 标准尺寸 · edge runtime
 */
import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Ocufi · Solana Trading Terminal · 0.1% fee · MEV protected';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// P5-FE-15 改 2 · 真记 OG 抓取 · fire-and-forget · 不阻塞图返回 · 失败静默
// 后端 /admin/og-hit (P5-BE-2 ship · 写 og_hits 表) → /admin/og-share-stats 读取
function trackOgHit(path: string): void {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return;
  fetch(`${apiUrl.replace(/\/$/, '')}/admin/og-hit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  }).catch(() => {});
}

export default async function Image() {
  trackOgHit('/opengraph-image');
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
          // V2 锚点:双 radial brand glow(跟 og-card.tsx L133 同公式)
          backgroundImage:
            'radial-gradient(ellipse 60% 50% at 92% 8%, rgba(25,251,155,0.18) 0%, transparent 60%), radial-gradient(ellipse 40% 40% at 6% 95%, rgba(25,251,155,0.12) 0%, transparent 60%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#F5F5F2',
        }}
      >
        {/* Top · OCUFI brand · brand 微纳米标签 */}
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
            <span>OCUFI · SOLANA TRADING TERMINAL</span>
          </div>
          <span>0.1% FEE</span>
        </div>

        {/* Mid · 大字 · brand→cyan 渐变(跟 V2 hero saveText 同视觉) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div
            style={{
              fontSize: '108px',
              fontWeight: 600,
              letterSpacing: '-0.03em',
              lineHeight: 1.0,
              backgroundImage: 'linear-gradient(135deg, #19FB9B 0%, #03e1ff 100%)',
              backgroundClip: 'text',
              color: 'transparent',
              maxWidth: '1080px',
            }}
          >
            10× cheaper trading
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
            <div>0.1% fee · 1% industry standard · MEV protected · non-custodial</div>
            <div>Every fill auto-generates a permanent transparency report URL.</div>
          </div>
        </div>

        {/* Footer · brand glow dot + url */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: '#19FB9B',
                boxShadow: '0 0 12px #19FB9B',
              }}
            />
            <span>Solana · open-source · self-custody</span>
          </div>
          <span>ocufi.io</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
