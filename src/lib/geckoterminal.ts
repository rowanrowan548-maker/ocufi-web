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

/** 入口:mint → 一把拉到 trades(失败返回空数组) */
export async function fetchMintTrades(mint: string, limit = 100): Promise<GTTrade[]> {
  if (!mint) return [];
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    // 后端未配置 → 不走直击 GT 回落(防 BUG-035 限速复燃),返空
    console.warn('[gt-trades] NEXT_PUBLIC_API_URL not set, trades disabled');
    return [];
  }
  const safeLimit = Math.min(Math.max(1, Math.floor(limit) || 100), 1000);
  const url =
    `${apiUrl.replace(/\/$/, '')}/token/trades` +
    `?mint=${encodeURIComponent(mint)}&limit=${safeLimit}`;

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
