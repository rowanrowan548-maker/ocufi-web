import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  formatPrice,
  formatCompact,
  formatUsdCompact,
  formatAge,
} from '@/lib/format';

/**
 * T-501 格式化工具单测
 *
 * 覆盖 BUG-022 边界:NaN / Infinity / null / undefined 三态都应回退 '—'
 * 同时锁定 formatAge 各时间桶的临界值
 */

describe('formatCompact · 边界值', () => {
  it('null → —', () => {
    expect(formatCompact(null)).toBe('—');
  });
  it('undefined → —', () => {
    expect(formatCompact(undefined)).toBe('—');
  });
  it('NaN → —', () => {
    expect(formatCompact(NaN)).toBe('—');
  });
  it('+Infinity → —', () => {
    expect(formatCompact(Infinity)).toBe('—');
  });
  it('-Infinity → —', () => {
    expect(formatCompact(-Infinity)).toBe('—');
  });
  it('0 → "0.00"(零是合法值,不是空)', () => {
    expect(formatCompact(0)).toBe('0.00');
  });
  it('1234 → 1.23K', () => {
    expect(formatCompact(1234)).toBe('1.23K');
  });
  it('1234567 → 1.23M', () => {
    expect(formatCompact(1234567)).toBe('1.23M');
  });
  it('1.234e9 → 1.23B', () => {
    expect(formatCompact(1.234e9)).toBe('1.23B');
  });
  it('负数 -1234 → -1.23K(保留负号 sign)', () => {
    expect(formatCompact(-1234)).toBe('-1.23K');
  });
});

describe('formatUsdCompact · 边界值', () => {
  it('null → —(注:不是 "$—",直接 — 占位)', () => {
    expect(formatUsdCompact(null)).toBe('—');
  });
  it('undefined → —', () => {
    expect(formatUsdCompact(undefined)).toBe('—');
  });
  it('NaN → —', () => {
    expect(formatUsdCompact(NaN)).toBe('—');
  });
  it('Infinity → —', () => {
    expect(formatUsdCompact(Infinity)).toBe('—');
  });
  it('524000000 → $524.00M', () => {
    expect(formatUsdCompact(524_000_000)).toBe('$524.00M');
  });
});

describe('formatPrice · 边界 + 零塌缩', () => {
  it('null / undefined / NaN / 0 / -Infinity → —', () => {
    expect(formatPrice(null)).toBe('—');
    expect(formatPrice(undefined)).toBe('—');
    expect(formatPrice(NaN)).toBe('—');
    expect(formatPrice(0)).toBe('—');
    expect(formatPrice(-Infinity)).toBe('—');
  });
  it('1234 → 1,234(千分位无小数)', () => {
    expect(formatPrice(1234)).toBe('1,234');
  });
  it('1.5 → 1.500(P3-FE-16 · 4 sig)', () => {
    expect(formatPrice(1.5)).toBe('1.500');
  });
  it('12.34 → 12.34(P3-FE-16 · 4 sig)', () => {
    expect(formatPrice(12.34)).toBe('12.34');
  });
  it('0.5 → 0.5000', () => {
    expect(formatPrice(0.5)).toBe('0.5000');
  });
  it('0.0484 → 0.04840(P3-FE-16 · 4 sig)', () => {
    expect(formatPrice(0.0484)).toBe('0.04840');
  });
  it('0.001 → 0.001000', () => {
    expect(formatPrice(0.001)).toBe('0.001000');
  });
  it('0.000347 → 0.0003470(P3-FE-16 · 4 sig)', () => {
    expect(formatPrice(0.000347)).toBe('0.0003470');
  });
  it('0.00001234(4 个零,触发 ₄ 塌缩)→ 0.0₄1234', () => {
    expect(formatPrice(0.00001234)).toBe('0.0₄1234');
  });
});

describe('formatAge · 时间桶边界', () => {
  // 锁定一个固定 "now",所有测试都从这个 now 倒推
  const NOW = new Date('2026-04-27T12:00:00Z').getTime();
  const fakeT = (key: string) => key; // 仅返回 key,忽略 vars

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('null → —', () => {
    expect(formatAge(null, fakeT)).toBe('—');
  });
  it('undefined → —', () => {
    expect(formatAge(undefined, fakeT)).toBe('—');
  });
  it('NaN → —', () => {
    expect(formatAge(NaN, fakeT)).toBe('—');
  });
  it('未来时间(ms 比 now 大)→ —', () => {
    expect(formatAge(NOW + 60_000, fakeT)).toBe('—');
  });
  it('< 1min(30s)→ justNow', () => {
    expect(formatAge(NOW - 30_000, fakeT)).toBe('token.age.justNow');
  });
  it('恰好 1min → minutes 桶', () => {
    expect(formatAge(NOW - 60_000, fakeT)).toBe('token.age.minutes');
  });
  it('59min → minutes 桶', () => {
    expect(formatAge(NOW - 59 * 60_000, fakeT)).toBe('token.age.minutes');
  });
  it('恰好 1h → hours 桶', () => {
    expect(formatAge(NOW - 60 * 60_000, fakeT)).toBe('token.age.hours');
  });
  it('恰好 1d(24h)→ days 桶', () => {
    expect(formatAge(NOW - 24 * 60 * 60_000, fakeT)).toBe('token.age.days');
  });
  it('29d → days 桶(< 30d)', () => {
    expect(formatAge(NOW - 29 * 24 * 60 * 60_000, fakeT)).toBe('token.age.days');
  });
  it('30d → months 桶', () => {
    expect(formatAge(NOW - 30 * 24 * 60 * 60_000, fakeT)).toBe('token.age.months');
  });
  it('364d → months 桶(< 365d)', () => {
    expect(formatAge(NOW - 364 * 24 * 60 * 60_000, fakeT)).toBe('token.age.months');
  });
  it('365d → years 桶(注:lib 用 365 而非 365.25,记一笔)', () => {
    expect(formatAge(NOW - 365 * 24 * 60 * 60_000, fakeT)).toBe('token.age.years');
  });
});
