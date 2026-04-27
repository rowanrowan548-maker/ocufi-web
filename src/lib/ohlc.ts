/**
 * OHLC 数据获取(/trade chart-card 用 lightweight-charts 自渲染时拉)
 *
 * T-700b:已从直击 GeckoTerminal 改成走 ocufi-api 后端代理 `/chart/ohlc`
 *  - 后端单 IP 打 GT,所有用户共享 60s 缓存,GT 免费层 30 req/min 撞不破
 *  - 前端再叠 30s 缓存,双层 cache 进一步降低后端压力
 *  - 后端透传 GT 原始 ohlcv_list,parser 不变(BUG-026 finite 校验仍生效)
 *  - 后端总返 200 + `{ok: bool, ohlcv_list?, error?}`,ok=false 时降级返 [](或 stale)
 *
 * 关键约束:
 *  - lightweight-charts 要求 time 是 unix seconds(不是 ms)
 *  - GeckoTerminal 返回 desc(新到旧),lightweight-charts 要求 asc,需要 reverse
 *  - timeframe 暴露为 'minute_5' 这种 UI 友好枚举,后端 enum 同名(直接透传)
 */

import { fetchTopPool } from './geckoterminal';

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

// T-700b:timeframe path/aggregate 映射移到后端,前端透传 enum 字符串

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

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    // 后端未配置 → 没法走代理,直接返空(不再回落直击 GT,避免 BUG-035 限速问题复燃)
    console.warn('[ohlc] NEXT_PUBLIC_API_URL not set, OHLC disabled');
    setCache(key, []);
    return [];
  }
  const url =
    `${apiUrl.replace(/\/$/, '')}/chart/ohlc` +
    `?pool=${encodeURIComponent(pool)}&tf=${encodeURIComponent(timeframe)}&limit=${safeLimit}`;

  const promise = (async () => {
    try {
      // T-700b:走后端代理。后端做了 60s 缓存 + 重试 + 限速治理,前端不需要再 retry
      // 用 AbortSignal.timeout 防后端挂死(后端默认 8s,前端宽 2s)
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000), cache: 'no-store' });
      if (!res.ok) {
        // 后端 5xx / 网络层失败 → stale-while-error
        if (cached) return cached.data;
        setCache(key, []);
        return [];
      }
      const json = await res.json();
      // 后端契约:总返 200 + { ok: bool, ohlcv_list?, error?, cached?, fetched_at? }
      // ok=false → 降级(rate_limit / upstream_5xx / invalid_pool / timeout)
      if (!json || json.ok !== true || !Array.isArray(json.ohlcv_list)) {
        const errMsg = json?.error ? String(json.error) : 'unknown';
        console.warn('[ohlc] backend error', pool.slice(0, 8), timeframe, errMsg);
        if (cached) return cached.data;     // stale-while-error
        setCache(key, []);
        return [];
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list: any[] = json.ohlcv_list;
      const candles: OhlcCandle[] = [];
      let dropped = 0;
      for (const row of list) {
        if (!Array.isArray(row) || row.length < 6) { dropped++; continue; }
        const time = normalizeTime(row[0]);
        if (time === 0) { dropped++; continue; }
        const open = Number(row[1]);
        const high = Number(row[2]);
        const low = Number(row[3]);
        const close = Number(row[4]);
        const volume = Number(row[5]);
        // BUG-026 修:OHLC 全 4 字段必须 finite,任一 NaN/Infinity 跳过该 candle
        // 防 lightweight-charts 抛错 / 渲染异常(GT 偶发对极端 price 返非 finite)
        if (
          !Number.isFinite(open) ||
          !Number.isFinite(high) ||
          !Number.isFinite(low) ||
          !Number.isFinite(close)
        ) {
          dropped++;
          continue;
        }
        candles.push({ time, open, high, low, close, volume: Number.isFinite(volume) ? volume : 0 });
      }
      if (dropped > 0) {
        console.warn(
          `[ohlc] ${pool.slice(0, 8)} ${timeframe}: dropped ${dropped}/${list.length} non-finite candles`
        );
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
