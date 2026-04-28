import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getDynamicPriorityTiers,
  _resetDynamicPriorityCache,
} from '@/lib/dynamic-priority-fees';
import { getMicroLamportsForTier } from '@/lib/priority-fees';

/**
 * T-PRIORITY-DYNAMIC · Helius getPriorityFeeEstimate 接入 · 4 档动态化测试
 *
 * 4 case:
 *   1. Helius 正常返 6 分位 → 4 档映射 min/medium/high/veryHigh
 *   2. Helius 调用 timeout / RPC fail → fallback 静态值
 *   3. 字段缺失(priorityFeeLevels 或子字段)→ fallback
 *   4. 缓存命中 · 第二次调用不再打 RPC
 */

beforeEach(() => {
  _resetDynamicPriorityCache();
  vi.stubGlobal('fetch', vi.fn());
  // 没配 NEXT_PUBLIC_HELIUS_RPC 时 lib 直接走 fallback,测试需要任意 URL 激活 RPC 路径
  if (!process.env.NEXT_PUBLIC_HELIUS_RPC) {
    process.env.NEXT_PUBLIC_HELIUS_RPC = 'https://mainnet.helius-rpc.com/?api-key=test';
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getDynamicPriorityTiers · Helius 正常返 6 分位', () => {
  it('4 档映射 min/medium/high/veryHigh(microLamports/CU)', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          priorityFeeLevels: {
            min: 0,
            low: 50,
            medium: 1000,
            high: 10_000,
            veryHigh: 100_000,
            unsafeMax: 5_000_000,
          },
        },
      }),
    });
    const tiers = await getDynamicPriorityTiers();
    expect(tiers.pilot).toBe(1); // Math.max(1, 0) — 防 0 fee 永远上不去
    expect(tiers.p1).toBe(1000);
    expect(tiers.p2).toBe(10_000);
    expect(tiers.p3).toBe(100_000);
  });

  it('返浮点数 → Math.floor 取整(setComputeUnitPrice 不接小数)', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          priorityFeeLevels: {
            min: 12.7,
            low: 50.5,
            medium: 999.99,
            high: 10_000.4,
            veryHigh: 100_500.6,
            unsafeMax: 5_000_000,
          },
        },
      }),
    });
    const tiers = await getDynamicPriorityTiers();
    expect(tiers.pilot).toBe(12); // floor(12.7)
    expect(tiers.p1).toBe(999); // floor(999.99)
    expect(tiers.p2).toBe(10_000);
    expect(tiers.p3).toBe(100_500);
    // 全是整数
    for (const v of Object.values(tiers)) {
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});

describe('getDynamicPriorityTiers · 失败 fallback 到静态值', () => {
  it('网络错 → fallback 到 PRIORITY_TIER_LAMPORTS 反算的 microLamports/CU', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network'));
    const tiers = await getDynamicPriorityTiers();
    expect(tiers.pilot).toBe(getMicroLamportsForTier('pilot')); // 25_000
    expect(tiers.p1).toBe(getMicroLamportsForTier('p1')); // 250_000
    expect(tiers.p2).toBe(getMicroLamportsForTier('p2')); // 2_500_000
    expect(tiers.p3).toBe(getMicroLamportsForTier('p3')); // 25_000_000
  });

  it('HTTP 500 → fallback', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
    });
    const tiers = await getDynamicPriorityTiers();
    expect(tiers.pilot).toBe(getMicroLamportsForTier('pilot'));
    expect(tiers.p3).toBe(getMicroLamportsForTier('p3'));
  });

  it('priorityFeeLevels 字段缺失 → fallback', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: {} }),
    });
    const tiers = await getDynamicPriorityTiers();
    expect(tiers.pilot).toBe(getMicroLamportsForTier('pilot'));
  });

  it('priorityFeeLevels 子字段缺(medium 不是 number) → fallback', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          priorityFeeLevels: {
            min: 0,
            low: 50,
            // medium 缺失 / 是 string
            medium: 'oops',
            high: 10_000,
            veryHigh: 100_000,
            unsafeMax: 5_000_000,
          },
        },
      }),
    });
    const tiers = await getDynamicPriorityTiers();
    expect(tiers.pilot).toBe(getMicroLamportsForTier('pilot'));
  });
});

describe('getDynamicPriorityTiers · 30s 缓存命中', () => {
  it('第二次调用不再打 RPC', async () => {
    const fetchMock = (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          priorityFeeLevels: {
            min: 0,
            low: 50,
            medium: 1000,
            high: 10_000,
            veryHigh: 100_000,
            unsafeMax: 5_000_000,
          },
        },
      }),
    });
    const t1 = await getDynamicPriorityTiers();
    const t2 = await getDynamicPriorityTiers();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(t1).toEqual(t2);
  });

  it('inflight dedup · 并发 2 次同时只打 1 次 RPC', async () => {
    const fetchMock = (fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({
                  result: {
                    priorityFeeLevels: {
                      min: 0,
                      low: 50,
                      medium: 1000,
                      high: 10_000,
                      veryHigh: 100_000,
                      unsafeMax: 5_000_000,
                    },
                  },
                }),
              } as unknown as Response),
            10
          )
        )
    );
    const [t1, t2] = await Promise.all([
      getDynamicPriorityTiers(),
      getDynamicPriorityTiers(),
    ]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(t1).toEqual(t2);
  });
});
