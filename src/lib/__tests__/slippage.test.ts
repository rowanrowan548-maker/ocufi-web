import { describe, it, expect } from 'vitest';
import { computeRealizedSlippageBps } from '@/lib/slippage';

/**
 * T-FE-SLIPPAGE-COLUMN · 真滑点算法单测
 *
 * V1 仅 sell(output = SOL · 1e9 lamports)
 * BUY 行待 ⛓️ 在 quote 加 quoteOutDecimals 后 V1.1 扩
 */

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const OTHER_MINT = '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs';

describe('computeRealizedSlippageBps · sell 行', () => {
  it('actual < quote → 正 bps(常见 · 损失)', () => {
    // quote 1 SOL · actual 0.99 SOL → loss 0.01 SOL → 100 bps
    const bps = computeRealizedSlippageBps({
      side: 'sell',
      outputMint: SOL_MINT,
      quoteOutAmount: '1000000000',
      actualSolReceived: 0.99,
    });
    expect(bps).not.toBeNull();
    expect(bps!).toBeCloseTo(100, 5);
  });

  it('actual > quote → 负 bps(套利获益)', () => {
    // quote 1 SOL · actual 1.0005 SOL → gain → -5 bps
    const bps = computeRealizedSlippageBps({
      side: 'sell',
      outputMint: SOL_MINT,
      quoteOutAmount: '1000000000',
      actualSolReceived: 1.0005,
    });
    expect(bps).not.toBeNull();
    expect(bps!).toBeLessThan(0);
    expect(bps!).toBeCloseTo(-5, 3);
  });

  it('actual == quote → 0 bps', () => {
    const bps = computeRealizedSlippageBps({
      side: 'sell',
      outputMint: SOL_MINT,
      quoteOutAmount: '1000000000',
      actualSolReceived: 1.0,
    });
    expect(bps).toBe(0);
  });

  it('小额 · 50000 lamports quote · actual 49500 → 100 bps', () => {
    const bps = computeRealizedSlippageBps({
      side: 'sell',
      outputMint: SOL_MINT,
      quoteOutAmount: '50000',
      actualSolReceived: 49500 / 1_000_000_000,
    });
    expect(bps).not.toBeNull();
    expect(bps!).toBeCloseTo(100, 3);
  });
});

describe('computeRealizedSlippageBps · 边界回退 null', () => {
  it('side=buy → null(V1 不支持)', () => {
    expect(
      computeRealizedSlippageBps({
        side: 'buy',
        outputMint: OTHER_MINT,
        quoteOutAmount: '12345',
        actualSolReceived: 0,
      }),
    ).toBeNull();
  });

  it('outputMint 非 SOL → null', () => {
    expect(
      computeRealizedSlippageBps({
        side: 'sell',
        outputMint: OTHER_MINT,
        quoteOutAmount: '1000000000',
        actualSolReceived: 0.99,
      }),
    ).toBeNull();
  });

  it('quoteOutAmount=0 → null', () => {
    expect(
      computeRealizedSlippageBps({
        side: 'sell',
        outputMint: SOL_MINT,
        quoteOutAmount: '0',
        actualSolReceived: 0.99,
      }),
    ).toBeNull();
  });

  it('quoteOutAmount 非数字 → null', () => {
    expect(
      computeRealizedSlippageBps({
        side: 'sell',
        outputMint: SOL_MINT,
        quoteOutAmount: 'abc',
        actualSolReceived: 0.99,
      }),
    ).toBeNull();
  });

  it('actualSolReceived=0 → null', () => {
    expect(
      computeRealizedSlippageBps({
        side: 'sell',
        outputMint: SOL_MINT,
        quoteOutAmount: '1000000000',
        actualSolReceived: 0,
      }),
    ).toBeNull();
  });

  it('actualSolReceived=NaN → null', () => {
    expect(
      computeRealizedSlippageBps({
        side: 'sell',
        outputMint: SOL_MINT,
        quoteOutAmount: '1000000000',
        actualSolReceived: NaN,
      }),
    ).toBeNull();
  });
});
