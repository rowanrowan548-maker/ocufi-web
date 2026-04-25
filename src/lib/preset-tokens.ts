/**
 * V1 阶段预置的"常用代币"池
 * 用于:首页代币行情主表 / 交易页搜索下拉的候选
 *
 * 选币原则:
 *  - 必须在 Solana 主网原生发行(不放 wormhole-wrapped wraps,流动性低 + 易混淆)
 *  - 必须有 logo + 足够 24h 成交量
 *  - LST 不进默认池(用户大概率不会主动找抵押衍生品)
 *
 * V2:接后端 /market/top 动态拉热门 + 持仓回填,替换静态池
 */

// 主流币 · 蓝筹 + DeFi 治理币
export const PRESET_MAJORS = [
  'So11111111111111111111111111111111111111112',  // SOL
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',  // JUP
  'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',  // JTO
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', // PYTH
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', // RAY (Raydium)
  'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',  // ORCA
  '27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4', // JLP (Jupiter LP)
];

// Meme · 高热度 / 高市值,新增几个一并放进来,DexScreener 没数据的 row 自动不显示
export const PRESET_MEME = [
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
  'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5',  // MEW
  '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', // POPCAT
  '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN', // TRUMP (Official)
  '2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump', // PNUT
  'CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump', // GOAT
  '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump', // FARTCOIN
  'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82',  // BOME
];

export const PRESET_STABLE = [
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
];

export const PRESET_ALL = Array.from(
  new Set([...PRESET_MAJORS, ...PRESET_MEME, ...PRESET_STABLE])
);

// Deprecated 别名 — 保留导出兼容旧引用,逐步删
export const PRESET_BLUE_CHIPS = PRESET_MAJORS;

export const SOL_MINT = 'So11111111111111111111111111111111111111112';
