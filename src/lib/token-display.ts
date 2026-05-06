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
  /** P3-FE-14 · 主流币静态 logoURI · SSR 就有头像 · 不等异步 · 异步仍可升级覆盖 */
  logoURI?: string;
}

// P3-FE-14 · 静态 logo 兜底:用 solana-labs/token-list 主仓 raw URL · 永久公链托管
// 异步 jupiter/birdeye 仍跑 · 拿到更新就 setState 覆盖 · 这里只保 SSR 首帧不空
const SOLANA_LABS_LOGO = (mint: string) =>
  `https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/${mint}/logo.png`;

const KNOWN_TOKENS: Record<string, TokenDisplay> = {
  // 稳定币
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', name: 'USD Coin', logoURI: SOLANA_LABS_LOGO('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', name: 'Tether USD', logoURI: SOLANA_LABS_LOGO('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB') },
  // 原生 + wrapped
  'So11111111111111111111111111111111111111112':  { symbol: 'SOL',  name: 'Wrapped SOL', logoURI: SOLANA_LABS_LOGO('So11111111111111111111111111111111111111112') },
  // 主流 LST
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So':  { symbol: 'mSOL', name: 'Marinade Staked SOL', logoURI: SOLANA_LABS_LOGO('mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So') },
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': { symbol: 'JitoSOL', name: 'Jito Staked SOL', logoURI: SOLANA_LABS_LOGO('J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn') },
  'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1':  { symbol: 'bSOL', name: 'BlazeStake Staked SOL', logoURI: SOLANA_LABS_LOGO('bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1') },
  // DeFi 治理 / 蓝筹
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN':  { symbol: 'JUP',  name: 'Jupiter', logoURI: 'https://static.jup.ag/jup/icon.png' },
  'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL':  { symbol: 'JTO',  name: 'Jito',    logoURI: SOLANA_LABS_LOGO('jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL') },
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': { symbol: 'PYTH', name: 'Pyth Network', logoURI: SOLANA_LABS_LOGO('HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3') },
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': { symbol: 'RAY',  name: 'Raydium', logoURI: SOLANA_LABS_LOGO('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R') },
  'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE':  { symbol: 'ORCA', name: 'Orca',    logoURI: SOLANA_LABS_LOGO('orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE') },
  '27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4': { symbol: 'JLP',  name: 'Jupiter Perps LP' },
  // 主流 meme · arweave 永久 + raw GH 兜底
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': { symbol: 'WIF',  name: 'dogwifhat', logoURI: 'https://bafkreibk3covs5ltyqxa272uodhculbr6kea6betidfwy3ajsav2vjzyum.ipfs.nftstorage.link' },
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': { symbol: 'BONK', name: 'Bonk',      logoURI: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I' },
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

// ─── P3-FE-15 · React hook · 报告 / 持仓行真名 + logo 客户端兜底 ───
//
// 熵减 #4:链上 fallbackSymbol 写 mint.slice(0,4)("DezX")· 用户看不出币
//
// P3-FE-15 Q1 · jupiter 域名 DNS 真死(`token.jup.ag` Could not resolve host)
//   · 全切 birdeye 主源 · 砍 jupiter-token-list 调用
//   两层 lookup · 异步升级触发 re-render:
//     1. KNOWN_TOKENS sync(主流币 · 静态 logoURI 兜底 SSR 首帧)
//     2. Birdeye `/v3/token/meta-multiple` · per-mint localStorage 24h
//   任一拿到 logoURI 都立即 setState · re-render 显 logo

import { useEffect, useMemo, useState } from 'react';
import {
  lookupBirdeyeMeta,
  lookupBirdeyeMetaSync,
} from './birdeye-token-meta';

export type TokenMeta = {
  symbol: string;
  name: string | null;
  logoURI: string | null;
};

/**
 * mint → {symbol, name, logoURI} · 异步升级
 * P3-FE-15 Q1 · 砍 jupiter(域名 DNS 死)· 主源 birdeye
 * 1. KNOWN_TOKENS 命中 → 立即返完整(含静态 logoURI)
 * 2. Birdeye cache 同步命中 → 立即返完整
 * 3. 都没 → 返 backendSymbol / shortMint fallback · useEffect 异步打 birdeye · 拿到 setState
 */
export function useTokenMeta(
  mint: string,
  backendSymbol?: string | null,
): TokenMeta {
  const initial = useMemo<TokenMeta>(() => {
    if (!mint) return { symbol: '', name: null, logoURI: null };
    const known = KNOWN_TOKENS[mint];
    if (known) return { symbol: known.symbol, name: known.name, logoURI: known.logoURI ?? null };
    const bird = lookupBirdeyeMetaSync(mint);
    if (bird) return { symbol: bird.symbol, name: bird.name || null, logoURI: bird.logoURI || null };
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
    if (!mint) return;
    let cancelled = false;
    // P3-FE-15 · 直接打 birdeye · 砍 jupiter(DNS 死 · 反复打更慢)
    lookupBirdeyeMeta(mint).then((bird) => {
      if (cancelled || !bird) return;
      setMeta((prev) => ({
        symbol: bird.symbol || prev.symbol,
        name: bird.name || prev.name,
        // birdeye 没 logo 时不覆盖已有 KNOWN logo
        logoURI: bird.logoURI || prev.logoURI,
      }));
    });
    return () => {
      cancelled = true;
    };
  }, [mint, initial]);

  return meta;
}

/** P3-FE-15 · jupiter 死 · 此 hook 留兼容空壳 · 调用方不动 */
export function usePreloadJupiterList(): void {
  // no-op · jupiter 域名 DNS 死 · 不再预热
}
