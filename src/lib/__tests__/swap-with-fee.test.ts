import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getFeeBps, buildFeeMemoText } from '@/lib/swap-with-fee';

/**
 * T-FEE-CONFIG-onchain · feeBps env 驱动测试
 *
 * 4 case 覆盖:
 *   1. buy + ENV_BUY=10(默认)→ 收 0.1% buy fee
 *   2. sell + ENV_SELL=0(默认)→ 不收 fee
 *   3. sell + ENV_SELL=10 → 收 0.1% sell fee(模拟未来阶段 4)
 *   4. buy + ENV_BUY=5 + sell + ENV_SELL=5 → 进出各 0.05%(模拟未来阶段 3)
 *
 * 加 buildFeeMemoText 文本生成测试(动态化锁定)
 */

const ORIGINAL_BUY = process.env.NEXT_PUBLIC_FEE_BPS_BUY;
const ORIGINAL_SELL = process.env.NEXT_PUBLIC_FEE_BPS_SELL;

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_FEE_BPS_BUY;
  delete process.env.NEXT_PUBLIC_FEE_BPS_SELL;
});
afterEach(() => {
  if (ORIGINAL_BUY !== undefined) process.env.NEXT_PUBLIC_FEE_BPS_BUY = ORIGINAL_BUY;
  else delete process.env.NEXT_PUBLIC_FEE_BPS_BUY;
  if (ORIGINAL_SELL !== undefined) process.env.NEXT_PUBLIC_FEE_BPS_SELL = ORIGINAL_SELL;
  else delete process.env.NEXT_PUBLIC_FEE_BPS_SELL;
});

describe('getFeeBps · 4 case 覆盖 V1 → 阶段 4 演进', () => {
  it('case 1 · buy + ENV 缺 → 默认 10(0.1% · V1)', () => {
    expect(getFeeBps('buy')).toBe(10);
  });

  it('case 2 · sell + ENV 缺 → 默认 0(V1 不收 sell fee)', () => {
    expect(getFeeBps('sell')).toBe(0);
  });

  it('case 3 · sell + ENV_SELL=10 → 10(0.1% sell · 阶段 4)', () => {
    process.env.NEXT_PUBLIC_FEE_BPS_SELL = '10';
    expect(getFeeBps('sell')).toBe(10);
  });

  it('case 4 · buy ENV=5 + sell ENV=5 → 进出各 0.05%(阶段 3)', () => {
    process.env.NEXT_PUBLIC_FEE_BPS_BUY = '5';
    process.env.NEXT_PUBLIC_FEE_BPS_SELL = '5';
    expect(getFeeBps('buy')).toBe(5);
    expect(getFeeBps('sell')).toBe(5);
  });
});

describe('getFeeBps · 防御性边界', () => {
  it('ENV 非数字字符串 → 兜底默认值', () => {
    process.env.NEXT_PUBLIC_FEE_BPS_BUY = 'abc';
    expect(getFeeBps('buy')).toBe(10);
    process.env.NEXT_PUBLIC_FEE_BPS_SELL = 'xyz';
    expect(getFeeBps('sell')).toBe(0);
  });

  it('ENV 负数 → 兜底默认值(防 env 配错乱扣 fee)', () => {
    process.env.NEXT_PUBLIC_FEE_BPS_BUY = '-5';
    expect(getFeeBps('buy')).toBe(10);
  });

  it('ENV 空字符串 → 兜底默认值', () => {
    process.env.NEXT_PUBLIC_FEE_BPS_BUY = '';
    expect(getFeeBps('buy')).toBe(10);
  });

  it('ENV 0 显式配置 → 接受 0(用户主动关 fee)', () => {
    process.env.NEXT_PUBLIC_FEE_BPS_BUY = '0';
    expect(getFeeBps('buy')).toBe(0);
  });
});

describe('buildFeeMemoText · 文本动态化', () => {
  it('V1 buy 0.1% → "Ocufi 0.1% buy fee · ocufi.io/fees"', () => {
    expect(buildFeeMemoText(10, true)).toBe('Ocufi 0.1% buy fee · ocufi.io/fees');
  });

  it('阶段 4 sell 0.1% → "Ocufi 0.1% sell fee · ocufi.io/fees"', () => {
    expect(buildFeeMemoText(10, false)).toBe('Ocufi 0.1% sell fee · ocufi.io/fees');
  });

  it('阶段 3 buy 0.05% → "Ocufi 0.05% buy fee · ocufi.io/fees"(2 位小数)', () => {
    expect(buildFeeMemoText(5, true)).toBe('Ocufi 0.05% buy fee · ocufi.io/fees');
  });

  it('整数百分比 1.0% → "Ocufi 1.0% buy fee"(1 位小数)', () => {
    expect(buildFeeMemoText(100, true)).toBe('Ocufi 1.0% buy fee · ocufi.io/fees');
  });

  it('非整数 0.25% → "Ocufi 0.25% sell fee"(2 位小数)', () => {
    expect(buildFeeMemoText(25, false)).toBe('Ocufi 0.25% sell fee · ocufi.io/fees');
  });
});
