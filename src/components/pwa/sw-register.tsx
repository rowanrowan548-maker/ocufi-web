'use client';

/**
 * 注册 Service Worker(无 UI,layout 里挂一次)
 */
import { useEffect } from 'react';

export function SwRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    // 仅生产环境注册,dev 环境装 SW 经常 cache 旧 chunk 调试很痛
    if (window.location.hostname === 'localhost') return;

    const onLoad = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((err) => console.warn('[sw] register failed', err));
    };
    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad, { once: true });
  }, []);
  return null;
}
