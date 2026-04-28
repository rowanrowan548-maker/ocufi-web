/**
 * Helius `getPriorityFeeEstimate` 接入 · 4 档动态化(T-PRIORITY-DYNAMIC)
 *
 * 背景:T-985d-onchain ship 4 档优先费 Pilot/P1/P2/P3 是硬编码 microLamports/CU。
 * Solana mainnet 实际优先费分位会随拥塞变化(早 1000、晚高峰 100K)。
 *  - 硬编码 P3=25M microLamports/CU 在闲时浪费(实际 veryHigh 通常 ~100K)
 *  - 硬编码 P1=250K 在拥塞时偏低
 *
 * 解法:每次报价时(或 30s 一次)调 Helius RPC `getPriorityFeeEstimate`,
 * 拿 min/low/medium/high/veryHigh/unsafeMax 6 个分位,4 档动态映射:
 *   Pilot = min      · 最低(慢)
 *   P1    = medium   · 中位(标准 / 默认)
 *   P2    = high     · 高(快)
 *   P3    = veryHigh · 极速(不再 5M 写死)
 *
 * 失败 fallback 到 T-985d-onchain 的硬编码 `PRIORITY_TIER_LAMPORTS` 反算的
 * microLamports/CU(getMicroLamportsForTier),保证永远有值返。
 *
 * 单位:本 lib 全部用 microLamports/CU(Helius 原生 + setComputeUnitPrice 接受)。
 */

import type { PriorityTier } from './priority-fees';
import { getMicroLamportsForTier } from './priority-fees';

/** Helius RPC URL · lazy 读 env(测试可在 beforeEach 注入) */
function getHeliusRpc(): string {
  return process.env.NEXT_PUBLIC_HELIUS_RPC ?? '';
}

const CACHE_TTL_MS = 30_000;
const FETCH_TIMEOUT_MS = 5_000;
/** Helius getPriorityFeeEstimate 用 lookback slots,150 是默认推荐 */
const LOOKBACK_SLOTS = 150;

/** Helius 返回 6 分位结构 · 单位 microLamports/CU */
interface HeliusPriorityFeeLevels {
  min: number;
  low: number;
  medium: number;
  high: number;
  veryHigh: number;
  unsafeMax: number;
}

interface CacheEntry {
  data: Record<PriorityTier, number>;
  expiresAt: number;
}

let _cache: CacheEntry | null = null;
let _inflight: Promise<Record<PriorityTier, number>> | null = null;

/** 给测试用 · 重置缓存 + inflight,跨测试干净 */
export function _resetDynamicPriorityCache(): void {
  _cache = null;
  _inflight = null;
}

function staticFallback(): Record<PriorityTier, number> {
  return {
    pilot: getMicroLamportsForTier('pilot'),
    p1: getMicroLamportsForTier('p1'),
    p2: getMicroLamportsForTier('p2'),
    p3: getMicroLamportsForTier('p3'),
  };
}

/**
 * 拉一次 Helius 优先费估算 · 返回 4 档动态映射(microLamports/CU)
 *
 * - 缓存 30s(优先费分位变化没那么快)
 * - inflight dedup:同时多次调用合并为 1 次 RPC
 * - HELIUS_RPC 未配 / 网络错 / 字段缺失 → 静态 fallback
 *
 * 调用方:前端 buy/sell-form 选档时调一次,拿到 microLamports/CU 传给
 * `swap-with-fee.ts`(可选 · 当前 Jupiter prioritizationFeeLamports 仍主路径)
 */
export async function getDynamicPriorityTiers(): Promise<Record<PriorityTier, number>> {
  // 缓存命中
  if (_cache && _cache.expiresAt > Date.now()) return _cache.data;

  // inflight dedup
  if (_inflight) return _inflight;

  // 没配 RPC URL → 直接静态 fallback
  const heliusRpc = getHeliusRpc();
  if (!heliusRpc) {
    return staticFallback();
  }

  _inflight = (async () => {
    try {
      const res = await fetch(heliusRpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getPriorityFeeEstimate',
          params: [
            {
              options: {
                includeAllPriorityFeeLevels: true,
                lookbackSlots: LOOKBACK_SLOTS,
              },
            },
          ],
        }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        cache: 'no-store',
      });
      if (!res.ok) {
        console.warn('[dynamic-priority-fees] Helius HTTP', res.status, '→ fallback');
        return staticFallback();
      }
      const json = await res.json();
      const levels = json?.result?.priorityFeeLevels as
        | HeliusPriorityFeeLevels
        | undefined;
      if (
        !levels ||
        typeof levels.min !== 'number' ||
        typeof levels.medium !== 'number' ||
        typeof levels.high !== 'number' ||
        typeof levels.veryHigh !== 'number'
      ) {
        console.warn(
          '[dynamic-priority-fees] Helius response missing priorityFeeLevels → fallback'
        );
        return staticFallback();
      }
      // Math.max(1, ...) 防 0 fee(0 优先费 tx 永远上不去队列)
      // Math.floor 保整数(setComputeUnitPrice 不接小数)
      const tiers: Record<PriorityTier, number> = {
        pilot: Math.max(1, Math.floor(levels.min)),
        p1: Math.max(1, Math.floor(levels.medium)),
        p2: Math.max(1, Math.floor(levels.high)),
        p3: Math.max(1, Math.floor(levels.veryHigh)),
      };
      _cache = { data: tiers, expiresAt: Date.now() + CACHE_TTL_MS };
      return tiers;
    } catch (e) {
      console.warn('[dynamic-priority-fees] fetch failed → fallback:', e);
      return staticFallback();
    } finally {
      _inflight = null;
    }
  })();
  return _inflight;
}
