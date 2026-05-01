/**
 * 持仓数据工具
 *
 * 3 件事:
 * 1. fetchWalletTokens — 读链上钱包所有 SPL + Token-2022 余额
 * 2. fetchTokenInfo     — 按 mint 查符号/名字/现价/市值/流动性(DexScreener)
 * 3. fetchSolUsdPrice   — SOL 美元价(DexScreener SOL mint)
 */
import { Connection, PublicKey } from '@solana/web3.js';
import { isStableToken } from './verified-tokens';
import { fetchSearchTokens } from './api-client';

export const TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
);
export const TOKEN_2022_PROGRAM_ID = new PublicKey(
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
);
export const SOL_MINT = 'So11111111111111111111111111111111111111112';

/** 防御:剥离控制字符 + 截断,挡 DexScreener 返回的超长 / 不可见字符 */
function safeText(s: unknown, max = 64): string {
  if (typeof s !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max);
}

/** 防御:logo URL 必须 https / data 协议,挡 javascript: / 内网穿透 */
function safeUrl(u: unknown): string | undefined {
  if (typeof u !== 'string') return undefined;
  const t = u.trim();
  if (!t) return undefined;
  if (/^(https?:|data:image\/)/i.test(t)) return t.slice(0, 500);
  return undefined;
}

export interface WalletToken {
  mint: string;
  amount: number;      // uiAmount
  decimals: number;
}

export async function fetchWalletTokens(
  connection: Connection,
  owner: PublicKey
): Promise<WalletToken[]> {
  const programs = [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID];
  const out: WalletToken[] = [];

  for (const programId of programs) {
    try {
      const res = await connection.getParsedTokenAccountsByOwner(owner, {
        programId,
      });
      for (const acc of res.value) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const info: any = acc.account.data;
        const parsed = info?.parsed?.info;
        if (!parsed) continue;
        const amt = parsed.tokenAmount;
        if (!amt) continue;
        const ui = Number(amt.uiAmount ?? 0);
        if (ui <= 0) continue;  // 跳过空账户
        out.push({
          mint: parsed.mint,
          amount: ui,
          decimals: Number(amt.decimals ?? 0),
        });
      }
    } catch (e) {
      console.warn(`[portfolio] ${programId.toBase58().slice(0, 8)} scan failed:`, e);
    }
  }

  return out;
}

const DEXSCREENER_URL = 'https://api.dexscreener.com/latest/dex/tokens';
// 批量端点(v1):一次最多 30 个 mint,用 / 分隔,把 N 次请求降到 1 次
const DEXSCREENER_BATCH_URL = 'https://api.dexscreener.com/tokens/v1/solana';

// 内存缓存 · 30s TTL · 防免费 API 限速 + 同 mint 反复刷不重复打外部
const TOKEN_CACHE_TTL_MS = 30_000;
const tokenCache = new Map<string, { data: TokenInfo | null; expiresAt: number }>();
const inflight = new Map<string, Promise<TokenInfo | null>>();

export interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  priceUsd: number;
  priceNative: number;       // 以 SOL 计
  liquidityUsd: number;
  marketCap: number;
  priceChange24h?: number;   // 百分比,可能正可能负
  priceChange6h?: number;
  priceChange1h?: number;
  priceChange5m?: number;
  volume24h?: number;
  logoUri?: string;
  /** pair 创建时间(ms),用于 NEW 标签 */
  pairCreatedAt?: number;
  /** T-708:深度最高 pair 的链上地址 · 给 chart-card GT iframe 拼 URL */
  topPoolAddress?: string;
}

