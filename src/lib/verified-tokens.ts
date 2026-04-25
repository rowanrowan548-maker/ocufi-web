/**
 * 已验证代币白名单
 *
 * 这些代币是公认的主流/稳定币/蓝筹,通用的"Mint 权限未放弃 / LP 未烧"等判断
 * 对它们来说是**误判**(例如 USDC/USDT 是合规稳定币,保留 mint 权限是法律要求)。
 *
 * 命中白名单 → 直接判为 "verified" 风险等级,跳过通用评分。
 *
 * V1 硬编码;V2 可接 Jupiter Strict List 动态拉取。
 */

export const VERIFIED_MINTS: Set<string> = new Set([
  // 稳定币
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  // 原生 + wrapped
  'So11111111111111111111111111111111111111112',  // SOL / wSOL
  // 主流 LST
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', // mSOL (Marinade)
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', // JitoSOL
  'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1', // bSOL
  // DeFi 治理 / 蓝筹
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',  // JUP
  'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',  // JTO
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', // PYTH
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', // RAY
  'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',  // ORCA
  '27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4', // JLP (Jupiter LP,有 freeze 权限是合规要求,白名单)
  // 主流 meme(被社区 + Jupiter 验证)
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF (dogwifhat)
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
  'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5',  // MEW
  '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', // POPCAT
  '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN', // TRUMP (Official,有 freeze 权限是发行方法律合规,白名单)
  '2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump', // PNUT
  'CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump', // GOAT
  '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump', // FARTCOIN
  'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82',  // BOME
]);

export function isVerifiedToken(mint: string): boolean {
  return VERIFIED_MINTS.has(mint);
}

/** 稳定币集合(用于滑点默认分档,稳定币深度好,0.5% 足够) */
export const STABLE_MINTS: Set<string> = new Set([
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
]);

export function isStableToken(mint: string): boolean {
  return STABLE_MINTS.has(mint);
}

/**
 * 按 token 类型推荐默认滑点(bps)
 *  - 稳定币:默认 50 (0.5%)
 *  - verified 蓝筹:默认 100 (1%)
 *  - 其他(meme / pump):默认 500 (5%)
 * 读取用户 /settings 自定义值覆盖默认
 *
 * 买入时传 outputMint(要收到的币);卖出时传 inputMint(要卖掉的币)
 */
import { getSlippageProfile } from './user-settings';

export function recommendedSlippageBps(mint: string): number {
  const p = getSlippageProfile();
  if (isStableToken(mint)) return p.stable;
  if (isVerifiedToken(mint)) return p.verified;
  return p.meme;
}
