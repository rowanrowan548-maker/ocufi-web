import { describe, it, expect } from 'vitest';
import { formatExecPrice } from '../exec-price';

const fmt = (n: number): string => {
  if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
  if (n >= 0.0001) return n.toFixed(6);
  return n.toFixed(9);
};

describe('formatExecPrice', () => {
  it('uses backend execPriceUsd when present', () => {
    expect(
      formatExecPrice({ execPriceUsd: 0.0001234, type: 'buy', tokenAmount: 1, solAmount: 1, tokenMint: 'M' }, fmt)
    ).toBe(fmt(0.0001234));
  });

  it('falls back to SOL ÷ tokenAmount for swap when backend missing', () => {
    expect(
      formatExecPrice({ type: 'buy', tokenMint: 'M', tokenAmount: 1_000_000, solAmount: 0.5 }, fmt)
    ).toBe(`${fmt(0.5 / 1_000_000)} SOL`);
  });

  it('returns — for non-swap types (transfer in/out)', () => {
    expect(
      formatExecPrice({ type: 'transfer_in', tokenMint: 'M', tokenAmount: 1, solAmount: 1 }, fmt)
    ).toBe('—');
  });

  it('returns — when no tokenMint (pure SOL transfer)', () => {
    expect(formatExecPrice({ type: 'buy', solAmount: 1, tokenAmount: 0 }, fmt)).toBe('—');
  });

  it('returns — when amounts are zero or missing', () => {
    expect(formatExecPrice({ type: 'sell', tokenMint: 'M', tokenAmount: 0, solAmount: 1 }, fmt)).toBe('—');
    expect(formatExecPrice({ type: 'sell', tokenMint: 'M', tokenAmount: 1, solAmount: 0 }, fmt)).toBe('—');
    expect(formatExecPrice({ type: 'sell', tokenMint: 'M' }, fmt)).toBe('—');
  });

  it('handles tiny values without losing precision', () => {
    const out = formatExecPrice(
      { type: 'buy', tokenMint: 'M', tokenAmount: 1e9, solAmount: 0.0001 },
      fmt
    );
    // 0.0001 / 1e9 = 1e-13 → toFixed(9) → "0.000000000"
    expect(out).toBe(`${(1e-13).toFixed(9)} SOL`);
  });
});
