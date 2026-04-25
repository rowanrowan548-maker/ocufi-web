import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * 安全响应头白名单
 *
 * 思路 = 默认拒绝,只放外部数据源 + Solana RPC + 钱包扩展所必需的域:
 *  - script-src 开 'unsafe-inline' 因为 Next 16 server-render 注入了 inline runtime
 *    (生产可换 nonce 模式但需要 server component 配合,V2 升级)
 *  - frame-src 仅放 dexscreener.com(K 线 iframe)
 *  - connect-src 列出所有外部 API 域,阻止任何注入脚本偷偷打到陌生服务器
 *  - img-src 'self' + https + data: 允许任意 https 头像,挡 javascript:/file: 协议
 *  - object-src 'none' 阻止 Flash / PDF 嵌入向量
 *  - frame-ancestors 'none' 防自家页面被嵌入第三方实现 clickjacking 钓鱼
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: https: blob:",
  // 外部数据源:DexScreener / GeckoTerminal / RugCheck / Jupiter / Solana RPC / Helius / Ocufi API(Railway)
  "connect-src 'self' https://*.dexscreener.com https://api.geckoterminal.com https://api.rugcheck.xyz https://*.jup.ag https://lite-api.jup.ag https://*.helius-rpc.com https://*.helius.xyz https://api.mainnet-beta.solana.com wss://*.helius-rpc.com wss://api.mainnet-beta.solana.com https://*.solana.com https://*.up.railway.app",
  "frame-src 'self' https://dexscreener.com https://*.dexscreener.com",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  // 强制 https(开发模式 next 会自动放行 http)
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
