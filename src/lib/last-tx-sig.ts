/**
 * V2 P3-FE-2 · 用户最近一笔 swap sig 缓存
 *
 * BuyForm / SellForm onSuccess 调 setLastTxSig(sig) · localStorage 持久化
 * Top nav "报告" tab / Bottom tab "报告" / Home OG 卡 用 useLastTxSig() · 拿到就跳真 sig · 没就 fallback
 *
 * SSR-safe:hook 初始 null · useEffect 客户端 hydrate 读 localStorage · setLastTxSig 跨 tab 同步靠 storage 事件
 */
'use client';
import { useEffect, useState } from 'react';

const KEY = 'ocufi.last-tx-sig';

/** SSR 安全 · 服务端永返 null · 客户端 useEffect hydrate 读 localStorage */
export function useLastTxSig(): string | null {
  const [sig, setSig] = useState<string | null>(null);
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(KEY);
      if (v) setSig(v);
    } catch {
      /* 隐私模式 / 满 · 静默 */
    }
    // 跨 tab 同步:别的 tab swap 完写 sig · 本 tab nav 同步刷
    function onStorage(e: StorageEvent) {
      if (e.key === KEY) setSig(e.newValue);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return sig;
}

/** swap 成功后调 · 缓存 sig 给 nav / OG 卡用 */
export function setLastTxSig(sig: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, sig);
  } catch {
    /* 隐私模式 / 满 · 静默 */
  }
}
