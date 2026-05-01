/**
 * 交易活动 feed(走 ocufi-api 后端代理)
 *
 * T-706b:之前直击 api.geckoterminal.com 撞 429 限速 + CORS,console 雪崩。
 * 改走 `${NEXT_PUBLIC_API_URL}/token/trades?mint=X&limit=Y`(后端 T-706,
 * 60s + 5min 双层缓存,雪崩锁,stale-while-error;后端做 retry,前端不再做)
 *
 * 字段契约(后端已对齐 GTTrade 接口):
 *  { ok: bool, trades?: GTTrade[], cached?: bool, error?: string }
 *
 * 失败降级:返 [](activity-board 已 null-guard)
 */

const FETCH_TIMEOUT_MS = 10_000;

export interface GTTrade {
  /** 交易方向(对该池基准代币而言) */
  kind: 'buy' | 'sell';
  /** 块时间 ms */
  blockTimestampMs: number;
  /** 链上 tx 签名,可点击跳 Solscan */
  txSignature: string;
  /** 交易者 wallet base58 */
  fromAddress: string;
  /** 该笔交易的 USD 估值 */
  usdValue: number;
}

// T-PERF-FE-DEDUP-REQUESTS · mint 级缓存 + inflight dedup
// activity-board(limit=100)+ mini-trade-flow(limit=8)同 mint 共享 1 次后端请求
// 统一拉 limit=100 · 调用方按需 slice
const TRADES_CACHE_TTL_MS = 30_000;
const FETCH_LIMIT = 100;
const tradesCache = new Map<string, { data: GTTrade[]; expiresAt: number }>();
const tradesInflight = new Map<string, Promise<GTTrade[]>>();

/** 入口:mint → 一把拉到 trades(失败返回空数组)
 * limit 参数仅用于调用方切片 · 后端实际固定拉 100 · 同 mint 跨组件共享缓存 */
export async function fetchMintTrades(mint: string, limit = 100): Promise<GTTrade[]> {
  if (!mint) return [];

  // 命中 fresh 缓存 · 直接 slice 返
  const cached = tradesCache.get(mint);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data.slice(0, Math.max(1, Math.floor(limit)));
  }

  // 复用同 mint 正在飞的请求(防 activity-board + mini-trade-flow 同时挂载发 2 次)
  let promise = tradesInflight.get(mint);
  if (!promise) {
    promise = doFetchMintTrades(mint).then((data) => {
      tradesCache.set(mint, { data, expiresAt: Date.now() + TRADES_CACHE_TTL_MS });
      return data;
    }).finally(() => {
      tradesInflight.delete(mint);
    });
    tradesInflight.set(mint, promise);
  }

  const data = await promise;
  return data.slice(0, Math.max(1, Math.floor(limit)));
}

async function doFetchMintTrades(mint: string): Promise<GTTrade[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    // 后端未配置 → 不走直击 GT 回落(防 BUG-035 限速复燃),返空
    console.warn('[gt-trades] NEXT_PUBLIC_API_URL not set, trades disabled');
    return [];
  }
  const url =
    `${apiUrl.replace(/\/$/, '')}/token/trades` +
    `?mint=${encodeURIComponent(mint)}&limit=${FETCH_LIMIT}`;

  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const json = await res.json();
    if (!json || json.ok !== true || !Array.isArray(json.trades)) {
      const errMsg = json?.error ? String(json.error) : 'unknown';
      console.warn('[gt-trades] backend error', mint.slice(0, 8), errMsg);
      return [];
    }
    // 后端已经对齐 GTTrade 字段(kind/blockTimestampMs/txSignature/fromAddress/usdValue),
    // 但保险起见运行时再过一遍类型校验,防服务端字段漂移
    const out: GTTrade[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const t of json.trades as any[]) {
      if (!t || typeof t !== 'object') continue;
      const tx = String(t.txSignature ?? '').trim();
      if (!tx) continue;
      out.push({
        kind: t.kind === 'sell' ? 'sell' : 'buy',
        blockTimestampMs: Number(t.blockTimestampMs ?? 0),
        txSignature: tx,
        fromAddress: String(t.fromAddress ?? '').trim(),
        usdValue: Number(t.usdValue ?? 0),
      });
    }
    out.sort((a, b) => b.blockTimestampMs - a.blockTimestampMs);
    return out;
  } catch (e) {
    console.warn('[gt-trades] fetch failed', mint.slice(0, 8), e);
    return [];
  }
}
