/**
 * V2 P3-FE-10 · Jupiter strict token list 客户端缓存查询
 *
 * 熵减 #4:报告里 "DezX..." / "DjuM..." 4 字符 mint 切片不是币名 · 让用户自己去 solscan 查
 *   → 客户端拉 Jupiter `https://token.jup.ag/strict`(curated · 几百 KB)· 拿真 symbol+logoURI
 *   → localStorage 24h 缓存 · 不每次拉
 *   → 合 KNOWN_TOKENS(L1 sync)做 2 层兜底:KNOWN > Jupiter > backend symbol > shortMint
 *
 * 设计:
 *   - 单例 promise · 同进程并发只 fetch 1 次
 *   - localStorage TTL 24h · 跨页保留
 *   - SSR 安全:server 永返 null · client hydrate 后 useEffect 拉
 *   - 失败静默 · 上层 fallback
 */
'use client';

const ENDPOINT = 'https://token.jup.ag/strict';
const STORAGE_KEY = 'ocufi.jup-strict.v1';
const TTL_MS = 24 * 3600 * 1000;

export type JupToken = {
  address: string;
  symbol: string;
  name: string;
  logoURI: string;
  decimals: number;
};

type Cache = { ts: number; map: Record<string, JupToken> };

let memCache: Cache | null = null;
let inflight: Promise<Cache | null> | null = null;

function readLocal(): Cache | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (!v) return null;
    const c = JSON.parse(v) as Cache;
    if (!c?.ts || !c?.map) return null;
    if (Date.now() - c.ts > TTL_MS) return null;
    return c;
  } catch {
    return null;
  }
}

function writeLocal(c: Cache): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  } catch {
    /* quota 满 / 隐私模式 · 静默 */
  }
}

async function loadList(): Promise<Cache | null> {
  if (memCache) return memCache;
  const local = readLocal();
  if (local) {
    memCache = local;
    return local;
  }
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const r = await fetch(ENDPOINT);
      if (!r.ok) return null;
      const arr = (await r.json()) as JupToken[];
      const map: Record<string, JupToken> = {};
      for (const t of arr) {
        if (t?.address) map[t.address] = t;
      }
      const c: Cache = { ts: Date.now(), map };
      memCache = c;
      writeLocal(c);
      return c;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** 同步查 · 没缓存返 null(server / 首次未拉) */
export function lookupJupiterTokenSync(mint: string): JupToken | null {
  return memCache?.map[mint] ?? null;
}

/** 异步拉 · 缓存命中走 sync · 缺失走 fetch */
export async function lookupJupiterToken(mint: string): Promise<JupToken | null> {
  const c = await loadList();
  return c?.map[mint] ?? null;
}

/** 预热 · home / portfolio mount 调一次 · 让后续 sync 查就有 */
export function preloadJupiterList(): void {
  void loadList();
}
