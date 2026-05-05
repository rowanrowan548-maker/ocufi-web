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

/**
 * P2-V2-DEFAULT · 顶层裸 locale / 根访问默认进 V2
 * Phase 4 软发布前临时方案 · V1 老路径(/portfolio /trade /token/* 等)直接 URL 仍可访问 · 防回退
 *
 * P3-FE-9 · 加 i18n auto-detect:
 *   优先级:URL 显式 locale > NEXT_LOCALE cookie > Accept-Language header > zh-CN 兜底
 *   防 zh 用户被强 zh-CN(原行为)· en 用户没设 cookie 也强 zh-CN
 */
function detectLocale(request: NextRequest): 'zh-CN' | 'en-US' {
  // 1. URL 显式 locale
  if (request.nextUrl.pathname.startsWith('/en-US')) return 'en-US';
  if (request.nextUrl.pathname.startsWith('/zh-CN')) return 'zh-CN';
  // 2. cookie 主动选过
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  if (cookieLocale === 'en-US' || cookieLocale === 'zh-CN') return cookieLocale;
  // 3. Accept-Language header
  const accept = request.headers.get('accept-language') ?? '';
  // 浏览器 zh / zh-* 都给中文 · 其他默 en
  if (/^zh\b/i.test(accept) || /[,\s]zh\b/i.test(accept)) return 'zh-CN';
  if (/^en\b/i.test(accept) || /[,\s]en\b/i.test(accept)) return 'en-US';
  // 4. 兜底 zh-CN(项目主语言)
  return 'zh-CN';
}

function maybeV2DefaultRedirect(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  const stripped = pathname.replace(/^\/(zh-CN|en-US)(?=\/|$)/, '') || '/';
  if (stripped !== '/') return null;
  const locale = detectLocale(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}/v2`;
  return NextResponse.redirect(url);
}

export default function middleware(request: NextRequest) {
  const launchMode = process.env.LAUNCH_MODE;
  const launchKey = process.env.LAUNCH_KEY;

  // 不在预发布模式 → 先看是否要 V2 默认跳转 · 否则走 i18n
  if (launchMode !== 'preview') {
    const v2 = maybeV2DefaultRedirect(request);
    if (v2) return v2;
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

  // 已有解锁 cookie → 先看是否要 V2 默认跳转 · 否则走 i18n
  if (request.cookies.get(COOKIE_NAME)?.value) {
    const v2 = maybeV2DefaultRedirect(request);
    if (v2) return v2;
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
