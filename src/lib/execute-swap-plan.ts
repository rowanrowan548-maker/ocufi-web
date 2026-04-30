'use client';

/**
 * T-PHANTOM-SPLIT-TX-FE · 统一 swap 执行入口 · 处理 single / split 两条路径
 *
 * 替代各 form 直接调 buildSwapTxWithFee 的老路径。
 * - kind='single' · 单笔签 + 发送 + 确认(老行为)
 * - kind='split'  · 签 setup → 确认 → 拿 fresh blockhash → 签 swap → 确认
 *
 * Rory 强调:setup 成功但 swap 失败 → 必须有 cleanup 逃生口(unwrap WSOL)
 * 此处通过 onSetupConfirmed callback 让上层标记"用户有未完成 wrap" · 失败时弹 cleanup toast。
 */
import type { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import type { WalletContextState } from '@solana/wallet-adapter-react';
import type { JupiterQuote, GasLevel } from './jupiter';
import { prepareSwapTxs } from './swap-with-fee';
import { signAndSendTx, confirmTx, getDecimals } from './trade-tx';
import { pushMevEntry } from './rewards-storage';
import { saveSwapQuote } from './swap-quote-storage';

const SOL_MINT_BASE58 = 'So11111111111111111111111111111111111111112';

/**
 * T-ONCHAIN-QUOTE-PERSIST + T-ONCHAIN-QUOTE-DECIMALS
 *
 * single + split 都用 · 拿到 swap-tx-sig 后落 quote(含 decimals · 给 BUY 行算滑点用)
 *
 * 异步 fire-and-forget:不阻塞 swap 流程 · decimals 查 RPC 失败兜底 9(SOL 默认)
 * SOL mint 短路返 9 · 不查 RPC
 */
async function persistQuote(
  connection: Connection,
  sig: string,
  quote: JupiterQuote
): Promise<void> {
  try {
    const isBuy = quote.inputMint === SOL_MINT_BASE58;
    // 短路:SOL 一定 9 · 非 SOL 走 getDecimals(已有 lib · 不新加 fetch)
    const lookupDecimals = async (mint: string): Promise<number> => {
      if (mint === SOL_MINT_BASE58) return 9;
      try {
        return await getDecimals(connection, mint);
      } catch {
        return 9; // RPC 失败兜底 · 算滑点会偏 · 但不爆错(loadSwapQuote 校验 number 通过)
      }
    };
    const [inputDecimals, quoteOutDecimals] = await Promise.all([
      lookupDecimals(quote.inputMint),
      lookupDecimals(quote.outputMint),
    ]);
    saveSwapQuote({
      version: 2,
      signature: sig,
      timestamp: Date.now(),
      inputMint: quote.inputMint,
      outputMint: quote.outputMint,
      inputAmount: quote.inAmount,
      quoteOutAmount: quote.outAmount,
      slippageBps: quote.slippageBps,
      side: isBuy ? 'buy' : 'sell',
      inputDecimals,
      quoteOutDecimals,
    });
  } catch (e) {
    console.warn('[execute-swap-plan] saveSwapQuote failed (non-blocking):', e);
  }
}

export type SplitStage = 'setup-signing' | 'setup-sending' | 'setup-confirming' | 'swap-signing' | 'swap-sending' | 'swap-confirming';

export interface ExecuteSwapOpts {
  /** 'single' 模式触发的中间状态(默认 onStage('signing') / 'sending' / 'confirming')*/
  onStage?: (stage: 'signing' | 'sending' | 'confirming') => void;
  /** 'split' 模式 · setup 已 confirmed · 这一刻起前端必须暴露 cleanup 入口给用户 */
  onSetupConfirmed?: (setupSig: string) => void;
  /** Jupiter platformFeeBps · 默认 10(0.1%)· 卖出可传 0 */
  platformFeeBps?: number;
  /** confirm 超时(默认 60s) */
  confirmTimeoutMs?: number;
  /**
   * T-MEV-REBATE-FE · 用户钱包(PublicKey 或 base58 string)
   * 透传给底层 signAndSendTx · 触发 Helius rebate URL · MEV 50% 返用户
   * undefined / env 没配 → 走默认 connection(向后兼容)
   */
  rebateForUser?: PublicKey | string;
  /**
   * T-REWARDS-PAGE · MEV 跟踪信息(可选)
   * 提供时:swap confirm 后比对 expected vs actual SOL 余额 · 正 diff 写 localStorage
   * - expectedSpentLamports:本应支出的 SOL(buy 单子的 inputSol*1e9)· buy 用
   * - expectedGainedLamports:本应入账的 SOL(sell 单子的 outputSol 估值*1e9)· sell 用
   * - tokenSymbol:写到 mev_history 的标签
   */
  mevTracking?: {
    expectedSpentLamports?: number;
    expectedGainedLamports?: number;
    tokenSymbol?: string;
  };
}

export interface ExecuteSwapResult {
  /** 最终 swap tx 的 signature(用户看到的那笔)*/
  signature: string;
  /** 'split' 模式才有 · setup tx 的 signature */
  setupSignature?: string;
  /** 区分 single / split · 给上层做 i18n 文案 */
  kind: 'single' | 'split';
}

/**
 * 执行 swap 计划(自动选择 single / split)
 *
 * 错误场景:
 * - single 模式失败 → 整笔抛错(原样)
 * - split setup 失败 → 抛错 · 没 wrap 没 cleanup 必要
 * - split setup 成功 + swap 失败 → 抛错 · onSetupConfirmed 已通知 · 上层弹 cleanup toast
 */
export async function executeSwapPlan(
  connection: Connection,
  wallet: WalletContextState,
  quote: JupiterQuote,
  gasLevel: GasLevel = 'fast',
  opts: ExecuteSwapOpts = {}
): Promise<ExecuteSwapResult> {
  if (!wallet.publicKey) throw new Error('__ERR_WALLET_NOT_CONNECTED');
  const userPk = wallet.publicKey.toBase58();
  const onStage = opts.onStage ?? (() => {});
  const confirmTimeoutMs = opts.confirmTimeoutMs ?? 60_000;
  // T-MEV-REBATE-FE · 默认用 wallet.publicKey · 调用方可显式 override
  const rebateForUser = opts.rebateForUser ?? wallet.publicKey;
  const sendOpts = { rebateForUser };

  // T-REWARDS-PAGE · MEV 跟踪 · confirm 前先记预期支出/入账(单位 lamports)
  // 后端 helius rebate 给的 SOL 会让"实际支出"少 / "实际入账"多 · diff > 0 = 用户多到的
  const mevExpectSpent = opts.mevTracking?.expectedSpentLamports;
  const mevExpectGained = opts.mevTracking?.expectedGainedLamports;
  const mevTokenSymbol = opts.mevTracking?.tokenSymbol;
  let preBalanceLamports: number | null = null;
  if (mevExpectSpent != null || mevExpectGained != null) {
    try {
      preBalanceLamports = await connection.getBalance(wallet.publicKey, 'confirmed');
    } catch {
      preBalanceLamports = null;
    }
  }

  // 1. 决策 single / split
  const plan = await prepareSwapTxs(connection, quote, userPk, gasLevel);

  if (plan.kind === 'single') {
    // 老路径
    onStage('signing');
    onStage('sending');
    const sig = await signAndSendTx(connection, wallet, plan.tx, sendOpts);
    onStage('confirming');
    const confirmed = await confirmTx(connection, sig, confirmTimeoutMs);
    if (!confirmed) throw new Error(`__ERR_UNCONFIRMED:${sig}`);
    void persistQuote(connection, sig, quote);
    if (preBalanceLamports != null) {
      void recordMevIfPositive({
        connection,
        userPk: wallet.publicKey,
        sig,
        preBalanceLamports,
        expectSpent: mevExpectSpent,
        expectGained: mevExpectGained,
        tokenSymbol: mevTokenSymbol,
      });
    }
    return { signature: sig, kind: 'single' };
  }

  // split 路径:setup → confirm → swap → confirm
  // 第 1 笔(setup · 通常是 wrap SOL + create ATA)
  onStage('signing');
  onStage('sending');
  const setupSig = await signAndSendTx(connection, wallet, plan.setupTx, sendOpts);
  onStage('confirming');
  const setupOk = await confirmTx(connection, setupSig, confirmTimeoutMs);
  if (!setupOk) throw new Error(`__ERR_SETUP_UNCONFIRMED:${setupSig}`);

  // 关键时刻:setup 已上链 · 用户钱包里可能有了 wrapped SOL
  // 通知上层暴露 cleanup 入口(若后续 swap 失败)
  if (opts.onSetupConfirmed) opts.onSetupConfirmed(setupSig);

  // 第 2 笔(swap · 用 fresh blockhash 防过期)
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  const swapTx: VersionedTransaction = plan.buildSwapTx(blockhash);

  onStage('signing');
  onStage('sending');
  const sig = await signAndSendTx(connection, wallet, swapTx, sendOpts);
  onStage('confirming');
  const swapOk = await confirmTx(connection, sig, confirmTimeoutMs);
  if (!swapOk) throw new Error(`__ERR_UNCONFIRMED:${sig}`);
  void persistQuote(connection, sig, quote);

  if (preBalanceLamports != null) {
    void recordMevIfPositive({
      connection,
      userPk: wallet.publicKey,
      sig,
      preBalanceLamports,
      expectSpent: mevExpectSpent,
      expectGained: mevExpectGained,
      tokenSymbol: mevTokenSymbol,
    });
  }

  return { signature: sig, setupSignature: setupSig, kind: 'split' };
}

/**
 * confirm 后 1.5s · getBalance 比对预期 vs 实际 · 正 diff 写 localStorage
 *
 * 正常 swap:实际余额 = pre - expectedSpent + expectedGained - gas
 *   gas 大约 0.000005~0.000015 SOL · 取上限 0.00002 SOL 兜底
 * MEV rebate:rebate 让用户多到 X SOL · 实际 - 期望 = X(扣 gas 后)
 *
 * 仅 diff > gas 上限时才记 · 防 rounding noise
 */
async function recordMevIfPositive(args: {
  connection: Connection;
  userPk: PublicKey;
  sig: string;
  preBalanceLamports: number;
  expectSpent?: number;
  expectGained?: number;
  tokenSymbol?: string;
}) {
  const { connection, userPk, sig, preBalanceLamports, expectSpent = 0, expectGained = 0, tokenSymbol } = args;
  // 等 1.5s · 让 RPC 节点同步到最新 balance
  await new Promise((r) => setTimeout(r, 1500));
  let postLamports: number;
  try {
    postLamports = await connection.getBalance(userPk, 'confirmed');
  } catch {
    return;
  }
  // 期望余额 = pre - expectSpent + expectGained
  const expectedPost = preBalanceLamports - expectSpent + expectGained;
  const diff = postLamports - expectedPost;
  // 扣 gas 上限 ~20000 lamports · diff > 这个值才视为 MEV rebate
  const GAS_FLOOR = 20_000;
  if (diff > GAS_FLOOR) {
    pushMevEntry({
      tx: sig,
      amount_lamports: diff,
      ts: Date.now(),
      token_symbol: tokenSymbol,
    });
  }
}
