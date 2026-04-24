import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ocufi · Solana 交易终端',
    short_name: 'Ocufi',
    description: '非托管 · 低费 · 透明 · 开源的 Solana 链上交易终端',
    start_url: '/',
    display: 'standalone',
    background_color: '#0A0B0D',
    theme_color: '#19FB9B',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
