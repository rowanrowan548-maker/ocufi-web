/**
 * Jupiter v6 API 封装
 *
 * 两个核心接口:
 * 1. getQuote(input, output, amount, slippageBps)      → 询价,返回预计数量 + 路由
 * 2. getSwapTx(quote, userPubkey, gasLevel)            → 拿到已签名前的交易字节
 *
 * 手续费:通过 platformFeeBps(0.1% = 10)+ feeAccount 自动抽成。
 * V1 先 platformFeeBps=0(跑通全流程),有 referral 账户后改环境变量 NEXT_PUBLIC_JUPITER_FEE_ACCOUNT 即切 10。
 */
import { getCurrentChain } from '@/config/chains';

export const SOL_MINT = 'So11111111111111111111111111111111111111112';

export type GasLevel = 'normal' | 'fast' | 'turbo';

const GAS_CONFIG: Record<GasLevel, { priorityLevel: string; maxLamports: number }> = {
  normal: { priorityLevel: 'medium', maxLamports: 5_000 },
  fast: { priorityLevel: 'high', maxLamports: 50_000 },
  turbo: { priorityLevel: 'veryHigh', maxLamports: 1_000_000 },
};

export interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: 'ExactIn' | 'ExactOut';
  slippageBps: number;
  priceImpactPct: string;
  platformFee?: { amount: string; feeBps: number } | null;
  routePlan: Array<{ swapInfo: unknown; percent: number }>;
  contextSlot?: number;
  timeTaken?: number;
}

export interface QuoteOptions {
  slippageBps?: number;           // 默认 100 = 1%
  platformFeeBps?: number;        // 我们抽成,默认 0;有 referral 后改 10
}

/**
 * 查询 Jupiter 报价
 * @param inputMint  支付的 token mint(买入时是 SOL)
 * @param outputMint 收到的 token mint
 * @param amountRaw  输入原子数量(含小数精度,如 1 SOL = 1_000_000_000 lamports)
 */
export async function getQuote(
  inputMint: string,
  outputMint: string,
  amountRaw: string | number | bigint,
  opts: QuoteOptions = {}
): Promise<JupiterQuote> {
  const chain = getCurrentChain();
  const { slippageBps = 100, platformFeeBps = 0 } = opts;

  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amountRaw.toString(),
    slippageBps: slippageBps.toString(),
  });
  if (platformFeeBps > 0) {
    params.set('platformFeeBps', platformFeeBps.toString());
  }

  const url = `${chain.dexAggregator.quoteUrl}?${params.toString()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Jupiter quote failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as JupiterQuote;
}

export interface SwapOptions {
  userPublicKey: string;
  gasLevel?: GasLevel;
  wrapAndUnwrapSol?: boolean;
  dynamicComputeUnitLimit?: boolean;
  feeAccount?: string;           // 手续费接收地址(referral)
}

export interface JupiterSwapResponse {
  swapTransaction: string;        // base64 serialized VersionedTransaction
  lastValidBlockHeight: number;
  prioritizationFeeLamports?: number;
}

/**
 * 拿到 Jupiter 为这次交易构造好的交易字节(未签名)
 * 下一步交给 wallet adapter 签名 + 广播
 */
export async function getSwapTx(
  quote: JupiterQuote,
  opts: SwapOptions
): Promise<JupiterSwapResponse> {
  const chain = getCurrentChain();
  const {
    userPublicKey,
    gasLevel = 'fast',
    wrapAndUnwrapSol = true,
    dynamicComputeUnitLimit = true,
    feeAccount,
  } = opts;

  const gas = GAS_CONFIG[gasLevel];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: Record<string, any> = {
    quoteResponse: quote,
    userPublicKey,
    wrapAndUnwrapSol,
    dynamicComputeUnitLimit,
    prioritizationFeeLamports: {
      priorityLevelWithMaxLamports: {
        priorityLevel: gas.priorityLevel,
        maxLamports: gas.maxLamports,
      },
    },
  };
  if (feeAccount) body.feeAccount = feeAccount;

  const res = await fetch(chain.dexAggregator.swapUrl!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Jupiter swap failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as JupiterSwapResponse;
}

/** 取全局配置的手续费接收地址(空字符串 = 不抽成) */
export function getConfiguredFeeAccount(): string | undefined {
  const chain = getCurrentChain();
  return chain.dexAggregator.feeReceiver || undefined;
}

/** 取全局配置的 platformFeeBps(0.1% = 10),没配 fee account 时返 0 */
export function getConfiguredPlatformFeeBps(): number {
  const chain = getCurrentChain();
  return chain.dexAggregator.feeReceiver ? chain.dexAggregator.platformFeeBps : 0;
}
