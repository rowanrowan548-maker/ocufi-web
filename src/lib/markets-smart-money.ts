/**
 * T-MARKETS-DIFFER-V2 · 聪明钱在买 · /markets 行级懒加载 hook
 *
 * 后端契约(2026-04-30 实测):
 *   GET /markets/smart-money?mint=X
 *   → { ok, mint, count, recent_buyers: [{wallet, buy_amount_usd, buy_at, profit_30d_usd?}], note, fetched_at }
 *
 * 模块级缓存 + inflight dedup · 多行同 mint 共享 1 次请求
 * V1 占位:后端聪明钱算法可能 cold cache 返 count=0 · UI 必须 graceful
 */

const TTL_MS = 5 * 60_000; // 5min · 聪明钱数据后端有 24h cache,前端再短缓存够
const FETCH_TIMEOUT_MS = 8_000;

export interface SmartMoneyBuyer {
  wallet: string;
  buy_amount_usd: number;
  buy_at: number;
  profit_30d_usd?: number | null;
}

export interface SmartMoneyResp {
  ok: boolean;
  mint: string;
  count: number;
  recent_buyers: SmartMoneyBuyer[];
  note?: string | null;
  fetched_at?: number | null;
}

const cache = new Map<string, { data: SmartMoneyResp; expiresAt: number }>();
const inflight = new Map<string, Promise<SmartMoneyResp>>();

const EMPTY: SmartMoneyResp = { ok: false, mint: '', count: 0, recent_buyers: [] };

export async function fetchSmartMoney(mint: string): Promise<SmartMoneyResp> {
  if (!mint) return EMPTY;

  const c = cache.get(mint);
  if (c && c.expiresAt > Date.now()) return c.data;

  let p = inflight.get(mint);
  if (!p) {
    p = doFetch(mint).then((d) => {
      cache.set(mint, { data: d, expiresAt: Date.now() + TTL_MS });
      return d;
    }).finally(() => {
      inflight.delete(mint);
    });
    inflight.set(mint, p);
  }
  return p;
}

async function doFetch(mint: string): Promise<SmartMoneyResp> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return { ...EMPTY, mint };

  const url = `${apiUrl.replace(/\/$/, '')}/markets/smart-money?mint=${encodeURIComponent(mint)}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) return { ...EMPTY, mint };
    const json = await res.json();
    if (!json || json.ok !== true) return { ...EMPTY, mint };
    return {
      ok: true,
      mint: String(json.mint ?? mint),
      count: Number(json.count ?? 0),
      recent_buyers: Array.isArray(json.recent_buyers)
        ? json.recent_buyers.map((b: unknown) => normalizeBuyer(b)).filter(Boolean) as SmartMoneyBuyer[]
        : [],
      note: json.note ?? null,
      fetched_at: typeof json.fetched_at === 'number' ? json.fetched_at : null,
    };
  } catch {
    return { ...EMPTY, mint };
  }
}

function normalizeBuyer(b: unknown): SmartMoneyBuyer | null {
  if (!b || typeof b !== 'object') return null;
  const o = b as Record<string, unknown>;
  const wallet = String(o.wallet ?? '').trim();
  if (!wallet) return null;
  return {
    wallet,
    buy_amount_usd: Number(o.buy_amount_usd ?? 0),
    buy_at: Number(o.buy_at ?? 0),
    profit_30d_usd: o.profit_30d_usd != null ? Number(o.profit_30d_usd) : null,
  };
}
