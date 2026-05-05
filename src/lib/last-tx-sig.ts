/**
 * V2 P3-FE-2 / P3-FE-3 · 用户最近一笔 swap sig 缓存 · 跨设备同步
 *
 * 双路 fallback:
 *   step 1 · 客户端 mount · 立即读 localStorage(同步 · 0 网络延迟)
 *   step 2 · walletAddress 有 → GET /transparency/recent?wallet=<addr>&limit=1 拿 server 最新 sig
 *           · 比 localStorage 新就 setSig + 写回 localStorage(跨设备同步)
 *           · 静默失败 · server 挂 localStorage 兜底
 *           · 服务端返空(这个 wallet 没交易)→ 清(防上个 wallet 的 sig 误导)
 *
 * 设计:
 *   - 读 BuyForm/SellForm onSuccess → setLastTxSig(sig) · localStorage `ocufi.last-tx-sig` · storage 事件跨 tab 同步
 *   - Top nav / Bottom tab / Home OG / Token trade shell 用 useLastTxSig(walletAddress) · server fetch 后切真 sig
 */
'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from './api-client';

const KEY = 'ocufi.last-tx-sig';

/** P3-BE-2 GET /transparency/recent 返 wrapper */
type TransparencyRecentItem = { sig: string; created_at: string };
type TransparencyRecentResponse = {
  ok: boolean;
  error: string | null;
  data: TransparencyRecentItem[];
};

/**
 * 调 GET /transparency/recent 拿 wallet 最新 sig · 失败返 null(不抛)
 */
async function fetchRecentTxSig(wallet: string): Promise<string | null | 'empty'> {
  try {
    const res = await apiFetch<TransparencyRecentResponse>(
      `/transparency/recent?wallet=${encodeURIComponent(wallet)}&limit=1`
    );
    if (!res.ok) return null;
    if (!res.data || res.data.length === 0) return 'empty'; // wallet 没交易
    return res.data[0]?.sig ?? null;
  } catch {
    return null;
  }
}

/**
 * SSR 安全 · 服务端永返 null · 客户端 useEffect hydrate 读 localStorage + walletAddress 跨设备 fetch
 *
 * @param walletAddress 钱包 base58 · 没连钱包传 null/undefined → 只用 localStorage
 */
export function useLastTxSig(walletAddress?: string | null): string | null {
  const [sig, setSig] = useState<string | null>(null);

  // step 1 · 立即读 localStorage(实时 · 0 等待)
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

  // step 2 · wallet 有 → 调 /transparency/recent 跨设备同步 · 静默失败
  useEffect(() => {
    if (!walletAddress) return;
    let cancelled = false;
    fetchRecentTxSig(walletAddress).then((serverResult) => {
      if (cancelled) return;
      if (serverResult === 'empty') {
        // server 说这个 wallet 没交易 · 清 localStorage(防上个 wallet 的 sig 误导)
        setSig(null);
        try {
          window.localStorage.removeItem(KEY);
        } catch {
          /* 静默 */
        }
      } else if (serverResult) {
        // server 有 sig · 切真 + 写回 localStorage 跨 tab 同步
        setSig(serverResult);
        try {
          window.localStorage.setItem(KEY, serverResult);
        } catch {
          /* 静默 */
        }
      }
      // null = 失败 · 保 localStorage 兜底 · 不动
    });
    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  return sig;
}

/** swap 成功后调 · 缓存 sig 给 nav / OG 卡用 · 直接写 localStorage · 触发 storage 事件跨 tab */
export function setLastTxSig(sig: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, sig);
  } catch {
    /* 隐私模式 / 满 · 静默 */
  }
}
