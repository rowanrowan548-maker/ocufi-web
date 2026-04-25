/**
 * Solana 优先费(prioritization fee)采样 + 三档推荐
 *
 * 用 RPC `getRecentPrioritizationFees`(最近 150 个 slot 的样本),
 * 按百分位分档:
 *   p25 → normal     · 与 jupiter.ts 的 maxLamports 5_000 配对
 *   p50 → fast       · 与 jupiter.ts 的 maxLamports 50_000 配对
 *   p95 → turbo      · 与 jupiter.ts 的 maxLamports 1_000_000 配对
 * 各档结果按对应 maxLamports 封顶(避免 p95 极端样本拉爆估算)。
 *
 * 单位:RPC 返回的 prioritizationFee 为 micro-lamports per CU。
 * 典型 Jupiter swap 200k CU,我们用 200k 做估算。
 */
import type { Connection } from '@solana/web3.js';

const TYPICAL_SWAP_CU = 200_000;
const NORMAL_MAX_LAMPORTS = 5_000;
const FAST_MAX_LAMPORTS = 50_000;
const TURBO_MAX_LAMPORTS = 1_000_000;

export type CongestionLevel = 'idle' | 'normal' | 'busy';

export interface PriorityFeeBreakdown {
  /** 各档预估总 lamports(已封顶) */
  normalLamports: number;
  fastLamports: number;
  turboLamports: number;
  /** 各档预估总 SOL(显示用) */
  normalSol: number;
  fastSol: number;
  turboSol: number;
  /** 网络拥堵等级(基于 p50 micro-lamports/CU 中位数) */
  congestion: CongestionLevel;
  /** 数据采样数(<10 时不太可信,fallback 静态文案) */
  sampleCount: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p));
  return sorted[idx];
}

function lamportsFromMicro(microPerCU: number): number {
  return Math.ceil((microPerCU * TYPICAL_SWAP_CU) / 1_000_000);
}

/**
 * 拉一次 RPC 优先费采样,失败 / 样本不足返回 null(由调用方走 i18n 静态文案)
 */
export async function fetchPriorityFees(
  connection: Connection,
): Promise<PriorityFeeBreakdown | null> {
  try {
    const fees = await connection.getRecentPrioritizationFees();
    if (!fees || fees.length === 0) return null;
    const samples = fees
      .map((f) => f.prioritizationFee)
      .filter((n) => Number.isFinite(n) && n >= 0);
    if (samples.length < 10) return null;
    samples.sort((a, b) => a - b);

    const p25 = percentile(samples, 0.25);
    const p50 = percentile(samples, 0.5);
    const p95 = percentile(samples, 0.95);

    // 单调性:确保 normal ≤ fast ≤ turbo,样本极端时也不至于乱序
    const normal = Math.min(NORMAL_MAX_LAMPORTS, Math.max(1, lamportsFromMicro(p25)));
    const fast = Math.min(FAST_MAX_LAMPORTS, Math.max(normal, lamportsFromMicro(p50)));
    const turbo = Math.min(TURBO_MAX_LAMPORTS, Math.max(fast, lamportsFromMicro(p95)));

    let congestion: CongestionLevel = 'normal';
    if (p50 < 1_000) congestion = 'idle';
    else if (p50 > 50_000) congestion = 'busy';

    return {
      normalLamports: normal,
      fastLamports: fast,
      turboLamports: turbo,
      normalSol: normal / 1_000_000_000,
      fastSol: fast / 1_000_000_000,
      turboSol: turbo / 1_000_000_000,
      congestion,
      sampleCount: samples.length,
    };
  } catch {
    return null;
  }
}

/**
 * 把档位估算总 SOL 格式化成 6 位小数的字符串(与 i18n 静态文案风格一致)
 */
export function formatPriorityFeeSol(sol: number): string {
  if (sol >= 0.001) return sol.toFixed(4);
  if (sol >= 0.00001) return sol.toFixed(6);
  return sol.toFixed(7);
}
