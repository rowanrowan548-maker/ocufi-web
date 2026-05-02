// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  estimateMevSavings,
  reportMevProtection,
  MEV_PROTECTION_BASELINE_BPS,
  type MevReportPayload,
} from '@/lib/mev-protection';
import type { JupiterQuote } from '@/lib/jupiter';

/**
 * api-client mock · 必须在 import 之前 vi.mock(vitest hoist 自动处理)
 *
 * 模块原 API_URL 在 module load 时从 env 读固定 const · 单测无法运行时改
 * 直接 mock apiFetch + ApiError + isApiConfigured · 用 mock state 控制行为
 */
const mockState = {
  isConfigured: true,
  // 'ok' | { status: number; body: string } | Error
  response: 'ok' as 'ok' | { status: number; body: string } | Error,
  lastCall: null as { path: string; init?: RequestInit } | null,
};

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return {
    ApiError: actual.ApiError,
    isApiConfigured: () => mockState.isConfigured,
    apiFetch: vi.fn(async (path: string, init?: RequestInit) => {
      mockState.lastCall = { path, init };
      const r = mockState.response;
      if (r === 'ok') return { ok: true };
      if (r instanceof Error) throw r;
      throw new actual.ApiError({
        status: r.status,
        path,
        body: r.body,
        isNetwork: false,
      });
    }),
  };
});

/**
 * T-CHAIN-MEV-PROTECTION Phase A · mev-protection.ts 单测
 *
 * 覆盖:
 *   - estimate 算法 5 case(无滑点 / 轻滑点 / 严重 sandwich / 反向利好 / div-by-zero 防御)
 *   - report 失败静默 4 case(NEXT_PUBLIC_API_URL 未配 / 后端 404 / 后端 5xx / network)
 *   - report 成功 1 case(后端 200)
 *   - quote.outAmount 不可解析 → __ERR_MEV_QUOTE_INVALID
 */

const SOL = 'So11111111111111111111111111111111111111112';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

function makeQuote(outAmount: string): JupiterQuote {
  return {
    inputMint: SOL,
    outputMint: USDC,
    inAmount: '1000000000', // 1 SOL
    outAmount,
    otherAmountThreshold: '0',
    swapMode: 'ExactIn',
    slippageBps: 100,
    priceImpactPct: '0.1',
    routePlan: [],
  };
}

describe('estimateMevSavings · 算法', () => {
  it('actual = expected · 滑点 0 bps · 节省 = 全 baseline(用户走老路径还没省)', () => {
    const out = estimateMevSavings({
      quote: makeQuote('1000000'),
      actualOutRaw: BigInt(1_000_000),
      amountSol: 1,
    });
    expect(out.realizedSlippageBps).toBe(0);
    // 1 SOL × 50 bps = 0.005 SOL baseline · realized 0 → saved = 0.005
    expect(out.mevSavedSol).toBeCloseTo(0.005, 6);
    expect(out.expectedOut).toBe(BigInt(1_000_000));
    expect(out.actualOut).toBe(BigInt(1_000_000));
  });

  it('轻滑点 30 bps(优于 baseline 50 bps)→ 节省 ≈ 0.002 SOL · 1 SOL swap', () => {
    // expected 1_000_000 · actual 997_000 → loss 3000 / 1_000_000 = 30 bps
    const out = estimateMevSavings({
      quote: makeQuote('1000000'),
      actualOutRaw: BigInt(997_000),
      amountSol: 1,
    });
    expect(out.realizedSlippageBps).toBe(30);
    // baseline 0.005 - realized 0.003 = 0.002
    expect(out.mevSavedSol).toBeCloseTo(0.002, 6);
  });

  it('严重 sandwich 200 bps(> baseline 50 bps)→ 节省为负(报告里如实展示)', () => {
    const out = estimateMevSavings({
      quote: makeQuote('1000000'),
      actualOutRaw: BigInt(980_000),
      amountSol: 1,
    });
    expect(out.realizedSlippageBps).toBe(200);
    // baseline 0.005 - realized 0.020 = -0.015
    expect(out.mevSavedSol).toBeCloseTo(-0.015, 6);
  });

  it('反向利好(actual > expected · 罕见 Jupiter 报价保守)→ 滑点负 · 节省超 baseline', () => {
    const out = estimateMevSavings({
      quote: makeQuote('1000000'),
      actualOutRaw: BigInt(1_010_000),
      amountSol: 1,
    });
    // loss = -10000 / 1_000_000 = -100 bps
    expect(out.realizedSlippageBps).toBe(-100);
    // baseline 0.005 - (-0.010) = 0.015
    expect(out.mevSavedSol).toBeCloseTo(0.015, 6);
  });

  it('expectedOut = 0 · div-by-zero 防御 · 滑点 0 + 节省 0', () => {
    const out = estimateMevSavings({
      quote: makeQuote('0'),
      actualOutRaw: BigInt(0),
      amountSol: 1,
    });
    expect(out.realizedSlippageBps).toBe(0);
    expect(out.mevSavedSol).toBe(0);
  });

  it('amountSol = 0(卖出场景 amountSol 上层传 0)· 节省 0', () => {
    const out = estimateMevSavings({
      quote: makeQuote('1000000'),
      actualOutRaw: BigInt(950_000),
      amountSol: 0,
    });
    expect(out.realizedSlippageBps).toBe(500);
    expect(out.mevSavedSol).toBe(0);
  });

  it('quote.outAmount 不可解析 BigInt → __ERR_MEV_QUOTE_INVALID', () => {
    const badQuote = { ...makeQuote('not-a-number') };
    expect(() =>
      estimateMevSavings({ quote: badQuote, actualOutRaw: BigInt(1_000_000), amountSol: 1 })
    ).toThrow('__ERR_MEV_QUOTE_INVALID');
  });

  it('BigInt 大量 raw(超 2^53)滑点算法不丢精度', () => {
    const HUGE_EXPECTED = BigInt('900000000000000000');
    const HUGE_ACTUAL = BigInt('891000000000000000'); // loss 100 bps
    const out = estimateMevSavings({
      quote: makeQuote(HUGE_EXPECTED.toString()),
      actualOutRaw: HUGE_ACTUAL,
      amountSol: 1,
    });
    expect(out.realizedSlippageBps).toBe(100);
  });

  it('baseline 常量 = 50 bps · UI 文案对齐', () => {
    expect(MEV_PROTECTION_BASELINE_BPS).toBe(50);
  });
});

