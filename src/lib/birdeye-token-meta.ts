/**
 * V2 P3-FE-13 / P4-FE-1 · 客户端 token meta lookup
 *
 * P4-FE-1 重写:**砍 birdeye direct call · 改 V1 后端 `/price/<mint>` proxy**
 *   真因:NEXT_PUBLIC_BIRDEYE_API_KEY 没配 client · `public-api.birdeye.so` 直接 401
 *   后端已有 birdeye 接通(server-side BIRDEYE_API_KEY)· 返 ApiTokenPrice 含 logo_uri/symbol
 *   前端走 fetchPrice(mint)(60s cache + inflight dedup · api-client.ts L130 已 ship)
 *
 * 模块 export 不变(lookupBirdeyeMeta / lookupBirdeyeMetaSync)· 调用方(token-display.ts)0 改
 */
'use client';

import { fetchPrice } from './api-client';

const STORAGE_KEY_PREFIX = 'ocufi.token-meta:';
const NEG_STORAGE_KEY_PREFIX = 'ocufi.token-meta-miss:';
const TTL_MS = 24 * 3600 * 1000;
const NEG_TTL_MS = 6 * 3600 * 1000;

export type BirdeyeTokenMeta = {
  address: string;
  symbol: string;
  name: string;
  logoURI: string;
};

type Stored = { ts: number; data: BirdeyeTokenMeta | null };

const memCache = new Map<string, BirdeyeTokenMeta | null>();
const inflight = new Map<string, Promise<BirdeyeTokenMeta | null>>();

function readLocal(mint: string): Stored | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY_PREFIX + mint);
    if (v) {
      const s = JSON.parse(v) as Stored;
      if (s?.ts && Date.now() - s.ts < TTL_MS) return s;
    }
    const neg = window.localStorage.getItem(NEG_STORAGE_KEY_PREFIX + mint);
    if (neg) {
      const s = JSON.parse(neg) as Stored;
      if (s?.ts && Date.now() - s.ts < NEG_TTL_MS) return { ts: s.ts, data: null };
    }
  } catch {
    /* 静默 */
  }
  return null;
}

function writeLocal(mint: string, data: BirdeyeTokenMeta | null): void {
  if (typeof window === 'undefined') return;
  try {
    const key = data ? STORAGE_KEY_PREFIX + mint : NEG_STORAGE_KEY_PREFIX + mint;
    window.localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    /* quota / 隐私模式 · 静默 */
  }
}

export function lookupBirdeyeMetaSync(mint: string): BirdeyeTokenMeta | null {
  if (memCache.has(mint)) return memCache.get(mint) ?? null;
  const local = readLocal(mint);
  if (local) {
    memCache.set(mint, local.data);
    return local.data;
  }
  return null;
}

export async function lookupBirdeyeMeta(mint: string): Promise<BirdeyeTokenMeta | null> {
  if (memCache.has(mint)) return memCache.get(mint) ?? null;
  const local = readLocal(mint);
  if (local) {
    memCache.set(mint, local.data);
    return local.data;
  }
  const existing = inflight.get(mint);
  if (existing) return existing;

  const p = (async (): Promise<BirdeyeTokenMeta | null> => {
    try {
      // P4-FE-1 · V1 后端 proxy · 已 birdeye 接通 + 60s cache + inflight dedup
      const price = await fetchPrice(mint);
      if (!price?.symbol) {
        memCache.set(mint, null);
        writeLocal(mint, null);
        return null;
      }
      const meta: BirdeyeTokenMeta = {
        address: price.mint ?? mint,
        symbol: price.symbol,
        name: price.name ?? '',
        logoURI: price.logo_uri ?? '',
      };
      memCache.set(mint, meta);
      writeLocal(mint, meta);
      return meta;
    } catch (e) {
      console.warn('[token-meta] fetchPrice failed', { mint, error: e instanceof Error ? e.message : String(e) });
      memCache.set(mint, null);
      return null;
    } finally {
      inflight.delete(mint);
    }
  })();
  inflight.set(mint, p);
  return p;
}
