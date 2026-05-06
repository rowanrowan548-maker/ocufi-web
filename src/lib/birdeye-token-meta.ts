/**
 * V2 P3-FE-13 · Birdeye 二级 token meta lookup
 *
 * 真因:Jupiter `/all` 仍不含 pump.fun 新币(用户实测 Aw5S / 73ed 未命中)
 * 治根:Jupiter miss → birdeye `/v3/token/meta-multiple?list_address=<mint>`
 *
 * 设计:
 *   - per-mint localStorage 缓存 24h(birdeye quota 贵 · 不重复打)
 *   - 单 mint 单飞:同进程并发请求合并
 *   - 失败 / 没 NEXT_PUBLIC_BIRDEYE_API_KEY → 返 null · 上层 fallback shortMint
 *   - 不抛错
 */
'use client';

const ENDPOINT = 'https://public-api.birdeye.so/defi/v3/token/meta-data/multiple';
const STORAGE_KEY_PREFIX = 'ocufi.birdeye-meta:';
const NEG_STORAGE_KEY_PREFIX = 'ocufi.birdeye-miss:';
const TTL_MS = 24 * 3600 * 1000;
const NEG_TTL_MS = 6 * 3600 * 1000; // 拿不到的 mint · 缓存 6h 不反复打

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

  const apiKey = process.env.NEXT_PUBLIC_BIRDEYE_API_KEY;
  if (!apiKey) {
    // P3-FE-14 · debug · 排查 pump 币 fallback 没生效
    console.warn('[birdeye] skip · NEXT_PUBLIC_BIRDEYE_API_KEY 未配置 · pump 币无二级 fallback', { mint });
    memCache.set(mint, null);
    return null;
  }

  const p = (async (): Promise<BirdeyeTokenMeta | null> => {
    try {
      const url = `${ENDPOINT}?list_address=${encodeURIComponent(mint)}`;
      const r = await fetch(url, {
        headers: {
          'x-api-key': apiKey,
          accept: 'application/json',
          'x-chain': 'solana',
        },
      });
      if (!r.ok) {
        console.warn('[birdeye] HTTP error', { mint, status: r.status, statusText: r.statusText });
        memCache.set(mint, null);
        writeLocal(mint, null);
        return null;
      }
      const json = (await r.json()) as {
        data?: Record<
          string,
          {
            address?: string;
            symbol?: string;
            name?: string;
            logo_uri?: string;
            logoURI?: string;
          }
        >;
      };
      const entry = json?.data?.[mint];
      if (!entry || !entry.symbol) {
        console.warn('[birdeye] empty entry', { mint, hasData: !!json?.data, keys: json?.data ? Object.keys(json.data).slice(0, 3) : [] });
        memCache.set(mint, null);
        writeLocal(mint, null);
        return null;
      }
      const meta: BirdeyeTokenMeta = {
        address: entry.address ?? mint,
        symbol: entry.symbol,
        name: entry.name ?? '',
        logoURI: entry.logo_uri ?? entry.logoURI ?? '',
      };
      memCache.set(mint, meta);
      writeLocal(mint, meta);
      return meta;
    } catch (e) {
      console.warn('[birdeye] fetch threw', { mint, error: e instanceof Error ? e.message : String(e) });
      memCache.set(mint, null);
      return null;
    } finally {
      inflight.delete(mint);
    }
  })();
  inflight.set(mint, p);
  return p;
}
