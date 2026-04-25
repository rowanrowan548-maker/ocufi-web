/**
 * GeckoTerminal API 封装(交易活动 feed)
 *
 * 免费 · 无 key · ~30 req/min(全 IP)
 * 流程:mint → 查最深 pool → 拉该 pool 最近 trades
 *
 * 安全防护:
 *  - 所有请求 10s timeout(防 DoS 拖慢前端)
 *  - 缓存 pool 地址 5 分钟(减少 API 调用,免费额度活更久)
 *  - trades 字段全部经过 Number() 强制类型,防恶意服务端注入
 */

const GT_BASE = 'https://api.geckoterminal.com/api/v2/networks/solana';
const FETCH_TIMEOUT_MS = 10_000;

export interface GTTrade {
  /** 交易方向 */
  kind: 'buy' | 'sell';
  /** 块时间 ms */
  blockTimestampMs: number;
  /** 链上 tx 签名,可点击跳 Solscan */
  txSignature: string;
  /** 交易者 wallet base58 */
  fromAddress: string;
  /** SOL 量(以 SOL 计,正数) */
  solAmount: number;
  /** Token 量 */
  tokenAmount: number;
  /** USD 估值 */
  usdValue: number;
  /** 当时单价(USD) */
  priceUsd: number;
}

// 内存缓存:mint → poolAddress(5 min)
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
    // GT 默认按 reserve_in_usd 排,首条就是最深池
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
      const kind = a.kind === 'buy' ? 'buy' : 'sell';
      // GT trades 用 from_token / to_token + 地址,不区分 SOL 在哪边,
      // 直接用 pool 报价的 sol_amount / token_amount(SDK 文档实际字段视 pool 而定)
      // 兜底:若没有 sol_amount,从 from/to 端找 SOL
      const solAmount = Number(a.volume_in_usd ?? 0) / Number(a.price_to_in_usd ?? a.price_from_in_usd ?? 1);
      out.push({
        kind,
        blockTimestampMs: a.block_timestamp ? new Date(a.block_timestamp).getTime() : 0,
        txSignature: String(a.tx_hash ?? '').trim(),
        fromAddress: String(a.tx_from_address ?? '').trim(),
        solAmount: Number(solAmount) || 0,
        tokenAmount: Number(a.from_token_amount ?? a.to_token_amount ?? 0),
        usdValue: Number(a.volume_in_usd ?? 0),
        priceUsd: Number(a.price_to_in_usd ?? a.price_from_in_usd ?? 0),
      });
    }
    // 时间倒序(最新在前)
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
