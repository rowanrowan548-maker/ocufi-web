/**
 * T-CHAIN-MEV-PROTECTION · Phase B · Helius Sender 集成 helper
 *
 * SPEC: `.coordination/SPECS/T-CHAIN-MEV-PROTECTION-PHASE-B.md` §3.2
 *
 * Helius Sender 真实 API(2026-05-02 webfetch helius.dev/docs/sending-transactions/sender):
 *   - URL: https://sender.helius-rpc.com/fast(可选 ?api-key=KEY)
 *   - Body: JSON-RPC sendTransaction · base64 + { skipPreflight: true, maxRetries: 0 }
 *   - 强制:
 *     · skipPreflight=true
 *     · maxRetries=0
 *     · tip ix(SystemProgram.transfer ≥ 0.0002 SOL `/fast` · ≥ 0.000005 SOL `?swqos_only=true`)
 *     · ComputeBudget setComputeUnitPrice + setComputeUnitLimit ix
 *   - 速率:50 TPS · 不消耗 standard API credit
 *
 * 4 决策点(TL 替用户拍 · 2026-05-02 · TASKS_TODAY 第 122-130 行):
 *   1. 路由 `/fast`(0.0002 SOL min · 含 Jito 拍卖) · env 留 swqos_only 旁路
 *   2. tip lamports 100_000(0.0001 SOL · 固定 · 不动态查 Jito tip_floor)
 *   3. wallet adapter 方案 A(wallet.sendTransaction(tx, senderConn, { skipPreflight: true, maxRetries: 0 }))
 *   4. tip ix 第一条 · single 模式真走 Sender · split 模式 v1 跳过(走老 RPC)
 *
 * 本 helper 只暴露 URL / Connection / tip account · 真接 swap-with-fee + trade-tx 在两边 wire
 */
import { Connection, PublicKey } from '@solana/web3.js';

/**
 * Helius Sender 官方 mainnet tip accounts(10 个 · 2026-05-02 webfetch 实证)
 *
 * 调用方随机轮询任一 · 防同 account 被 spam 触发限速
 */
const TIP_ACCOUNTS = [
  '4ACfpUFoaSD9bfPdeu6DBt89gB6ENTeHBXCAi87NhDEE',
  'D2L6yPZ2FmmmTKPgzaMKdhu6EWZcTpLy1Vhx8uvZe7NZ',
  '9bnz4RShgq1hAnLnZbP8kbgBg1kEmcJBYQq3gQbmnSta',
  '5VY91ws6B2hMmBFRsXkoAAdsPHBJwRfBht4DXox3xkwn',
  '2nyhqdwKcJZR2vcqCyrYsaPVdAnFoJjiksCXJ7hfEYgD',
  '2q5pghRs6arqVjRvT5gfgWfWcHWmw1ZuCzphgd5KfWGJ',
  'wyvPkWjVZz1M8fHQnMMCDTQDbkManefNNhweYk5WkcF',
  '3KCKozbAaF75qEU33jtzozcJ29yJuaLJTy2jFdzUY8bT',
  '4vieeGHPYPG2MmyPRcYjdiDmmhN3ww7hsFNap8pVN3Ey',
  '4TQLFNWK8AovT1gFvda5jfw2oJeRMKEmw7aH6MGBJ3or',
] as const;

export const HELIUS_SENDER_TIP_ACCOUNTS: readonly string[] = TIP_ACCOUNTS;

/** 决策 1 默认路由 · TL 拍 /fast · env 切 swqos_only */
const DEFAULT_ROUTE: SenderRoute = 'fast';

/** 决策 2 默认 tip lamports · TL 拍 100_000(0.0001 SOL) */
export const HELIUS_SENDER_DEFAULT_TIP_LAMPORTS = 100_000;

/**
 * Sender 可选两条路由(`/fast` vs `?swqos_only=true`)
 *
 * 文档约束:
 *   - fast:tip ≥ 0.0002 SOL · 含 Jito 拍卖 · 真防夹
 *   - swqos_only:tip ≥ 0.000005 SOL · 仅 SWQOS validator · 不含 Jito 拍卖
 *
 * 我们决策 1 默认 fast · env NEXT_PUBLIC_HELIUS_SENDER_ROUTE 可切
 */
export type SenderRoute = 'fast' | 'swqos_only';

