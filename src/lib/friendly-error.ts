/**
 * 把常见错误字符串翻译成用户能看懂的中文
 *
 * 调用: throw 或 setState 前 humanize(e) 过一下
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export function humanize(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const name = (e as any)?.name as string | undefined;

  // 余额预校验主动抛(swap-with-fee.ts):透传 sentinel
  if (msg === '__ERR_BALANCE_DRIFT') {
    return '__ERR_BALANCE_DRIFT';
  }
  // T-810 · tx 自检主动抛(swap-with-fee.ts):透传 sentinel
  // - __ERR_TX_SIZE_OVERFLOW:序列化后 > 1232 字节(Solana mainnet packet 限制)
  // - __ERR_TX_SIMULATION_FAIL:Phantom Lighthouse/Blowfish 模拟失败,继续签会触发红警
  // T-972 · simulation 细分(swap-with-fee.ts 按 logs 分类):透传 sentinel
  if (
    msg === '__ERR_TX_SIZE_OVERFLOW' ||
    msg === '__ERR_TX_SIMULATION_FAIL' ||
    msg === '__ERR_INSUFFICIENT_BALANCE' ||
    msg === '__ERR_SLIPPAGE_TOO_LOW' ||
    msg === '__ERR_TOKEN_2022_INCOMPATIBLE' ||
    msg === '__ERR_STALE_BLOCKHASH'
  ) {
    return msg;
  }
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
  // blockhash 失效 / 已过 lastValidBlockHeight(网络拥堵导致 tx 没赶上)
  if (/blockhash/i.test(msg) || /block\s*height\s*exceeded/i.test(msg)) {
    return '__ERR_BLOCKHASH_EXPIRED';
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
