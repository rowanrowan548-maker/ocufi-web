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
}

/**
 * 查 mint 的元数据 + 现价。拿不到返回 null
 * 坑:DexScreener 返回的 pairs 里,mint 可能是 quoteToken(不是 baseToken),
 * 必须过滤 `baseToken.address === mint` 才是该 token 的正确信息
 */
export async function fetchTokenInfo(mint: string): Promise<TokenInfo | null> {
  try {
    const res = await fetch(`${DEXSCREENER_URL}/${mint}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pairs: any[] = data?.pairs ?? [];
    const solPairs = pairs.filter(
      (p) =>
        p?.chainId === 'solana' &&
        p?.baseToken?.address === mint
    );
    if (solPairs.length === 0) return null;
    // 按流动性排序取最大的那个 pair
    solPairs.sort(
      (a, b) =>
        Number(b?.liquidity?.usd ?? 0) - Number(a?.liquidity?.usd ?? 0)
    );
    const top = solPairs[0];
    const base = top.baseToken ?? {};
    // 稳定币:DexScreener 在 USDC-as-base 池子(多半深度低)的 priceChange 不可靠,
    // 直接置 0(0.00% 比 — 更直观,稳定币本来就接近 0%)
    let priceChange24h: number | undefined =
      top.priceChange?.h24 != null ? Number(top.priceChange.h24) : undefined;
    if (priceChange24h == null && isStableToken(mint)) priceChange24h = 0;

    // 市值:深度最高的 pair 不一定带 fdv 字段,找首个非 0 的;
    // SOL(WSOL mint)在 DexScreener 上经常缺 fdv,fallback 到 priceUsd × 已知流通量
    const priceUsd = Number(top.priceUsd ?? 0);
    let marketCap = 0;
    for (const p of solPairs) {
      const m = Number(p?.fdv ?? p?.marketCap ?? 0);
      if (m > 0) { marketCap = m; break; }
    }
    if (marketCap === 0 && mint === SOL_MINT && priceUsd > 0) {
      // SOL 流通量约 5.8 亿(2026-04 时点近似;略保守)
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
    };
  } catch (e) {
    console.warn('[portfolio] fetchTokenInfo', mint.slice(0, 8), e);
    return null;
  }
}

/** 批量查:并发 */
export async function fetchTokensInfoBatch(
  mints: string[]
): Promise<Map<string, TokenInfo>> {
  const results = await Promise.all(mints.map((m) => fetchTokenInfo(m)));
  const map = new Map<string, TokenInfo>();
  results.forEach((r, i) => {
    if (r) map.set(mints[i], r);
  });
  return map;
}

/** SOL 美元价(从 DexScreener 查 WSOL mint) */
export async function fetchSolUsdPrice(): Promise<number> {
  const info = await fetchTokenInfo(SOL_MINT);
  return info?.priceUsd ?? 0;
}

const DEXSCREENER_SEARCH_URL = 'https://api.dexscreener.com/latest/dex/search';

/**
 * 按 symbol / name 搜索 Solana 代币(走 DexScreener)
 * 同一 baseToken 可能多个 pair,按流动性聚合后只取每个 mint 最深的那个
 */
export async function searchTokens(query: string, limit = 20): Promise<TokenInfo[]> {
  const q = query.trim().slice(0, 80);  // 防超长 query
  if (q.length < 2) return [];
  try {
    const res = await fetch(`${DEXSCREENER_SEARCH_URL}?q=${encodeURIComponent(q)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pairs: any[] = (data?.pairs ?? []).filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any) => p?.chainId === 'solana' && p?.baseToken?.address
    );
    // 按流动性降序,聚合 mint(同一 mint 取最深 pair)
    pairs.sort(
      (a, b) =>
        Number(b?.liquidity?.usd ?? 0) - Number(a?.liquidity?.usd ?? 0)
    );
    const seen = new Set<string>();
    const out: TokenInfo[] = [];
    for (const p of pairs) {
      const mint = p.baseToken.address as string;
      if (seen.has(mint)) continue;
      seen.add(mint);
      out.push({
        mint,
        symbol: safeText(p.baseToken.symbol, 24) || mint.slice(0, 6),
        name: safeText(p.baseToken.name, 64),
        priceUsd: Number(p.priceUsd ?? 0),
        priceNative: Number(p.priceNative ?? 0),
        liquidityUsd: Number(p.liquidity?.usd ?? 0),
        marketCap: Number(p.fdv ?? p.marketCap ?? 0),
        priceChange24h: p.priceChange?.h24 != null ? Number(p.priceChange.h24) : undefined,
        volume24h: Number(p.volume?.h24 ?? 0) || undefined,
        logoUri: safeUrl(p.info?.imageUrl),
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch (e) {
    console.warn('[portfolio] searchTokens', q, e);
    return [];
  }
}
