/**
 * Ocufi Service Worker
 *
 * 策略:
 *  - HTML 文档:network-first(确保拿到最新)
 *  - 静态资源(/_next/static, /icon, /manifest, fonts):cache-first 长期缓存
 *  - 外部 API(DexScreener / GeckoTerminal / RugCheck / Helius):**不**经 SW(它们已在 portfolio.ts 内存里缓存)
 *  - 离线兜底:文档失败 → 返回缓存的 / 首页(若有)
 *
 * 不缓存任何 POST / 钱包签名相关请求
 */
const VERSION = 'v1';
const STATIC_CACHE = `ocufi-static-${VERSION}`;
const DOC_CACHE = `ocufi-doc-${VERSION}`;

const STATIC_PATTERNS = [
  /^\/_next\/static\//,
  /^\/icon/,
  /^\/manifest/,
  /\.(?:js|css|woff2?|ttf|eot|png|jpg|jpeg|svg|webp)$/,
];

self.addEventListener('install', (event) => {
  // 立即激活,不等老 SW 释放
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // 清掉旧版本 cache
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.endsWith(VERSION))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 跨域请求(API、钱包 RPC、第三方)统统直通,不缓存
  if (url.origin !== self.location.origin) return;

  // 静态资源:cache-first
  if (STATIC_PATTERNS.some((p) => p.test(url.pathname))) {
    event.respondWith(cacheFirst(STATIC_CACHE, req));
    return;
  }

  // HTML 文档:network-first,失败回缓存
  const accept = req.headers.get('accept') ?? '';
  if (accept.includes('text/html')) {
    event.respondWith(networkFirst(DOC_CACHE, req));
  }
});

async function cacheFirst(cacheName, req) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    return new Response('offline', { status: 503 });
  }
}

async function networkFirst(cacheName, req) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const cached = await cache.match(req);
    if (cached) return cached;
    // 兜底:返回缓存的 / 首页
    const fallback = await cache.match('/');
    if (fallback) return fallback;
    return new Response('offline', { status: 503 });
  }
}
