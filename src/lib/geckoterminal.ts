/**
 * GeckoTerminal API 封装(交易活动 feed)
 *
 * 免费 · 无 key · ~30 req/min(全 IP)
 * 流程:mint → 查最深 pool → 拉该 pool 最近 trades
 *
 * 安全防护:
 *  - 所有请求 10s timeout
 *  - 缓存 pool 地址 5 分钟
 *  - trades 字段全部经过 Number() 强制类型,防恶意服务端注入
 */

const GT_BASE = 'https://api.geckoterminal.com/api/v2/networks/solana';
const FETCH_TIMEOUT_MS = 10_000;

/** GT 限速 / 5xx 重试间隔(ms) · 共 3 次 attempts(首次 + 2 次重试) */
const GT_RETRY_DELAYS_MS = [600, 1500] as const;

/**
 * GT API 专用 fetch with retry · 429 / 5xx / 网络错 → 重试,4xx → 立即返
 *
 * 给 ohlc.ts 等其他 GT 调用方复用,避免到处复制 retry 模板
 *
 * @returns 最后一次的 Response(可能是 4xx,调用方自己处理 ok 检查)
 *          网络/timeout 全失败时抛错
 */
export async function fetchGtWithRetry(url: string): Promise<Response> {
  let lastErr: unknown;
  const total = GT_RETRY_DELAYS_MS.length + 1;
  for (let attempt = 0; attempt < total; attempt++) {
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      const isRetryable = res.status === 429 || res.status >= 500;
      if (!isRetryable) return res;
      if (attempt < total - 1) {
        const baseDelay = GT_RETRY_DELAYS_MS[attempt];
        const jitter = Math.random() * 200;
        console.warn(
          `[gt] HTTP ${res.status}, retry ${attempt + 1}/${total - 1} in ${Math.round(baseDelay + jitter)}ms`
        );
        await new Promise((r) => setTimeout(r, baseDelay + jitter));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (attempt < total - 1) {
        const baseDelay = GT_RETRY_DELAYS_MS[attempt];
        await new Promise((r) => setTimeout(r, baseDelay + Math.random() * 200));
        continue;
      }
      throw e;
    }
  }
  throw lastErr ?? new Error('fetchGtWithRetry: unreachable');
}

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

const poolCache = new Map<string, { pool: string; expiresAt: number }>();
const POOL_TTL_MS = 5 * 60 * 1000;

export async function fetchTopPool(mint: string): Promise<string | null> {
  const cached = poolCache.get(mint);
  if (cached && cached.expiresAt > Date.now()) return cached.pool;

  try {
    const res = await fetchGtWithRetry(
      `${GT_BASE}/tokens/${encodeURIComponent(mint)}/pools?page=1`
    );
    if (!res.ok) return null;
    const json = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pools: any[] = json?.data ?? [];
    if (pools.length === 0) return null;
    const top = pools[0];
    const pool = String(top?.attributes?.address ?? '').trim();
    if (!pool) return null;
    poolCache.set(mint, { pool, expiresAt: Date.now() + POOL_TTL_MS });
    return pool;
  } catch {
    return null;
  }
}

export async function fetchPoolTrades(
  pool: string,
  limit = 100
): Promise<GTTrade[]> {
  try {
    const res = await fetchGtWithRetry(
      `${GT_BASE}/pools/${encodeURIComponent(pool)}/trades`
    );
    if (!res.ok) return [];
    const json = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trades: any[] = json?.data ?? [];
    const out: GTTrade[] = [];
    for (const t of trades.slice(0, limit)) {
      const a = t?.attributes;
      if (!a) continue;
      const tx = String(a.tx_hash ?? '').trim();
      if (!tx) continue;
      out.push({
        kind: a.kind === 'buy' ? 'buy' : 'sell',
        blockTimestampMs: a.block_timestamp ? new Date(a.block_timestamp).getTime() : 0,
        txSignature: tx,
        fromAddress: String(a.tx_from_address ?? '').trim(),
        usdValue: Number(a.volume_in_usd ?? 0),
      });
    }
    out.sort((a, b) => b.blockTimestampMs - a.blockTimestampMs);
    return out;
  } catch {
    return [];
  }
}

/** 入口:mint → 一把拉到 trades(失败返回空数组) */
export async function fetchMintTrades(mint: string, limit = 100): Promise<GTTrade[]> {
  const pool = await fetchTopPool(mint);
  if (!pool) return [];
  return fetchPoolTrades(pool, limit);
}
