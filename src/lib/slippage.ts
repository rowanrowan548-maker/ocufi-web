/**
 * T-FE-SLIPPAGE-COLUMN · 真滑点算法(纯函数 · 单测覆盖)
 *
 * 定义:realized_bps = (quote_out_ui - actual_out_ui) / quote_out_ui * 10000
 *   - quote_out_ui:Jupiter quote 给的预期收到量(转 UI 单位)
 *   - actual_out_ui:链上实际收到量(已经是 UI 单位)
 *
 * V1.0 仅 sell(output = SOL · 9 decimals 已知)
 * V1.1(T-FE-SLIPPAGE-BUY)扩 buy · 用 ⛓️ T-ONCHAIN-QUOTE-DECIMALS 落的 quoteOutDecimals
 *
 * 边界:
 *   - 缺 quote / 缺 actual / quote_out <= 0 → null('—' 显示)
 *   - 实际 > quote(套利获益)→ 负 bps · UI 标 '+0.05%' 绿色 · 罕见
 *   - 实际 < quote(常见)→ 正 bps · UI 按阈值染色
 *   - decimals 缺失 / 不合理(< 0 或 > 24)→ null
 */

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const LAMPORTS_PER_SOL = 1_000_000_000;
const MAX_DECIMALS = 24; // 防御:任何 SPL 不超过 24 · 防 NaN / Infinity

export interface RealizedSlippageInput {
  side: 'buy' | 'sell';
  outputMint: string;
  /** Jupiter quote outAmount · raw lamports / token base 单位 · string */
  quoteOutAmount: string;
  /** sell 时 = 链上实际收到的 SOL(UI 单位)· buy 时不用 */
  actualSolReceived?: number;
  /** buy 时 = 链上实际收到的 token(UI 单位 · Helius 已按 decimals 转好)· sell 时不用 */
  actualTokenReceived?: number;
  /** buy 时 = quote outputMint 的 decimals(SOL=9 / USDC=6 / meme 多变)· sell 时不用 */
  quoteOutDecimals?: number;
}

/**
 * 算 realized slippage bps · 支持 sell + buy
 *
 * @returns bps 数字(可负)· 或 null('—' 显示)
 */
export function computeRealizedSlippageBps(input: RealizedSlippageInput): number | null {
  const quoteRaw = Number(input.quoteOutAmount);
  if (!Number.isFinite(quoteRaw) || quoteRaw <= 0) return null;

  if (input.side === 'sell') {
    // sell · output 必须是 SOL · 直接用 1e9 转
    if (input.outputMint !== SOL_MINT) return null;
    const actual = input.actualSolReceived;
    if (typeof actual !== 'number' || !Number.isFinite(actual) || actual <= 0) return null;
    const quoteUi = quoteRaw / LAMPORTS_PER_SOL;
    return diffBps(quoteUi, actual);
  }

  // buy · output 是任意 SPL · 用 quoteOutDecimals 转 UI
  const decimals = input.quoteOutDecimals;
  if (
    typeof decimals !== 'number' ||
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > MAX_DECIMALS
  ) {
    return null;
  }
  const actual = input.actualTokenReceived;
  if (typeof actual !== 'number' || !Number.isFinite(actual) || actual <= 0) return null;
  const quoteUi = quoteRaw / Math.pow(10, decimals);
  return diffBps(quoteUi, actual);
}

function diffBps(quoteUi: number, actualUi: number): number | null {
  if (!Number.isFinite(quoteUi) || quoteUi <= 0) return null;
  const bps = ((quoteUi - actualUi) / quoteUi) * 10000;
  if (!Number.isFinite(bps)) return null;
  return bps;
}
