import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Ocufi · 链上交易,应该回到你手里';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
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
            'radial-gradient(circle at 30% 20%, #19FB9B22 0%, transparent 50%), radial-gradient(circle at 80% 80%, #60A5FA15 0%, transparent 50%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#FAFAFA',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <svg width="112" height="112" viewBox="0 0 32 32">
            <path d="M 16 5 A 11 11 0 0 1 27 16" stroke="#19FB9B" strokeWidth="2.8" fill="none" strokeLinecap="round" />
            <path d="M 16 27 A 11 11 0 0 1 5 16" stroke="#19FB9B" strokeWidth="2.8" fill="none" strokeLinecap="round" />
            <path d="M 27 16 A 11 11 0 0 1 16 27" stroke="#19FB9B" strokeWidth="2.8" fill="none" strokeLinecap="round" opacity="0.3" />
            <path d="M 5 16 A 11 11 0 0 1 16 5" stroke="#19FB9B" strokeWidth="2.8" fill="none" strokeLinecap="round" opacity="0.3" />
            <circle cx="16" cy="16" r="2.2" fill="#19FB9B" />
          </svg>
          <div style={{ fontSize: '96px', fontWeight: 700, letterSpacing: '-0.03em' }}>
            Ocufi
          </div>
        </div>

        {/* Title + Subtitle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div
            style={{
              fontSize: '88px',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
              maxWidth: '1000px',
            }}
          >
            链上交易,应该回到你手里
          </div>
          <div
            style={{
              fontSize: '28px',
              color: '#8B8D94',
              lineHeight: 1.4,
              maxWidth: '900px',
            }}
          >
            更低的手续费 · 更透明的价格 · 更少的中间人
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '32px',
            borderTop: '1px solid #2A2E3A',
            fontSize: '20px',
            color: '#8B8D94',
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
            <span>Solana · 非托管 · 开源</span>
          </div>
          <div style={{ fontFamily: 'ui-monospace, monospace' }}>ocufi.io</div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
