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
          <rect
            x="4"
            y="4"
            width="24"
            height="24"
            rx="6"
            transform="rotate(45 16 16)"
            stroke="#19FB9B"
            strokeWidth="2.5"
            fill="none"
          />
          <circle cx="16" cy="16" r="3.5" fill="#19FB9B" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