/**
 * 把 DexScreener pair 列表(同一个 mint 的多个 pair)聚合成 TokenInfo
 *
 * 坑 1:mint 可能是 pair 里的 quoteToken,要过滤 baseToken.address === mint
 * 坑 2:深度最高的 pair 不一定带 fdv,要遍历找
 * 坑 3:SOL(WSOL mint)经常缺 fdv,用流通量 fallback
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pairsToTokenInfo(mint: string, allPairs: any[]): TokenInfo | null {
  const solPairs = allPairs.filter(
    (p) => p?.chainId === 'solana' && p?.baseToken?.address === mint
  );
  if (solPairs.length === 0) return null;
  solPairs.sort(
    (a, b) =>
      Number(b?.liquidity?.usd ?? 0) - Number(a?.liquidity?.usd ?? 0)
  );
  const top = solPairs[0];
  const base = top.baseToken ?? {};

  let priceChange24h: number | undefined =
    top.priceChange?.h24 != null ? Number(top.priceChange.h24) : undefined;
  if (priceChange24h == null && isStableToken(mint)) priceChange24h = 0;

  const priceUsd = Number(top.priceUsd ?? 0);
  let marketCap = 0;
  for (const p of solPairs) {
    const m = Number(p?.fdv ?? p?.marketCap ?? 0);
    if (m > 0) { marketCap = m; break; }
  }
  if (marketCap === 0 && mint === SOL_MINT && priceUsd > 0) {
    marketCap = priceUsd * 580_000_000;
  }

  return {
    mint,
    symbol: safeText(base.symbol, 24) || mint.slice(0, 6),
    name: safeText(base.name, 64),
    priceUsd,
    priceNative: Number(top.priceNative ?? 0),
    liquidityUsd: Number(top.liquidity?.usd ?? 0),
    marketCap,
    priceChange24h,
    priceChange6h: top.priceChange?.h6 != null ? Number(top.priceChange.h6) : undefined,
    priceChange1h: top.priceChange?.h1 != null ? Number(top.priceChange.h1) : undefined,
    priceChange5m: top.priceChange?.m5 != null ? Number(top.priceChange.m5) : undefined,
    volume24h: Number(top.volume?.h24 ?? 0) || undefined,
    logoUri: safeUrl(top.info?.imageUrl),
    pairCreatedAt: top.pairCreatedAt ? Number(top.pairCreatedAt) : undefined,
    topPoolAddress: typeof top.pairAddress === 'string' && top.pairAddress
      ? top.pairAddress
      : undefined,
  };
}

function setCache(mint: string, data: TokenInfo | null) {
  tokenCache.set(mint, { data, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS });
}

function getCached(mint: string): { data: TokenInfo | null; fresh: boolean } | null {
  const entry = tokenCache.get(mint);
  if (!entry) return null;
  return { data: entry.data, fresh: entry.expiresAt > Date.now() };
}

/**
 * 单 mint 元数据 + 现价
 *
 * 缓存策略:
 *  - 30s 内同 mint 走缓存,完全不打 DexScreener
 *  - 同一 mint 的并发请求合并,只发一次外部
 *  - 外部失败时退回最后一份缓存(stale-while-error),避免限速时空白
 */
