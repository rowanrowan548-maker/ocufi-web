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
    const res = await fetch(`${GT_BASE}/tokens/${encodeURIComponent(mint)}/pools?page=1`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
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
    const res = await fetch(`${GT_BASE}/pools/${encodeURIComponent(pool)}/trades`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
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
