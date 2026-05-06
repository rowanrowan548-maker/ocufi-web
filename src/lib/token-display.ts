/**
 * 静态 mint → symbol/name 查表 · R4 (2026-05-01)
 *
 * 后端 /portfolio/empty-accounts 给的 token_symbol 字段对很多 mint 是 null ·
 * 用户截图 /rewards 列表显 EPjF...Dt1v / DidTDX5M..BKxW8u 看不出币 ·
 * 必须本地兜底:常用 mint(覆盖 verified-tokens.ts + LST + 主流 meme)
 *
 * V2 升级:接 Jupiter token list `https://token.jup.ag/all` 全量动态
 */

interface TokenDisplay {
  symbol: string;
  name: string;
}

const KNOWN_TOKENS: Record<string, TokenDisplay> = {
  // 稳定币
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', name: 'USD Coin' },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', name: 'Tether USD' },
  // 原生 + wrapped
  'So11111111111111111111111111111111111111112':  { symbol: 'SOL',  name: 'Wrapped SOL' },
  // 主流 LST
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So':  { symbol: 'mSOL', name: 'Marinade Staked SOL' },
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': { symbol: 'JitoSOL', name: 'Jito Staked SOL' },
  'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1':  { symbol: 'bSOL', name: 'BlazeStake Staked SOL' },
  // DeFi 治理 / 蓝筹
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN':  { symbol: 'JUP',  name: 'Jupiter' },
  'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL':  { symbol: 'JTO',  name: 'Jito' },
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': { symbol: 'PYTH', name: 'Pyth Network' },
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': { symbol: 'RAY',  name: 'Raydium' },
  'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE':  { symbol: 'ORCA', name: 'Orca' },
  '27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4': { symbol: 'JLP',  name: 'Jupiter Perps LP' },
  // 主流 meme
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': { symbol: 'WIF',  name: 'dogwifhat' },
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': { symbol: 'BONK', name: 'Bonk' },
  'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5':  { symbol: 'MEW',  name: 'cat in a dogs world' },
  '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr': { symbol: 'POPCAT', name: 'Popcat' },
  '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN': { symbol: 'TRUMP', name: 'Official Trump' },
  '2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump': { symbol: 'PNUT', name: 'Peanut the Squirrel' },
  'CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump': { symbol: 'GOAT', name: 'Goatseus Maximus' },
  '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump': { symbol: 'FARTCOIN', name: 'Fartcoin' },
  'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82':  { symbol: 'BOME', name: 'BOOK OF MEME' },
};

export interface ResolvedTokenDisplay {
  symbol: string;
  /** 全名 · 空 = 没找到 / 未知 token */
  name: string;
  /** 是否命中 KNOWN_TOKENS · false 时 symbol 走后端 fallback 或 'Unknown' */
  isKnown: boolean;
}

/**
 * mint → 显示用 symbol+name
 * - 命中 KNOWN_TOKENS → 用静态表
 * - 否则用 backendSymbol(后端返的) · 拼空 name
 * - 都没有 → 'Unknown' + name = trunc mint(让用户至少看到地址)
 */
export function lookupTokenDisplay(
  mint: string,
  backendSymbol?: string | null,
): ResolvedTokenDisplay {
  const known = KNOWN_TOKENS[mint];
  if (known) return { ...known, isKnown: true };
  if (backendSymbol) return { symbol: backendSymbol, name: '', isKnown: false };
  return { symbol: 'Unknown', name: shortMint(mint), isKnown: false };
}

/** mint 缩写 · 4...4 · 跨组件通用 */
export function shortMint(mint: string): string {
  if (mint.length <= 10) return mint;
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

// ─── P3-FE-10 · React hook · 报告 / 持仓行真名 + logo 客户端兜底 ───
//
// 熵减 #4:链上 fallbackSymbol 写 mint.slice(0,4)("DezX")· 用户看不出币
// → KNOWN_TOKENS sync 命中走静态 / 否则 hook 拉 Jupiter strict 异步升级
// 不改 mapReportToView · 在 view 层用

import { useEffect, useMemo, useState } from 'react';
import {
  lookupJupiterToken,
  lookupJupiterTokenSync,
  preloadJupiterList,
} from './jupiter-token-list';

export type TokenMeta = {
  symbol: string;
  name: string | null;
  logoURI: string | null;
};

/**
 * mint → {symbol, name, logoURI} · 异步升级
 * 1. KNOWN_TOKENS 命中 → 立即返(无 logo)
 * 2. Jupiter strict cache 同步命中 → 立即返完整
 * 3. 都没 → 返 backendSymbol fallback · useEffect 拉 Jupiter · 拿到 setState
 */
export function useTokenMeta(
  mint: string,
  backendSymbol?: string | null,
): TokenMeta {
  const initial = useMemo<TokenMeta>(() => {
    const known = KNOWN_TOKENS[mint];
    if (known) return { symbol: known.symbol, name: known.name, logoURI: null };
    const jup = lookupJupiterTokenSync(mint);
    if (jup) return { symbol: jup.symbol, name: jup.name, logoURI: jup.logoURI };
    // backend symbol 像 mint 切片(<5 字 · 跟 mint.slice(0,4) 重合)= 假 · 改 shortMint
    const looksFake =
      !backendSymbol ||
      backendSymbol.length < 5 ||
      mint.toLowerCase().startsWith(backendSymbol.toLowerCase());
    return {
      symbol: looksFake ? shortMint(mint) : (backendSymbol as string),
      name: null,
      logoURI: null,
    };
  }, [mint, backendSymbol]);

  const [meta, setMeta] = useState<TokenMeta>(initial);

  useEffect(() => {
    setMeta(initial);
    if (KNOWN_TOKENS[mint] || lookupJupiterTokenSync(mint)) return;
    let cancelled = false;
    lookupJupiterToken(mint).then((t) => {
      if (cancelled || !t) return;
      setMeta({ symbol: t.symbol, name: t.name, logoURI: t.logoURI });
    });
    return () => {
      cancelled = true;
    };
  }, [mint, initial]);

  return meta;
}

/** 预热 Jupiter list · 持仓 / 首页 mount 调一次 · 后续 sync 查无延迟 */
export function usePreloadJupiterList(): void {
  useEffect(() => {
    preloadJupiterList();
  }, []);
}