export async function fetchTokenInfo(mint: string): Promise<TokenInfo | null> {
  const cached = getCached(mint);
  if (cached?.fresh) return cached.data;

  const existing = inflight.get(mint);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const res = await fetch(`${DEXSCREENER_URL}/${mint}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        // 限速/出错时如有旧缓存就返回旧的,别给用户空白
        if (cached) return cached.data;
        setCache(mint, null);
        return null;
      }
      const data = await res.json();
      const info = pairsToTokenInfo(mint, data?.pairs ?? []);
      setCache(mint, info);
      return info;
    } catch (e) {
      console.warn('[portfolio] fetchTokenInfo', mint.slice(0, 8), e);
      // 网络错误时优先返回旧缓存
      if (cached) return cached.data;
      return null;
    } finally {
      inflight.delete(mint);
    }
  })();

  inflight.set(mint, promise);
  return promise;
}

/**
 * 批量查 · 用 DexScreener v1 批量端点
 *
 * 一次请求最多 30 个 mint,16 个币原本 16 次请求,现在 1 次搞定 — 限速压力降到 1/16
 *
 * 缓存里有的 mint 直接复用,不进网络请求
 */
export async function fetchTokensInfoBatch(
  mints: string[]
): Promise<Map<string, TokenInfo>> {
  const result = new Map<string, TokenInfo>();
  const toFetch: string[] = [];

  for (const m of mints) {
    const cached = getCached(m);
    if (cached?.fresh) {
      if (cached.data) result.set(m, cached.data);
    } else {
      toFetch.push(m);
    }
  }

  if (toFetch.length === 0) return result;

  // DexScreener v1 批量端点:GET /tokens/v1/solana/{addr,addr,addr}
  // 每段最多 30 个 mint,超出分批
  const chunks: string[][] = [];
  for (let i = 0; i < toFetch.length; i += 30) {
    chunks.push(toFetch.slice(i, i + 30));
  }

  await Promise.all(chunks.map(async (chunk) => {
    try {
      const url = `${DEXSCREENER_BATCH_URL}/${chunk.join(',')}`;
      const res = await fetch(url, {
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        // 限速 / 失败:复用旧缓存兜底
        for (const m of chunk) {
          const cached = getCached(m);
          if (cached?.data) result.set(m, cached.data);
        }
        return;
      }
      // v1 端点返回的是 pair 数组(扁平,所有 mint 的 pair 混在一起)
      const allPairs = (await res.json()) as unknown[];
      // 按 mint 聚合
      const byMint = new Map<string, unknown[]>();
      for (const p of allPairs as Array<{ baseToken?: { address?: string } }>) {
        const addr = p?.baseToken?.address;
        if (!addr) continue;
        if (!byMint.has(addr)) byMint.set(addr, []);
        byMint.get(addr)!.push(p);
      }
      for (const m of chunk) {
        const info = pairsToTokenInfo(m, (byMint.get(m) as unknown[]) ?? []);
        setCache(m, info);
        if (info) result.set(m, info);
      }
    } catch (e) {
      console.warn('[portfolio] fetchTokensInfoBatch chunk', e);
      // 整段失败 → 复用旧缓存
      for (const m of chunk) {
        const cached = getCached(m);
        if (cached?.data) result.set(m, cached.data);
      }
    }
  }));

  return result;
}

/** SOL 美元价(从 DexScreener 查 WSOL mint) */
export async function fetchSolUsdPrice(): Promise<number> {
  const info = await fetchTokenInfo(SOL_MINT);
  return info?.priceUsd ?? 0;
}

/**
 * 按 symbol / name / mint 搜索 Solana 代币
 *
 * R3-FE · 走后端 `/search/tokens`(R3-BE `3a631f4`)· Birdeye 主 + GT 兜底
 * 之前直接打 DexScreener · 用户实测搜 USDC 卡 10s+(限速踩在前端 IP 上)
 *
 * GT 兜底路径不返 symbol(name 形如 "Bonk / SOL")· 用 name 第一段切兜底 symbol。
 */
export async function searchTokens(query: string, limit = 20): Promise<TokenInfo[]> {
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];
  try {
    const items = await fetchSearchTokens(q, limit);
    return items.map((it) => {
      const rawSymbol = safeText(it.symbol, 24);
      const rawName = safeText(it.name, 80);
      const fallbackSymbol = rawName.split('/')[0]?.trim() ?? '';
      const symbol = rawSymbol || fallbackSymbol || it.mint.slice(0, 6);
      const volume24h = it.volume_24h_usd != null ? Number(it.volume_24h_usd) : undefined;
      return {
        mint: it.mint,
        symbol,
        name: rawName,
        priceUsd: Number(it.price_usd ?? 0),
        priceNative: 0,
        liquidityUsd: Number(it.liquidity_usd ?? 0),
        marketCap: Number(it.market_cap_usd ?? 0),
        volume24h: Number.isFinite(volume24h) ? volume24h : undefined,
        logoUri: safeUrl(it.logoURI),
      };
    });
  } catch (e) {
    console.warn('[portfolio] searchTokens', q, e);
    return [];
  }
}
