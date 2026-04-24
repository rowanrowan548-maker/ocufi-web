/**
 * 把常见错误字符串翻译成用户能看懂的中文
 *
 * 调用: throw 或 setState 前 humanize(e) 过一下
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export function humanize(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const name = (e as any)?.name as string | undefined;

  // 用户在钱包里点了"拒绝"
  if (
    /user rejected/i.test(msg) ||
    /user denied/i.test(msg) ||
    name === 'WalletSignTransactionError'
  ) {
    return '__ERR_USER_REJECTED';
  }
  // 滑点相关
  if (/slippage/i.test(msg) || /insufficient output/i.test(msg)) {
    return '__ERR_SLIPPAGE';
  }
  // 余额不足
  if (/insufficient funds/i.test(msg) || /insufficient lamports/i.test(msg)) {
    return '__ERR_INSUFFICIENT_FUNDS';
  }
  // Jupiter 无路由
  if (/no route/i.test(msg) || /could not find any route/i.test(msg)) {
    return '__ERR_NO_ROUTE';
  }
  // RPC 限流 / 403
  if (/403/i.test(msg) || /rate.?limit/i.test(msg)) {
    return '__ERR_RPC_FORBIDDEN';
  }
  // 默认返回原始错误(截断)
  return msg.length > 300 ? msg.slice(0, 300) + '…' : msg;
}
