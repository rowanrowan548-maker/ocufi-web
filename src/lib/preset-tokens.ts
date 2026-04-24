/**
 * V1 阶段预置的"常用代币"池
 * 用于:首页代币行情主表 / 交易页搜索下拉的候选
 *
 * V2:接后端 /market/top 动态拉热门 + 持仓回填,替换静态池
 */

export const PRESET_BLUE_CHIPS = [
  'So11111111111111111111111111111111111111112',  // SOL
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',  // JUP
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', // PYTH
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', // ETH (Portal)
  '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E', // BTC (Portal)
  'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof',  // RENDER
  'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',  // JTO
];

export const PRESET_MEME = [
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
  'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5',  // MEW
  '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', // POPCAT
];

export const PRESET_LST = [
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',  // mSOL
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', // JitoSOL
  'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1',  // bSOL
  '7Q2afV64in6N6SeZsAAB81TJzwDoD6zpqmHkzi9Dcavn', // jupSOL
  'BNso1VUJnh4zcfpZa6986Ea66P6TCp59hvtNJ8b1X85',  // BNSOL
];

export const PRESET_STABLE = [
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
];

export const PRESET_ALL = Array.from(
  new Set([...PRESET_BLUE_CHIPS, ...PRESET_MEME, ...PRESET_LST, ...PRESET_STABLE])
);

export const SOL_MINT = 'So11111111111111111111111111111111111111112';
