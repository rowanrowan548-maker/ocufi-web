import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default async function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0A0B0D',
          backgroundImage:
            'radial-gradient(circle at 50% 50%, #19FB9B33 0%, transparent 70%)',
          borderRadius: '40px',
        }}
      >
        <svg width="120" height="120" viewBox="0 0 32 32">
          <path d="M 16 5 A 11 11 0 0 1 27 16" stroke="#19FB9B" strokeWidth="2.8" fill="none" strokeLinecap="round" />
          <path d="M 16 27 A 11 11 0 0 1 5 16" stroke="#19FB9B" strokeWidth="2.8" fill="none" strokeLinecap="round" />
          <path d="M 27 16 A 11 11 0 0 1 16 27" stroke="#19FB9B" strokeWidth="2.8" fill="none" strokeLinecap="round" opacity="0.3" />
          <path d="M 5 16 A 11 11 0 0 1 16 5" stroke="#19FB9B" strokeWidth="2.8" fill="none" strokeLinecap="round" opacity="0.3" />
          <circle cx="16" cy="16" r="2.2" fill="#19FB9B" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
