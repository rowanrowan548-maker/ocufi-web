/**
 * R10-CHAIN · 跟单 swap 计划构造器
 *
 * 用途:把后端 R10-BE 推过来的 pending job(KOL 一笔 swap 的元数据)转成
 * follower 钱包可签的 swap tx 计划。**复用 swap-with-fee.ts 的 prepareSwapTxs**,
 * 不重写 Jupiter 逻辑;沿用全部 fee / simulate / split / Token-2022 兼容路径。
 *
 * 与普通 swap 唯一区别:
 *   1. amount 来自后端 `_decide_proposed_sol`(已应用 ratio / single-cap / total-cap / blacklist)
 *   2. slippage 来自 follower 订阅设置(非 KOL 那笔)
 *   3. 在 tx 里挂一条 SPL Memo `ocufi-copy-{leaderSig.slice(0, 8)}` 链上溯源
 *      - single 模式 memo append 到 instructions 末尾
 *      - split 模式 memo 挂 setup leg(Rory size 约束 · 不挂 swap leg)
 *
 * 流程(链上层 · 不签名):
 *   后端 webhook 落 pending job → 前端轮询拿到 → 调 buildCopyTx → 拿 plan
 *   前端用 executeSwapPlan(同普通 swap) → 钱包签 → confirm → POST /jobs/{id}/ack-signed
 *
 * 错误 sentinel(消费方走 humanize):
 *   - __ERR_COPY_LEADER_SOLD_NONHELD · follower 完全不持有 leader 卖的 token(skip · UI 提示自动跳过)
 *   - __ERR_BALANCE_DRIFT · follower 持有但量不够(prepareSwapTxs 内部已抛)
 *   - __ERR_INSUFFICIENT_BALANCE / __ERR_SLIPPAGE_TOO_LOW / __ERR_TX_SIMULATION_FAIL / __ERR_STALE_BLOCKHASH
 *     · 沿用 swap-with-fee 既有 sentinel · friendly-error.ts 已能翻译
 */
import { Connection, PublicKey } from '@solana/web3.js';
import type { GasLevel, JupiterQuote } from './jupiter';
import { getQuote, SOL_MINT } from './jupiter';
import { prepareSwapTxs, type SplitTxPlan } from './swap-with-fee';

/**
 * 跟单 swap 输入
 *
 * 字段对齐后端 R10-BE webhook 解析后写入 copy_trading_jobs 的字段语义。
 */
export interface CopyExecutionInput {
  /** KOL 那笔 swap 的输入 mint(SOL 或 SPL · base58) */
  leaderInputMint: string;
  /** KOL 那笔 swap 的输出 mint(base58) */
  leaderOutputMint: string;
  /**
   * follower 应跟单的输入量 · raw lamports(SOL)或 token base unit
   * 来自后端 `_decide_proposed_sol`(已应用 ratio / cap / blacklist · 链上层不再二次计算)
   */
  followerInputAmount: bigint;
  /** follower 钱包 publicKey */
  followerWallet: PublicKey;
  /** follower 订阅设置的滑点(千分点 · 默认订阅是 500=5%) */
  slippageBps: number;
  /**
   * KOL 那笔 swap 的链上签名 · base58
   * 用于:① memo 文本追溯 ② 后端 ack-signed 时的关联键
   */
  leaderSignature: string;
  /** 优先费档位 · 默认 'fast' */
  gasLevel?: GasLevel;
}

/**
 * 跟单 swap 计划
 *
 * 直接透传 swap-with-fee 的 SplitTxPlan(single / split 决策已含)+ quote 元数据,
 * 让上层用 executeSwapPlan(同普通 swap)走 sign + send + confirm + ack-signed。
 */
export interface CopyExecutionPlan {
  /** swap 计划 · single 或 split(决策由 prepareSwapTxs · 跟单不影响 size 决策) */
  plan: SplitTxPlan;
  /** Jupiter quote · 上层 executeSwapPlan 落 swap-quote-storage 算实际滑点用 */
  quote: JupiterQuote;
  /** 预期收到的输出量 · raw(给 UI 显"将收到 X")· 来自 quote.outAmount */
  expectedOutputAmount: bigint;
  /** 嵌入 plan 的 memo 文本 · UI 可显"已挂溯源 memo: ..." */
  memoText: string;
}

/** memo 前缀 · 链上 indexer 可全局 grep · 区分跟单 tx 与普通 swap */
const COPY_MEMO_PREFIX = 'ocufi-copy';

