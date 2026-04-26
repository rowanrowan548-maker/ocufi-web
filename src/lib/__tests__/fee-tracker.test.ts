import { describe, it, expect, beforeEach } from 'vitest';
import { readFees, recordFee } from '@/lib/fee-tracker';

const WALLET = 'TestWallet1111111111111111111111111111111111';

describe('fee-tracker · hello world', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('readFees returns zeros for an unknown wallet', () => {
    const f = readFees(WALLET);
    expect(f.ocufiSol).toBe(0);
    expect(f.txCount).toBe(0);
    expect(f.lastAt).toBe(0);
  });

  it('recordFee accumulates and persists across reads', () => {
    recordFee(WALLET, { ocufiSol: 0.0001, networkSol: 0.000005, volumeSol: 0.1 });
    recordFee(WALLET, { ocufiSol: 0.0002, networkSol: 0.000005, volumeSol: 0.2 });
    const f = readFees(WALLET);
    expect(f.txCount).toBe(2);
    expect(f.ocufiSol).toBeCloseTo(0.0003, 9);
    expect(f.volumeSol).toBeCloseTo(0.3, 9);
  });
});
