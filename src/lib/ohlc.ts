/**
 * GeckoTerminal OHLC(/trade chart-card 用 lightweight-charts 自渲染时拉)
 *
 * API: GET /networks/solana/pools/{pool}/ohlcv/{timeframe_path}?aggregate=N&limit=L&currency=usd
 * Docs: https://www.geckoterminal.com/dex-api
 *
 * 关键约束:
 *  - lightweight-charts 要求 time 是 unix seconds(不是 ms)
 *  - GeckoTerminal 返回 desc(新到旧),lightweight-charts 要求 asc,需要 reverse
 *  - timeframe 暴露为 'minute_5' 这种 UI 友好枚举,内部转换成 GT 的 path + aggregate
 */

import { fetchTopPool } from './geckoterminal';

const GT_BASE = 'https://api.geckoterminal.com/api/v2/networks/solana';
const FETCH_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 30_000;
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

export type Timeframe =
  | 'minute_1'
  | 'minute_5'
  | 'minute_15'
  | 'hour_1'
  | 'hour_4'
  | 'day_1';

export interface OhlcCandle {
  /** unix seconds(lightweight-charts 要求);GT 返回多为 seconds,>1e12 时按 ms 转 */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const TIMEFRAME_MAP: Record<Timeframe, { path: 'minute' | 'hour' | 'day'; aggregate: number }> = {
  minute_1: { path: 'minute', aggregate: 1 },
  minute_5: { path: 'minute', aggregate: 5 },
  minute_15: { path: 'minute', aggregate: 15 },
  hour_1: { path: 'hour', aggregate: 1 },
  hour_4: { path: 'hour', aggregate: 4 },
  day_1: { path: 'day', aggregate: 1 },
};

const cache = new Map<string, { data: OhlcCandle[]; expiresAt: number }>();
const inflight = new Map<string, Promise<OhlcCandle[]>>();

function cacheKey(pool: string, tf: Timeframe, limit: number): string {
  return `${pool}::${tf}::${limit}`;
}

function setCache(key: string, data: OhlcCandle[]) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

function getCached(key: string): { data: OhlcCandle[]; fresh: boolean } | null {
  const entry = cache.get(key);
  if (!entry) return null;
  return { data: entry.data, fresh: entry.expiresAt > Date.now() };
}

/** GT 偶尔返回 ms timestamp,统一规约到 seconds(lightweight-charts 要求) */
function normalizeTime(ts: unknown): number {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n);
}

/**
 * 把 mint 解析到主流动性池(GeckoTerminal 第 1 条 pool)
 *
 * 复用 geckoterminal.ts 的 fetchTopPool — 已自带 5 分钟池缓存 + 失败返回 null
 *
 * @returns pool 地址(base58)或 null(无 LP / API 失败)
 */
export async function resolvePool(mint: string): Promise<string | null> {
  return fetchTopPool(mint);
}

/**
 * 拉某 pool 的 OHLC 数据,转成 lightweight-charts 兼容格式
 *
 * @param pool      pool 地址(由 resolvePool 拿到)
 * @param timeframe UI 枚举('minute_5' / 'hour_4' / 'day_1' …)
 * @param limit     返回 candle 数,默认 200,GT max 1000
 * @returns         OhlcCandle[](time 升序;失败 / 无数据返回 [])
 */
export async function fetchOhlc(
  pool: string,
  timeframe: Timeframe,
  limit: number = DEFAULT_LIMIT
): Promise<OhlcCandle[]> {
  if (!pool) return [];
  const safeLimit = Math.min(Math.max(1, Math.floor(limit) || DEFAULT_LIMIT), MAX_LIMIT);

  const key = cacheKey(pool, timeframe, safeLimit);
  const cached = getCached(key);
  if (cached?.fresh) return cached.data;

  const existing = inflight.get(key);
  if (existing) return existing;

  const tfCfg = TIMEFRAME_MAP[timeframe];
  const url =
    `${GT_BASE}/pools/${encodeURIComponent(pool)}/ohlcv/${tfCfg.path}` +
    `?aggregate=${tfCfg.aggregate}&limit=${safeLimit}&currency=usd`;

  const promise = (async () => {
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        if (cached) return cached.data;     // stale-while-error
        setCache(key, []);
        return [];
      }
      const json = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list: any[] = json?.data?.attributes?.ohlcv_list ?? [];
      const candles: OhlcCandle[] = [];
      for (const row of list) {
        if (!Array.isArray(row) || row.length < 6) continue;
        const time = normalizeTime(row[0]);
        if (time === 0) continue;
        const open = Number(row[1]);
        const high = Number(row[2]);
        const low = Number(row[3]);
        const close = Number(row[4]);
        const volume = Number(row[5]);
        if (!Number.isFinite(open) || !Number.isFinite(close)) continue;
        candles.push({ time, open, high, low, close, volume: Number.isFinite(volume) ? volume : 0 });
      }
      // GT 返回 desc(新到旧),lightweight-charts 要求 asc,reverse 一次
      candles.sort((a, b) => a.time - b.time);
      // 去重 + 严格递增(同一秒重复时间戳会让图表抛错)
      const dedup: OhlcCandle[] = [];
      let prevTime = -1;
      for (const c of candles) {
        if (c.time <= prevTime) continue;
        dedup.push(c);
        prevTime = c.time;
      }
      setCache(key, dedup);
      return dedup;
    } catch (e) {
      console.warn('[ohlc] fetch failed', pool.slice(0, 8), timeframe, e);
      if (cached) return cached.data;       // stale-while-error
      return [];
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}