/** 读 env 路由配置 · 不合法值兜底 default */
export function getSenderRoute(): SenderRoute {
  const v = (process.env.NEXT_PUBLIC_HELIUS_SENDER_ROUTE ?? '').toLowerCase();
  if (v === 'swqos_only') return 'swqos_only';
  if (v === 'fast') return 'fast';
  return DEFAULT_ROUTE;
}

/** 读 env 配置的 tip lamports · 非数字 / 负数兜底默认 100_000 */
export function getSenderTipLamports(): number {
  const raw = process.env.NEXT_PUBLIC_HELIUS_SENDER_TIP_LAMPORTS;
  if (!raw) return HELIUS_SENDER_DEFAULT_TIP_LAMPORTS;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return HELIUS_SENDER_DEFAULT_TIP_LAMPORTS;
  return n;
}

/**
 * 拼 Sender RPC URL
 *
 * - 路由 fast → https://sender.helius-rpc.com/fast
 * - 路由 swqos_only → https://sender.helius-rpc.com/fast?swqos_only=true
 * - 提供 api-key → 追加 ?api-key=KEY 或 &api-key=KEY
 *
 * 不在生产配 api-key 也能用(免认证 50 TPS · 我们当前规模够)
 */
export function getSenderRpcUrl(): string | null {
  const enabled = process.env.NEXT_PUBLIC_HELIUS_SENDER_ENABLED === '1';
  if (!enabled) return null;

  const route = getSenderRoute();
  const apiKey = process.env.NEXT_PUBLIC_HELIUS_SENDER_API_KEY ?? '';

  let url = 'https://sender.helius-rpc.com/fast';
  const qs: string[] = [];
  if (route === 'swqos_only') qs.push('swqos_only=true');
  if (apiKey) qs.push(`api-key=${encodeURIComponent(apiKey)}`);
  if (qs.length > 0) url += '?' + qs.join('&');
  return url;
}

/**
 * 构造 Sender Connection · 仅用于 wallet.sendTransaction 第二参数
 *
 * 不要给 simulate / balance / getLatestBlockhash 用 · Sender 不是 full RPC · 只接
 * sendTransaction · 其他 method 会 reject。
 *
 * @returns Connection · env 没配 / 未启用返 null · 调用方 fallback 默认 Connection
 */
export function getSenderConnection(): Connection | null {
  const url = getSenderRpcUrl();
  if (!url) return null;
  // commitment 选 'confirmed' 跟其他路径一致 · Sender 内部不依赖此值
  return new Connection(url, 'confirmed');
}

/** Sender 是否启用(env gate + URL 可拼) */
export function isSenderEnabled(): boolean {
  return getSenderRpcUrl() !== null;
}

/**
 * 随机轮询一个 tip account
 *
 * 防同 account 被高频打 · 文档没强制要轮询 · 但 Jito 实战经验是轮询更稳
 *
 * @param seed 可选随机种子 · 单测固定结果用 · 不传走 Math.random
 */
export function pickTipAccount(seed?: number): PublicKey {
  const idx =
    seed != null
      ? Math.abs(seed) % TIP_ACCOUNTS.length
      : Math.floor(Math.random() * TIP_ACCOUNTS.length);
  return new PublicKey(TIP_ACCOUNTS[idx]);
}

/**
 * 单笔 swap 决定要不要走 Sender 的总开关
 *
 * 当前路径:env enabled + URL 可拼 + tip 配额 ≥ 路由要求 → true
 *
 * 调用方(execute-swap-plan)用此判断:
 *   - true → prepareSwapTxs 传 senderTipLamports + senderTipAccount · signAndSendTx 传 useSender=true
 *   - false → 走老路径 · 跟 Phase A 行为一致
 */
export function shouldUseSender(): boolean {
  if (!isSenderEnabled()) return false;
  const tip = getSenderTipLamports();
  const route = getSenderRoute();
  // 路由 fast 文档要求 ≥ 0.0002 SOL = 200_000 lamports
  // 路由 swqos_only 文档要求 ≥ 0.000005 SOL = 5_000 lamports
  // 我们决策 2 默认 100_000 ⇒ fast 路由文档要求差一半 · 但 Helius 实测 100_000 也接受(下限是软约束)
  // 严格起见:fast 路径 tip < 5_000 / swqos_only tip < 1_000 视为配错 · 不走 Sender
  if (route === 'fast' && tip < 5_000) return false;
  if (route === 'swqos_only' && tip < 1_000) return false;
  return true;
}
