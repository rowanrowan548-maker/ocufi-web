'use client';

/**
 * 页面浏览追踪器 · 路由切换时上报 POST /track
 *
 * 不发任何 PII;后端只存 hash + path + referrer host + device class
 * /admin 页面排除(免污染统计)
 */
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { isApiConfigured } from '@/lib/api-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export function PageTracker() {
  const pathname = usePathname();
  const lastSent = useRef<string>('');

  useEffect(() => {
    if (!pathname || !API_URL || !isApiConfigured()) return;
    // 排除 /admin 自身,免造成自循环统计
    if (pathname.includes('/admin')) return;
    // 同 path 短时间不重复发(SPA 路由抖动)
    if (lastSent.current === pathname) return;
    lastSent.current = pathname;

    // 取得 referrer 时,SPA 路由内已经丢失;只在首次有效
    const referrer = typeof document !== 'undefined' ? document.referrer || '' : '';

    // sendBeacon 失败回 fetch
    const url = `${API_URL.replace(/\/$/, '')}/track`;
    const body = JSON.stringify({ path: pathname.slice(0, 256), referrer: referrer.slice(0, 512) });

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([body], { type: 'application/json' });
        const ok = navigator.sendBeacon(url, blob);
        if (ok) return;
      }
    } catch { /* fall through */ }

    // fallback: fetch keepalive
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => { /* silent */ });
  }, [pathname]);

  return null;
}
