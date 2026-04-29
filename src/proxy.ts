/**
 * Next 中间件 · 预发布锁 + i18n 路由
 *
 * 行为:
 *  - 当 LAUNCH_MODE === 'preview' 时启用预发布锁
 *  - 任何 ?preview=KEY 跟 LAUNCH_KEY 对得上 → 写入 90 天 cookie 解锁
 *  - 已有 cookie → 全站正常访问
 *  - 没 cookie 也没正确 key → 重定向到 /coming-soon(除以下白名单路径)
 *
 * 白名单(预发布期也始终可达):
 *  - /coming-soon · 那个登陆页本身
 *  - /admin · 我们自己的管理后台(也用 ADMIN_KEY 鉴权,跟 launch 锁分开)
 *  - /branding/* · 品牌物料下载页(给设计师 / 媒体用)
 *  - /api/* · 后端代理(实际走 Railway,不会到这,但保险)
 *  - /_next/* · Next 静态资源
 *  - /icon, /apple-icon, /manifest.webmanifest, /opengraph-image, /twitter-image, /sw.js
 */
import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';

const COOKIE_NAME = 'ocufi-launch-bypass';
const COOKIE_MAX_AGE = 90 * 24 * 3600; // 90 天

const intlMiddleware = createIntlMiddleware(routing);

// 这些路径不受预发布锁限制
const ALLOW_PREFIX = [
  '/coming-soon',
  '/admin',
  '/branding/',
  '/api/',
  '/_next/',
  '/_vercel/',
];
const ALLOW_EXACT = [
  '/icon.svg',
  '/apple-icon',
  '/manifest.webmanifest',
  '/opengraph-image',
  '/twitter-image',
  '/sw.js',
  '/robots.txt',
  '/favicon.ico',
];

function pathAllowedDuringPreview(pathname: string): boolean {
  // 去掉 locale 前缀做匹配
  const stripped = pathname.replace(/^\/(zh-CN|en-US)(?=\/|$)/, '');
  if (ALLOW_EXACT.includes(stripped)) return true;
  return ALLOW_PREFIX.some((p) => stripped.startsWith(p));
}

export default function middleware(request: NextRequest) {
  const launchMode = process.env.LAUNCH_MODE;
  const launchKey = process.env.LAUNCH_KEY;

  // 不在预发布模式 → 直接走 i18n
  if (launchMode !== 'preview') {
    return intlMiddleware(request);
  }

  const { pathname, searchParams } = request.nextUrl;

  // ?preview=KEY 命中 → 写 cookie 后正常通行
  const previewParam = searchParams.get('preview');
  if (previewParam && launchKey && previewParam === launchKey) {
    const url = request.nextUrl.clone();
    url.searchParams.delete('preview');
    const res = NextResponse.redirect(url);
    res.cookies.set({
      name: COOKIE_NAME,
      value: '1',
      maxAge: COOKIE_MAX_AGE,
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      secure: true,
    });
    return res;
  }

  // 已有解锁 cookie → 正常走 i18n
  if (request.cookies.get(COOKIE_NAME)?.value) {
    return intlMiddleware(request);
  }

  // 白名单路径(coming-soon / admin / branding 等)→ 正常走 i18n
  if (pathAllowedDuringPreview(pathname)) {
    return intlMiddleware(request);
  }

  // 其他路径全部重定向到 coming-soon
  const url = request.nextUrl.clone();
  url.pathname = '/coming-soon';
  url.search = ''; // 清掉旧 query
  return NextResponse.redirect(url);
}

export const config = {
  // 排除:Next 内部路径 / public/branding/* 静态文件 / api / 各类静态资源 / .html 文件
  // 这些路径不进 middleware,Vercel CDN 直接返回静态文件,不会被 launch 锁拦截
  // T-821 fix:manifest.webmanifest 被 i18n middleware redirect 到 /<locale>/manifest.webmanifest 致 404
  // 加排除,让 Next.js 直接命中 src/app/manifest.ts 的根级 static manifest
  // T-OG-IMAGE-FIX:同 manifest 道理 · opengraph-image / twitter-image 也是根级 file convention
  // 走 i18n redirect 会找不到 src/app/[locale]/opengraph-image · 死循环 → 404
  matcher: [
    '/((?!_next/|_vercel/|api/|branding/|favicon\\.ico|sw\\.js|robots\\.txt|manifest\\.webmanifest|opengraph-image|twitter-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot|html)$).*)',
  ],
};
