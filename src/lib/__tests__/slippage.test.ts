import { describe, it, expect } from 'vitest';
import { computeRealizedSlippageBps } from '@/lib/slippage';

/**
 * T-FE-SLIPPAGE-COLUMN + T-FE-SLIPPAGE-BUY · 真滑点算法单测
 *
 * SELL 行(V1.0 · output = SOL · 1e9 lamports)
 * BUY 行(V1.1 · output 任意 SPL · quoteOutDecimals 来自 ⛓️ T-ONCHAIN-QUOTE-DECIMALS)
 */

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const MEME_MINT = '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs';

describe('computeRealizedSlippageBps · sell 行(V1.0)', () => {
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

  it('outputMint 非 SOL → null', () => {
    expect(
      computeRealizedSlippageBps({
        side: 'sell',
        outputMint: MEME_MINT,
        quoteOutAmount: '1000000000',
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
});

describe('computeRealizedSlippageBps · buy 行(V1.1)', () => {
  it('USDC decimals=6 · 损失场景(quote 100 USDC raw 100_000_000 · actual 99 USDC)→ 100 bps', () => {
    const bps = computeRealizedSlippageBps({
      side: 'buy',
      outputMint: USDC_MINT,
      quoteOutAmount: '100000000', // raw · 100 USDC × 1e6
      quoteOutDecimals: 6,
      actualTokenReceived: 99,
    });
    expect(bps).not.toBeNull();
    expect(bps!).toBeCloseTo(100, 5);
  });

  it('USDC decimals=6 · 套利获益(actual 100.05)→ 负 bps', () => {
    const bps = computeRealizedSlippageBps({
      side: 'buy',
      outputMint: USDC_MINT,
      quoteOutAmount: '100000000',
      quoteOutDecimals: 6,
      actualTokenReceived: 100.05,
    });
    expect(bps).not.toBeNull();
    expect(bps!).toBeLessThan(0);
    expect(bps!).toBeCloseTo(-5, 3);
  });

  it('meme decimals=9 · quote 1B token raw 1e18 · actual 0.99B → 100 bps', () => {
    const bps = computeRealizedSlippageBps({
      side: 'buy',
      outputMint: MEME_MINT,
      quoteOutAmount: '1000000000000000000', // 1B × 1e9
      quoteOutDecimals: 9,
      actualTokenReceived: 990_000_000,
    });
    expect(bps).not.toBeNull();
    expect(bps!).toBeCloseTo(100, 3);
  });

  it('quoteOutDecimals 缺失 → null(防 NaN)', () => {
    expect(
      computeRealizedSlippageBps({
        side: 'buy',
        outputMint: USDC_MINT,
        quoteOutAmount: '100000000',
        actualTokenReceived: 99,
      }),
    ).toBeNull();
  });

  it('quoteOutDecimals 非整数 → null', () => {
    expect(
      computeRealizedSlippageBps({
        side: 'buy',
        outputMint: USDC_MINT,
        quoteOutAmount: '100000000',
        quoteOutDecimals: 6.5,
        actualTokenReceived: 99,
      }),
    ).toBeNull();
  });

  it('quoteOutDecimals 超界(99)→ null(防 Infinity)', () => {
    expect(
      computeRealizedSlippageBps({
        side: 'buy',
        outputMint: USDC_MINT,
        quoteOutAmount: '100000000',
        quoteOutDecimals: 99,
        actualTokenReceived: 99,
      }),
    ).toBeNull();
  });

  it('actualTokenReceived=0 → null', () => {
    expect(
      computeRealizedSlippageBps({
        side: 'buy',
        outputMint: USDC_MINT,
        quoteOutAmount: '100000000',
        quoteOutDecimals: 6,
        actualTokenReceived: 0,
      }),
    ).toBeNull();
  });
});

describe('computeRealizedSlippageBps · 共通边界回 null', () => {
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