describe('reportMevProtection · 失败静默', () => {
  const VALID_PAYLOAD: MevReportPayload = {
    sig: '5sv1jdRjQSu4iqwn8VmpzAEqGfWX6jbVN8ahMrU4ASjyDhPpRyFMqHkVHnGzsm56NaHv7XjAxc1Y6Q',
    wallet: 'AVmAj5Q7gZP3VXkCvY4nW8YpQ3JhFc6PqU3xRzKn2UCGB',
    mint: USDC,
    amount_sol: 0.1,
    expected_out: '1000000',
    actual_out: '997000',
    mev_saved_sol_estimate: 0.0002,
    used_sender: false,
    realized_slippage_bps: 30,
  };

  beforeEach(() => {
    mockState.isConfigured = true;
    mockState.response = 'ok';
    mockState.lastCall = null;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('NEXT_PUBLIC_API_URL 未配 → 立刻返 false · 不打 apiFetch', async () => {
    mockState.isConfigured = false;
    const ok = await reportMevProtection(VALID_PAYLOAD);
    expect(ok).toBe(false);
    expect(mockState.lastCall).toBeNull();
  });

  it('后端 200 → 返 true', async () => {
    mockState.response = 'ok';
    const ok = await reportMevProtection(VALID_PAYLOAD);
    expect(ok).toBe(true);
    expect(mockState.lastCall?.path).toBe('/trades/report-mev');
  });

  it('后端 404(endpoint 没 ship)→ 返 false · console.warn 含 "not deployed yet"', async () => {
    mockState.response = { status: 404, body: 'Not Found' };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const ok = await reportMevProtection(VALID_PAYLOAD);
    expect(ok).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0][0]).toMatch(/not deployed yet/i);
  });

  it('后端 503 → 返 false · console.warn 含 "503"', async () => {
    mockState.response = { status: 503, body: 'Service Unavailable' };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const ok = await reportMevProtection(VALID_PAYLOAD);
    expect(ok).toBe(false);
    expect(warnSpy.mock.calls[0][0]).toMatch(/503/);
  });

  it('network 失败 → 返 false · console.warn · 不抛', async () => {
    mockState.response = new Error('TLS handshake failed');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const ok = await reportMevProtection(VALID_PAYLOAD);
    expect(ok).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('payload body 含全部 SPEC 字段 · 不漏字段', async () => {
    mockState.response = 'ok';
    await reportMevProtection(VALID_PAYLOAD);
    expect(mockState.lastCall?.path).toBe('/trades/report-mev');
    const body = JSON.parse(String(mockState.lastCall?.init?.body));
    expect(body).toMatchObject({
      sig: VALID_PAYLOAD.sig,
      wallet: VALID_PAYLOAD.wallet,
      mint: VALID_PAYLOAD.mint,
      amount_sol: VALID_PAYLOAD.amount_sol,
      expected_out: VALID_PAYLOAD.expected_out,
      actual_out: VALID_PAYLOAD.actual_out,
      mev_saved_sol_estimate: VALID_PAYLOAD.mev_saved_sol_estimate,
      used_sender: false,
      realized_slippage_bps: 30,
    });
  });
});
