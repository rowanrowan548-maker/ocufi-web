import { describe, it, expect } from 'vitest';
import {
  PRIORITY_TIER_LAMPORTS,
  getMicroLamportsForTier,
  type PriorityTier,
} from '@/lib/priority-fees';

/**
 * T-985d · 4 档优先费 unit test
 *
 * 锁死 4 档常量值 + helper 反算公式,防未来误改 lamports 量级
 */

describe('PRIORITY_TIER_LAMPORTS · 4 档常量值锁定', () => {
  it('pilot 档 = 5_000 lamports(0.000005 SOL · 慢)', () => {
    expect(PRIORITY_TIER_LAMPORTS.pilot).toBe(5_000);
  });

  it('p1 档 = 50_000 lamports(0.00005 SOL · 标准)', () => {
    expect(PRIORITY_TIER_LAMPORTS.p1).toBe(50_000);
  });

  it('p2 档 = 500_000 lamports(0.0005 SOL · 快)', () => {
    expect(PRIORITY_TIER_LAMPORTS.p2).toBe(500_000);
  });

  it('p3 档 = 5_000_000 lamports(0.005 SOL · 极速 / MEV-protect)', () => {
    expect(PRIORITY_TIER_LAMPORTS.p3).toBe(5_000_000);
  });

  it('4 档严格单调递增(pilot < p1 < p2 < p3)', () => {
    expect(PRIORITY_TIER_LAMPORTS.pilot).toBeLessThan(PRIORITY_TIER_LAMPORTS.p1);
    expect(PRIORITY_TIER_LAMPORTS.p1).toBeLessThan(PRIORITY_TIER_LAMPORTS.p2);
    expect(PRIORITY_TIER_LAMPORTS.p2).toBeLessThan(PRIORITY_TIER_LAMPORTS.p3);
  });

  it('每档档差为 10x(防加新档误改量级)', () => {
    expect(PRIORITY_TIER_LAMPORTS.p1 / PRIORITY_TIER_LAMPORTS.pilot).toBe(10);
    expect(PRIORITY_TIER_LAMPORTS.p2 / PRIORITY_TIER_LAMPORTS.p1).toBe(10);
    expect(PRIORITY_TIER_LAMPORTS.p3 / PRIORITY_TIER_LAMPORTS.p2).toBe(10);
  });
});

describe('getMicroLamportsForTier · 反算 microLamports/CU(典型 swap 200K CU)', () => {
  // 公式:microLamports/CU = lamports × 1_000_000 / TYPICAL_SWAP_CU(200_000)
  it('pilot → 25_000 microLamports/CU', () => {
    expect(getMicroLamportsForTier('pilot')).toBe(25_000);
  });

  it('p1 → 250_000 microLamports/CU', () => {
    expect(getMicroLamportsForTier('p1')).toBe(250_000);
  });

  it('p2 → 2_500_000 microLamports/CU', () => {
    expect(getMicroLamportsForTier('p2')).toBe(2_500_000);
  });

  it('p3 → 25_000_000 microLamports/CU(MEV-protect 极速档位)', () => {
    expect(getMicroLamportsForTier('p3')).toBe(25_000_000);
  });

  it('4 档反算后仍严格单调(单位换算不丢序)', () => {
    const tiers: PriorityTier[] = ['pilot', 'p1', 'p2', 'p3'];
    const values = tiers.map(getMicroLamportsForTier);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });

  it('返回值为正整数(setComputeUnitPrice 接受 number 不接小数)', () => {
    const tiers: PriorityTier[] = ['pilot', 'p1', 'p2', 'p3'];
    for (const t of tiers) {
      const v = getMicroLamportsForTier(t);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
    }
  });
});