/**
 * 把 leader 签名前 8 位拼到 memo · 总长可控(prefix 10 + dash 1 + 8 = 19 字节 · 远小于 64 上限)
 *
 * 选 8 位平衡性:base58 8 位 ≈ 47 bit · KOL 一日发数千笔仍有效区分;
 * 完整签名 88 字节会撑爆 size · 过短(4)有冲突。
 */
function buildCopyMemoText(leaderSignature: string): string {
  const prefix = leaderSignature.slice(0, 8);
  return `${COPY_MEMO_PREFIX}-${prefix}`;
}

/**
 * 卖出场景预探:follower 是否持有 leader 卖的 token
 *
 * - 完全不持有(余额 0 / ATA 不存在)→ throw __ERR_COPY_LEADER_SOLD_NONHELD
 * - 持有但量不够 → 不在这抛 · prepareSwapTxs 内部 BALANCE_DRIFT 探测会兜
 * - RPC 抖动失败 → 不抛 · 让 prepareSwapTxs 走自身路径(更宽松的 fail-safe)
 */
async function ensureFollowerHoldsToken(
  connection: Connection,
  follower: PublicKey,
  mint: string
): Promise<void> {
  let onChainTotal = BigInt(0);
  let probeOk = false;
  try {
    const res = await connection.getParsedTokenAccountsByOwner(follower, {
      mint: new PublicKey(mint),
    });
    probeOk = true;
    for (const acc of res.value) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const info: any = acc.account.data;
      const amt = info?.parsed?.info?.tokenAmount;
      if (amt) onChainTotal += BigInt(String(amt.amount ?? '0'));
    }
  } catch (e) {
    console.warn('[copy-trade] NONHELD precheck RPC failed, skipping:', e);
    return;
  }
  if (probeOk && onChainTotal === BigInt(0)) {
    throw new Error('__ERR_COPY_LEADER_SOLD_NONHELD');
  }
}

/**
 * 构造跟单 swap 计划(纯准备 · 不签名 · 不上链)
 *
 * 调用方负责:
 *   1. 上层(R10-FE)传入 input
 *   2. buildCopyTx → 拿 CopyExecutionPlan
 *   3. executeSwapPlan(connection, wallet, plan.quote, gasLevel, ...) 走签 + 发 + confirm
 *      · executeSwapPlan 内部会再调一次 prepareSwapTxs · ⚠️ 此处与 buildCopyTx 内部
 *        prepareSwapTxs 是两次独立调用 · quote 一致 · 但 ix 顺序 / size 决策可能因
 *        blockhash 时差细节略不同 · ack-signed 流程不依赖此对齐 · 安全
 *      · 若上层希望用 buildCopyTx 已构造的 plan 而非重跑一次 prepareSwapTxs ·
 *        可以直接用 plan.plan(setupTx + buildSwapTx)走自定义 sign 流程
 *   4. confirm 后 POST /copy-trading/jobs/{id}/ack-signed?user_swap_signature=<sig>
 */
export async function buildCopyTx(
  connection: Connection,
  input: CopyExecutionInput
): Promise<CopyExecutionPlan> {
  if (input.followerInputAmount <= BigInt(0)) {
    throw new Error('__ERR_COPY_AMOUNT_INVALID');
  }
  if (input.slippageBps < 0 || input.slippageBps > 10_000) {
    throw new Error('__ERR_COPY_SLIPPAGE_INVALID');
  }
  if (!input.leaderSignature || input.leaderSignature.length < 8) {
    throw new Error('__ERR_COPY_LEADER_SIG_INVALID');
  }

  // 卖出场景:follower 完全不持有 leader 卖的 token → 跳单(不消耗 quote / Jupiter 配额)
  if (input.leaderInputMint !== SOL_MINT) {
    await ensureFollowerHoldsToken(connection, input.followerWallet, input.leaderInputMint);
  }

  // 1. 拿 Jupiter quote · platformFeeBps=0(跟单不额外加 fee · 沿用 swap-with-fee 0.1% buy)
  const quote = await getQuote(
    input.leaderInputMint,
    input.leaderOutputMint,
    input.followerInputAmount,
    { slippageBps: input.slippageBps }
  );

  // 2. 复用 prepareSwapTxs · 挂跟单溯源 memo
  const memoText = buildCopyMemoText(input.leaderSignature);
  const plan = await prepareSwapTxs(
    connection,
    quote,
    input.followerWallet.toBase58(),
    input.gasLevel ?? 'fast',
    { extraMemoText: memoText }
  );

  return {
    plan,
    quote,
    expectedOutputAmount: BigInt(quote.outAmount),
    memoText,
  };
}
