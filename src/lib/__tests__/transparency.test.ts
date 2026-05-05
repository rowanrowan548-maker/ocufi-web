/**
 * V2 P3-FE-1 · transparency lib 测
 * 测:rawToDecimal / lamportsToSol / mapReportToView 字段映射 · getTransparencyReport 错误吞掉
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ApiError } from '../api-client';
import * as apiClient from '../api-client';
import {
  rawToDecimal,
  lamportsToSol,
  mapReportToView,
  getTransparencyReport,
  type TransparencyReport,
} from '../transparency';

const baseReport: TransparencyReport = {
  sig: '5fXq8yAbcDEFghijklmn1234567890ABCdefghi',
  wallet: '7w4SHxYz1234567890aBcDeFgHiJkLmNoPqRsTuVwXg4wM',
  slot: 287_432_118,
  side: 'buy',
  token_in_mint: 'So11111111111111111111111111111111111111112',
  token_in_symbol: 'SOL',
  token_in_amount: '500000000', // 0.5 SOL raw lamports
  token_in_decimals: 9,
  token_out_mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  token_out_symbol: 'BONK',
  token_out_amount: '123456700000', // 1234567 with 5 decimals
  token_out_decimals: 5,
  ocufi_fee_lamports: '500000', // 0.0005 SOL
  ocufi_fee_pct: 0.001,
  comparable_fee_pct: 0.01,
  savings_lamports: '4500000', // 0.0045 SOL
  savings_usd: 0.9,
  gas_lamports: '54000', // 0.000054 SOL
  compute_units: 200000,
  slippage_tolerance_bps: 100,
  slippage_actual_bps: 32,
  mev_protected: true,
  mev_bundle_id: 'bundle_abc',
  jupiter_route_dexes: ['Raydium', 'Meteora'],
  jupiter_route_steps: [{ amm: 'Raydium' }, { amm: 'Meteora' }],
  price_impact_pct: 0.1,
  price_usd_at_swap: 0.000121,
  created_at: '2026-05-08T14:23:45.000Z',
  wallet_anonymized: '7w4S...g4wM',
  notional_sol: 0.5,
  savings_pct: 0.9, // (0.01 - 0.001) * 100
  route_dexes_str: 'Raydium → Meteora',
};

describe('rawToDecimal', () => {
  it('SOL lamports (decimals 9) → SOL float', () => {
    expect(rawToDecimal('500000000', 9)).toBe(0.5);
  });

  it('decimals 0 = identity', () => {
    expect(rawToDecimal('1234', 0)).toBe(1234);
  });

  it('empty raw = 0', () => {
    expect(rawToDecimal('', 9)).toBe(0);
  });

  it('BONK 5 decimals', () => {
    expect(rawToDecimal('123456700000', 5)).toBe(1234567);
  });
});

describe('lamportsToSol', () => {
  it('0.5 SOL', () => {
    expect(lamportsToSol('500000000')).toBe(0.5);
  });

  it('0.0045 SOL', () => {
    expect(lamportsToSol('4500000')).toBe(0.0045);
  });
});

describe('mapReportToView', () => {
  it('saves are mapped correctly', () => {
    const v = mapReportToView(baseReport);
    expect(v.savedSol).toBeCloseTo(0.0045, 6);
    expect(v.savedUsd).toBe(0.9);
    expect(v.feeSol).toBeCloseTo(0.0005, 6);
    expect(v.gasSol).toBeCloseTo(0.000054, 6);
  });

  it('side determines verb / amount mapping', () => {
    const v = mapReportToView(baseReport);
    expect(v.side).toBe('buy');
    expect(v.tokenAmount).toBe(1_234_567);
    expect(v.tokenSymbol).toBe('BONK');
    expect(v.notionalSol).toBe(0.5);
  });

  it('vsCompetitorSol = notional + savings', () => {
    const v = mapReportToView(baseReport);
    expect(v.vsCompetitorSol).toBeCloseTo(0.5045, 6);
  });

  it('fee pct converted % (0.001 → 0.1)', () => {
    const v = mapReportToView(baseReport);
    expect(v.feePct).toBeCloseTo(0.1, 6);
    expect(v.competitorFeePct).toBeCloseTo(1, 6);
  });

  it('slippage bps → pct (32 → 0.32)', () => {
    const v = mapReportToView(baseReport);
    expect(v.slippagePct).toBeCloseTo(0.32, 6);
    expect(v.slippageTolerancePct).toBe(1);
  });

  it('slippage_actual_bps null → null pct', () => {
    const v = mapReportToView({ ...baseReport, slippage_actual_bps: null });
    expect(v.slippagePct).toBeNull();
  });

  it('routeStr from route_dexes_str', () => {
    const v = mapReportToView(baseReport);
    expect(v.routeStr).toBe('Raydium → Meteora');
  });

  it('routeStr fallback when null → "Jupiter"', () => {
    const v = mapReportToView({ ...baseReport, route_dexes_str: null });
    expect(v.routeStr).toBe('Jupiter');
  });

  it('timestamp formatted UTC', () => {
    const v = mapReportToView(baseReport);
    expect(v.timestamp).toBe('2026-05-08 · 14:23 UTC');
  });

  it('mev fields passthrough', () => {
    const v = mapReportToView(baseReport);
    expect(v.mevProtected).toBe(true);
    expect(v.mevBundleId).toBe('bundle_abc');
  });

  it('sigShort 6+4', () => {
    const v = mapReportToView(baseReport);
    expect(v.sigShort).toMatch(/^.{6}\.\.\..{4}$/);
  });
});

describe('getTransparencyReport', () => {
  // 直接 mock apiFetch · 不走 fetch + stubEnv(api-client.ts API_URL 是模块顶层 const · vi.stubEnv 来不及)
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const longSig = '5fXq8yAbcDEFghijklmn1234567890ABCdefghi';

  it('short sig → null(不调 apiFetch)', async () => {
    const spy = vi.spyOn(apiClient, 'apiFetch');
    const r = await getTransparencyReport('123');
    expect(r).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('404 → null (不抛)', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockRejectedValue(
      new ApiError({ status: 404, path: '/transparency/x', body: 'not_found', isNetwork: false })
    );
    const r = await getTransparencyReport(longSig);
    expect(r).toBeNull();
  });

  it('网络错(timeout / 配置缺)→ null', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockRejectedValue(
      new ApiError({ status: 0, path: '/transparency/x', body: 'timeout', isNetwork: true })
    );
    const r = await getTransparencyReport(longSig);
    expect(r).toBeNull();
  });

  it('解 wrapper · 200 + ok+data → 返 data 真 report', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue({
      ok: true,
      error: null,
      data: baseReport,
    });
    const r = await getTransparencyReport(longSig);
    expect(r).not.toBeNull();
    expect(r?.sig).toBe(baseReport.sig);
    expect(r?.token_out_symbol).toBe('BONK');
  });

  it('解 wrapper · 200 + ok=false → 返 null', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue({
      ok: false,
      error: 'not_found',
      data: null,
    });
    const r = await getTransparencyReport(longSig);
    expect(r).toBeNull();
  });

  it('解 wrapper · ok=true 但 data=null → 返 null(防御)', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue({
      ok: true,
      error: null,
      data: null,
    });
    const r = await getTransparencyReport(longSig);
    expect(r).toBeNull();
  });
});
