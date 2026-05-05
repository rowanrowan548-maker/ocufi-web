// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  reportTransparency,
  extractRouteDexes,
  parsePriceImpactPct,
  fallbackSymbol,
  calcOcufiFeeLamports,
  calcSavingsLamports,
  TRANSPARENCY_COMPARABLE_FEE_PCT_DEFAULT,
  type TransparencyPayload,
} from '@/lib/transparency-report';
import type { JupiterQuote } from '@/lib/jupiter';

/**
 * T-V2-PHASE-3 P3-CHAIN-1 · transparency-report.ts 单测
 *
 * 覆盖:
 *   - helpers:fallbackSymbol / parsePriceImpactPct / extractRouteDexes / calcOcufiFee / calcSavings
 *   - reportTransparency:200 / 404 / 503 / network reject / NEXT_PUBLIC_API_URL 未配 5 case
 *   - payload 字段(buy + sell)
 *   - 常量导出 0.01
 */

const SOL = 'So11111111111111111111111111111111111111112';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const BONK = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';

const mockState = {
  isConfigured: true,
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
      throw new actual.ApiError({ status: r.status, path, body: r.body, isNetwork: false });
    }),
  };
});

beforeEach(() => {
  mockState.isConfigured = true;
  mockState.response = 'ok';
  mockState.lastCall = null;
  delete process.env.NEXT_PUBLIC_TRANSPARENCY_COMPARABLE_FEE_PCT;
  delete process.env.NEXT_PUBLIC_FEE_BPS_BUY;
  delete process.env.NEXT_PUBLIC_FEE_BPS_SELL;
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('fallbackSymbol', () => {
  it('SOL_MINT → "SOL"', () => {
    expect(fallbackSymbol(SOL)).toBe('SOL');
  });

  it('其他 mint → 前 4 字符占位', () => {
    expect(fallbackSymbol(BONK)).toBe('DezX');
    expect(fallbackSymbol(USDC)).toBe('EPjF');
  });
});

describe('parsePriceImpactPct', () => {
  it('合法字符串 "0.1" → 0.1', () => {
    expect(parsePriceImpactPct({ priceImpactPct: '0.1' } as JupiterQuote)).toBe(0.1);
  });

  it('合法 "1.234" → 1.234', () => {
    expect(parsePriceImpactPct({ priceImpactPct: '1.234' } as JupiterQuote)).toBeCloseTo(1.234);
  });

  it('"NaN" / 非数字 → null', () => {
    expect(parsePriceImpactPct({ priceImpactPct: 'NaN' } as JupiterQuote)).toBeNull();
    expect(parsePriceImpactPct({ priceImpactPct: 'abc' } as JupiterQuote)).toBeNull();
  });

  it('字段不存在(undefined / 非 string)→ null', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(parsePriceImpactPct({} as any)).toBeNull();
  });
});

describe('extractRouteDexes', () => {
  function makeQuoteWithRoute(routePlan: unknown): JupiterQuote {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { routePlan } as any;
  }

  it('单 step Raydium → ["Raydium"]', () => {
    const q = makeQuoteWithRoute([{ swapInfo: { label: 'Raydium' }, percent: 100 }]);
    expect(extractRouteDexes(q)).toEqual(['Raydium']);
  });

  it('多 step + 去重保序 → ["Raydium", "Meteora"]', () => {
    const q = makeQuoteWithRoute([
      { swapInfo: { label: 'Raydium' }, percent: 50 },
      { swapInfo: { label: 'Meteora' }, percent: 30 },
      { swapInfo: { label: 'Raydium' }, percent: 20 },
    ]);
    expect(extractRouteDexes(q)).toEqual(['Raydium', 'Meteora']);
  });

  it('routePlan 空数组 → null', () => {
    expect(extractRouteDexes(makeQuoteWithRoute([]))).toBeNull();
  });

  it('routePlan 非数组 → null', () => {
    expect(extractRouteDexes(makeQuoteWithRoute(null))).toBeNull();
    expect(extractRouteDexes(makeQuoteWithRoute(undefined))).toBeNull();
  });

  it('swapInfo.label 缺失的 step 跳过 · 全跳后返 null', () => {
    const q = makeQuoteWithRoute([
      { swapInfo: {}, percent: 100 },
      { swapInfo: { label: null }, percent: 0 },
    ]);
    expect(extractRouteDexes(q)).toBeNull();
  });

  it('混合 valid + invalid step · 只取有效 label', () => {
    const q = makeQuoteWithRoute([
      { swapInfo: { label: 'Orca' }, percent: 100 },
      { swapInfo: {}, percent: 0 },
      { swapInfo: { label: 'Phoenix' }, percent: 0 },
    ]);
    expect(extractRouteDexes(q)).toEqual(['Orca', 'Phoenix']);
  });
});

describe('calcOcufiFeeLamports', () => {
  it('buy + 1_000_000 lamports + bps 10(0.1%)→ 1000', () => {
    expect(calcOcufiFeeLamports(BigInt(1_000_000), 'buy')).toBe(BigInt(1000));
  });

  it('sell + bps 0(默认)→ 0', () => {
    expect(calcOcufiFeeLamports(BigInt(1_000_000), 'sell')).toBe(BigInt(0));
  });

  it('buy + 大 BigInt(10 SOL)→ 10_000_000', () => {
    expect(calcOcufiFeeLamports(BigInt(10_000_000_000), 'buy')).toBe(BigInt(10_000_000));
  });

  it('floor 行为(notional × 10 / 10000 不整除)→ 截断', () => {
    // 1_000_005 × 10 / 10000 = 1000.005 → 1000(BigInt 自动 floor)
    expect(calcOcufiFeeLamports(BigInt(1_000_005), 'buy')).toBe(BigInt(1000));
  });
});

describe('calcSavingsLamports', () => {
  it('1 SOL buy · ocufi 0.1% · BullX 1% · 省 0.009 SOL = 9_000_000 lamports', () => {
    expect(calcSavingsLamports(BigInt(1_000_000_000), 0.001, 0.01)).toBe(BigInt(9_000_000));
  });

  it('1 SOL sell · ocufi 0% · BullX 1% · 省 0.01 SOL = 10_000_000 lamports', () => {
    expect(calcSavingsLamports(BigInt(1_000_000_000), 0, 0.01)).toBe(BigInt(10_000_000));
  });

  it('ocufi == comparable · 省 0', () => {
    expect(calcSavingsLamports(BigInt(1_000_000_000), 0.01, 0.01)).toBe(BigInt(0));
  });

  it('ocufi > comparable(罕见)· 不报负 · 返 0', () => {
    expect(calcSavingsLamports(BigInt(1_000_000_000), 0.02, 0.01)).toBe(BigInt(0));
  });

  it('大 BigInt notional · 不丢精度', () => {
    // 100_000 SOL × 0.9% 省
    const huge = BigInt('100000000000000000');
    expect(calcSavingsLamports(huge, 0.001, 0.01)).toBe(BigInt('900000000000000'));
  });
});

describe('reportTransparency · 失败静默', () => {
  const VALID_PAYLOAD: TransparencyPayload = {
    sig: '5sv1jdRjQSu4iqwn8VmpzAEqGfWX6jbVN8ahMrU4ASjyDhPpRyFMqHkVHnGzsm56NaHv7XjAxc1Y6Q',
    wallet: 'AVmAj5Q7gZP3VXkCvY4nW8YpQ3JhFc6PqU3xRzKn2UCGB',
    slot: 12345,
    side: 'buy',
    token_in_mint: SOL,
    token_in_symbol: 'SOL',
    token_in_amount: '1000000000',
    token_in_decimals: 9,
    token_out_mint: USDC,
    token_out_symbol: 'EPjF',
    token_out_amount: '999000',
    token_out_decimals: 6,
    ocufi_fee_lamports: '1000000',
    ocufi_fee_pct: 0.001,
    comparable_fee_pct: 0.01,
    savings_lamports: '9000000',
    savings_usd: null,
    gas_lamports: '5000',
    compute_units: 200_000,
    slippage_tolerance_bps: 100,
    slippage_actual_bps: 30,
    mev_protected: true,
    mev_bundle_id: null,
    jupiter_route_dexes: ['Raydium'],
    jupiter_route_steps: [],
    price_impact_pct: 0.1,
    price_usd_at_swap: null,
  };

  it('NEXT_PUBLIC_API_URL 未配 → 立刻返 false · 不打 apiFetch', async () => {
    mockState.isConfigured = false;
    const ok = await reportTransparency(VALID_PAYLOAD);
    expect(ok).toBe(false);
    expect(mockState.lastCall).toBeNull();
  });

  it('后端 200 + ok=true → 返 true', async () => {
    mockState.response = 'ok';
    const ok = await reportTransparency(VALID_PAYLOAD);
    expect(ok).toBe(true);
    expect(mockState.lastCall?.path).toBe('/transparency/report');
  });

  it('后端 404(P3-BE-1 没 ship)→ 返 false · console.warn 含 "not deployed yet"', async () => {
    mockState.response = { status: 404, body: 'Not Found' };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const ok = await reportTransparency(VALID_PAYLOAD);
    expect(ok).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0][0]).toMatch(/not deployed yet/i);
  });

  it('后端 503 → 返 false · console.warn 含 "503"', async () => {
    mockState.response = { status: 503, body: 'Service Unavailable' };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const ok = await reportTransparency(VALID_PAYLOAD);
    expect(ok).toBe(false);
    expect(warnSpy.mock.calls[0][0]).toMatch(/503/);
  });

  it('network reject → 返 false · console.warn · 不抛', async () => {
    mockState.response = new Error('TLS handshake failed');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const ok = await reportTransparency(VALID_PAYLOAD);
    expect(ok).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('payload body 全字段透传 · 不漏字段', async () => {
    mockState.response = 'ok';
    await reportTransparency(VALID_PAYLOAD);
    expect(mockState.lastCall?.path).toBe('/transparency/report');
    const body = JSON.parse(String(mockState.lastCall?.init?.body));
    expect(body).toMatchObject({
      sig: VALID_PAYLOAD.sig,
      wallet: VALID_PAYLOAD.wallet,
      slot: VALID_PAYLOAD.slot,
      side: 'buy',
      token_in_mint: SOL,
      token_in_amount: '1000000000',
      token_out_amount: '999000',
      ocufi_fee_lamports: '1000000',
      ocufi_fee_pct: 0.001,
      comparable_fee_pct: 0.01,
      savings_lamports: '9000000',
      mev_protected: true,
      slippage_tolerance_bps: 100,
      slippage_actual_bps: 30,
      jupiter_route_dexes: ['Raydium'],
      price_impact_pct: 0.1,
    });
  });
});

describe('常量导出', () => {
  it('TRANSPARENCY_COMPARABLE_FEE_PCT_DEFAULT === 0.01(BullX 1%)', () => {
    expect(TRANSPARENCY_COMPARABLE_FEE_PCT_DEFAULT).toBe(0.01);
  });
});

/**
 * P3-CHAIN-2 · 0 amount guard(2026-05-05 用户暴怒 · 卖 100% 后回收 ATA 空 swap 污染)
 *
 * 链上侧先拦 · 后端 P3-BE-3 是第二层防御 · 双层守护 transparency_reports 表
 */
describe('reportTransparency · 0 amount guard(P3-CHAIN-2)', () => {
  const VALID_PAYLOAD: TransparencyPayload = {
    sig: '5sv1jdRjQSu4iqwn8VmpzAEqGfWX6jbVN8ahMrU4ASjyDhPpRyFMqHkVHnGzsm56NaHv7XjAxc1Y6Q',
    wallet: 'AVmAj5Q7gZP3VXkCvY4nW8YpQ3JhFc6PqU3xRzKn2UCGB',
    slot: 12345,
    side: 'buy',
    token_in_mint: SOL,
    token_in_symbol: 'SOL',
    token_in_amount: '1000000000',
    token_in_decimals: 9,
    token_out_mint: USDC,
    token_out_symbol: 'EPjF',
    token_out_amount: '999000',
    token_out_decimals: 6,
    ocufi_fee_lamports: '1000000',
    ocufi_fee_pct: 0.001,
    comparable_fee_pct: 0.01,
    savings_lamports: '9000000',
    savings_usd: null,
    gas_lamports: '5000',
    compute_units: 200_000,
    slippage_tolerance_bps: 100,
    slippage_actual_bps: 30,
    mev_protected: true,
    mev_bundle_id: null,
    jupiter_route_dexes: ['Raydium'],
    jupiter_route_steps: [],
    price_impact_pct: 0.1,
    price_usd_at_swap: null,
  };

  it('token_in_amount=0 → 返 false · console.warn skip · 不打 apiFetch', async () => {
    mockState.response = 'ok'; // 即便后端能接也不该调
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const ok = await reportTransparency({ ...VALID_PAYLOAD, token_in_amount: '0' });
    expect(ok).toBe(false);
    expect(mockState.lastCall).toBeNull();
    expect(warnSpy.mock.calls[0][0]).toMatch(/0 amount/i);
  });

  it('token_out_amount=0 → 返 false · console.warn skip', async () => {
    mockState.response = 'ok';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const ok = await reportTransparency({ ...VALID_PAYLOAD, token_out_amount: '0' });
    expect(ok).toBe(false);
    expect(mockState.lastCall).toBeNull();
    expect(warnSpy.mock.calls[0][0]).toMatch(/0 amount/i);
  });

  it('两个 amount 都 0 → 返 false · skip', async () => {
    mockState.response = 'ok';
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const ok = await reportTransparency({
      ...VALID_PAYLOAD,
      token_in_amount: '0',
      token_out_amount: '0',
    });
    expect(ok).toBe(false);
    expect(mockState.lastCall).toBeNull();
  });

  it('字段非数字字符串(error 解析)→ 返 false · console.warn invalid', async () => {
    mockState.response = 'ok';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const ok = await reportTransparency({
      ...VALID_PAYLOAD,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      token_in_amount: 'not-a-number' as any,
    });
    expect(ok).toBe(false);
    expect(mockState.lastCall).toBeNull();
    expect(warnSpy.mock.calls[0][0]).toMatch(/invalid amount/i);
  });

  it('合法 amount(>0)→ 不被 guard 拦 · 真打 apiFetch', async () => {
    mockState.response = 'ok';
    const ok = await reportTransparency(VALID_PAYLOAD);
    expect(ok).toBe(true);
    expect(mockState.lastCall?.path).toBe('/transparency/report');
  });
});
