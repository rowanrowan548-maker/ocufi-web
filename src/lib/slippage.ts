/**
 * T-FE-SLIPPAGE-COLUMN · 真滑点算法(纯函数 · 单测覆盖)
 *
 * 定义:realized_bps = (quote_out - actual_out) / quote_out * 10000
 *   - quote_out:Jupiter quote 给的预期收到量
 *   - actual_out:链上实际收到量
 *
 * V1 范围:仅 sell 行(output = SOL · 1e9 fixed decimals · 不需查 token decimals)
 * BUY 行需 ⛓️ 在 StoredSwapQuote 加 quoteOutDecimals 字段(spec 未含 · V1.1 跟进)
 *
 * 边界:
 *   - 缺 quote / 缺 actual / quote_out <= 0 → null('—' 显示)
 *   - 实际 > quote(套利获益)→ 负 bps · UI 标 '+0.05%' 绿色 · 罕见
 *   - 实际 < quote(常见)→ 正 bps · UI 按阈值染色
 */

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const LAMPORTS_PER_SOL = 1_000_000_000;

export interface RealizedSlippageInput {
  side: 'buy' | 'sell';
  outputMint: string;
  /** Jupiter quote · 卖单时 outputMint = SOL · raw lamports string */
  quoteOutAmount: string;
  /** 链上实际收到 SOL(human · 单位 SOL)· buy 时填 0 / 不用 */
  actualSolReceived: number;
}

/**
 * 算 realized slippage bps · 不支持 buy(返 null)
 *
 * @returns bps 数字(可负)· 或 null('—' 显示)
 */
export function computeRealizedSlippageBps(input: RealizedSlippageInput): number | null {
  if (input.side !== 'sell') return null;
  if (input.outputMint !== SOL_MINT) return null;
  const quoteRaw = Number(input.quoteOutAmount);
  if (!Number.isFinite(quoteRaw) || quoteRaw <= 0) return null;
  const quoteSol = quoteRaw / LAMPORTS_PER_SOL;
  if (!Number.isFinite(input.actualSolReceived) || input.actualSolReceived <= 0) return null;
  const bps = ((quoteSol - input.actualSolReceived) / quoteSol) * 10000;
  if (!Number.isFinite(bps)) return null;
  return bps;
}
