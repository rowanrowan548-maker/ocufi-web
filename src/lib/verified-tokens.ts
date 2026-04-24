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
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', // ETH (Portal)
  '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E', // BTC (Portal)
  // 主流 LST
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', // mSOL (Marinade)
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', // JitoSOL
  'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1', // bSOL
  // 主流 meme(被社区 + Jupiter 验证)
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF (dogwifhat)
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',  // JUP
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', // PYTH
  'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof',  // RENDER
  // Wormhole wrapped
  '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh', // WBTC (Portal)
]);

export function isVerifiedToken(mint: string): boolean {
  return VERIFIED_MINTS.has(mint);
}
