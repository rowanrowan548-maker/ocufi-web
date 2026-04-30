/**
 * T-HISTORY-COMPUTED-PRICE · 成交价显示算法
 *
 * 优先级:
 *   1. 后端给的 execPriceUsd(若有 · 直接 formatAmount)
 *   2. swap 类型(buy/sell)且 SOL + token 数量都非 0 → SOL ÷ tokenAmount = SOL/token 价
 *   3. 上面都不满足 → '—'(转入/转出 / 失败 / 数据不全)
 *
 * 单位语义:
 *   - 后端 execPriceUsd 实际是 output/input(SOL/token 或反向)· 跟前端兜底同语义
 *   - V2 后端给真实链上 USD 价时切换显示单位(后端字段名沿用)
 */

export interface ExecPriceInput {
  type?: string | null;
  tokenMint?: string | null;
  tokenAmount?: number | null;
  solAmount?: number | null;
  execPriceUsd?: number | null;
}

export function formatExecPrice(
  r: ExecPriceInput,
  formatAmount: (n: number) => string
): string {
  if (r.execPriceUsd != null) return formatAmount(r.execPriceUsd);
  const isSwap = r.type === 'buy' || r.type === 'sell';
  if (!isSwap) return '—';
  if (!r.tokenMint || !r.tokenAmount || r.tokenAmount <= 0 || !r.solAmount || r.solAmount <= 0) {
    return '—';
  }
  const solPerToken = r.solAmount / r.tokenAmount;
  if (!Number.isFinite(solPerToken) || solPerToken <= 0) return '—';
  return `${formatAmount(solPerToken)} SOL`;
}
