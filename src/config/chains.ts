/**
 * 多链配置抽象
 * V1 只启用 Solana;V2 扩展 Base / Arbitrum / ...
 *
 * 业务代码禁止硬编码 "solana" 或 Solana 专属 RPC URL
 * 统一走 getCurrentChain() 取配置
 */

export type ChainId = 'solana' | 'base' | 'arbitrum'; // V2 扩展

export interface DexAggregatorConfig {
  name: string;
  quoteUrl?: string;
  swapUrl?: string;
  limitOrderUrl?: string;
  priceUrl?: string;
  feeReceiver?: string;     // 我们的 0.1% 手续费接收地址
  platformFeeBps: number;   // 我们收的基点,默认 10 = 0.1%
}

export interface ChainConfig {
  id: ChainId;
  name: string;
  nativeSymbol: string;
  rpcUrl: string;
  explorer: string;
  dexAggregator: DexAggregatorConfig;
  walletAdapters: readonly string[];
  enabled: boolean;
}

/**
 * RPC URL 的取值优先级:
 * 1. 环境变量 NEXT_PUBLIC_HELIUS_RPC(推荐,生产用 Helius)
 * 2. 公共 mainnet-beta (限速严,仅开发回退)
 */
const SOLANA_RPC =
  process.env.NEXT_PUBLIC_HELIUS_RPC ||
  process.env.NEXT_PUBLIC_SOLANA_RPC ||
  'https://api.mainnet-beta.solana.com';

const SOLANA_FEE_RECEIVER =
  process.env.NEXT_PUBLIC_JUPITER_FEE_ACCOUNT || '';

export const CHAIN_CONFIGS: Record<ChainId, ChainConfig> = {
  solana: {
    id: 'solana',
    name: 'Solana',
    nativeSymbol: 'SOL',
    rpcUrl: SOLANA_RPC,
    explorer: 'https://solscan.io',
    dexAggregator: {
      name: 'Jupiter',
      quoteUrl: 'https://lite-api.jup.ag/swap/v1/quote',
      swapUrl: 'https://lite-api.jup.ag/swap/v1/swap',
      limitOrderUrl: 'https://api.jup.ag/limit/v2',
      priceUrl: 'https://api.jup.ag/price/v3',
      feeReceiver: SOLANA_FEE_RECEIVER,
      platformFeeBps: 10,   // 0.1%(V1 仅买入收 · sell 0%)
    },
    walletAdapters: ['phantom', 'solflare'] as const,
    enabled: true,
  },
  // V2 ──────────────────────────────────
  base: {
    id: 'base',
    name: 'Base',
    nativeSymbol: 'ETH',
    rpcUrl: '',
    explorer: 'https://basescan.org',
    dexAggregator: {
      name: '0x API',
      platformFeeBps: 10,
    },
    walletAdapters: ['metamask', 'rabby'],
    enabled: false,
  },
  arbitrum: {
    id: 'arbitrum',
    name: 'Arbitrum',
    nativeSymbol: 'ETH',
    rpcUrl: '',
    explorer: 'https://arbiscan.io',
    dexAggregator: {
      name: '0x API',
      platformFeeBps: 10,
    },
    walletAdapters: ['metamask', 'rabby'],
    enabled: false,
  },
};

/** V1 默认固定 Solana。V2 会从 URL / localStorage 动态取 */
export const DEFAULT_CHAIN: ChainId = 'solana';

export function getCurrentChain(): ChainConfig {
  return CHAIN_CONFIGS[DEFAULT_CHAIN];
}

export function getEnabledChains(): ChainConfig[] {
  return Object.values(CHAIN_CONFIGS).filter((c) => c.enabled);
}
