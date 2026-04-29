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
import { signAndSendTx, confirmTx } from './trade-tx';

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

  return { signature: sig, setupSignature: setupSig, kind: 'split' };
}
