import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * T-FE-PERF-V2-PREFETCH · prefetch helper 单测
 *
 * 验:
 *   - 同 mint 1.5s 内只 fire 1 次(节流防 hover 抖动)
 *   - 不同 mint 各自独立计时
 *   - 1.5s 后再 hover · 重新 fire
 *   - 没 mint / API 没配 · 不 fire(早返)
 */

vi.mock('@/lib/api-client', () => ({
  fetchPrice: vi.fn(() => Promise.resolve({})),
  fetchTokenAuditCard: vi.fn(() => Promise.resolve({})),
  isApiConfigured: vi.fn(() => true),
}));
vi.mock('@/lib/portfolio', () => ({
  fetchTokenInfo: vi.fn(() => Promise.resolve(null)),
}));

import { prefetchTokenForTrade, _resetPrefetchThrottle } from '@/lib/prefetch';
import { fetchPrice, fetchTokenAuditCard, isApiConfigured } from '@/lib/api-client';
import { fetchTokenInfo } from '@/lib/portfolio';

const mockedPrice = vi.mocked(fetchPrice);
const mockedAudit = vi.mocked(fetchTokenAuditCard);
const mockedInfo = vi.mocked(fetchTokenInfo);
const mockedConfigured = vi.mocked(isApiConfigured);

describe('prefetchTokenForTrade · 节流 + 并发', () => {
  beforeEach(() => {
    _resetPrefetchThrottle();
    mockedPrice.mockClear();
    mockedAudit.mockClear();
    mockedInfo.mockClear();
    mockedConfigured.mockReturnValue(true);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('首次调用 · 三个 fetcher 各 1 次', () => {
    prefetchTokenForTrade('TokenA');
    expect(mockedPrice).toHaveBeenCalledTimes(1);
    expect(mockedAudit).toHaveBeenCalledTimes(1);
    expect(mockedInfo).toHaveBeenCalledTimes(1);
    expect(mockedPrice).toHaveBeenCalledWith('TokenA');
  });

  it('同 mint 1.5s 内重复调 · 只触发 1 次', () => {
    vi.useFakeTimers();
    prefetchTokenForTrade('TokenA');
    prefetchTokenForTrade('TokenA');
    prefetchTokenForTrade('TokenA');
    expect(mockedPrice).toHaveBeenCalledTimes(1);
    expect(mockedAudit).toHaveBeenCalledTimes(1);

    // 1499ms 后还在节流窗口 · 不再发
    vi.advanceTimersByTime(1499);
    prefetchTokenForTrade('TokenA');
    expect(mockedPrice).toHaveBeenCalledTimes(1);

    // 1501ms 总共 → 过节流窗口 · 重新发
    vi.advanceTimersByTime(2);
    prefetchTokenForTrade('TokenA');
    expect(mockedPrice).toHaveBeenCalledTimes(2);
  });

  it('不同 mint 各自独立 · 不互相节流', () => {
    prefetchTokenForTrade('TokenA');
    prefetchTokenForTrade('TokenB');
    prefetchTokenForTrade('TokenC');
    expect(mockedPrice).toHaveBeenCalledTimes(3);
    expect(mockedPrice).toHaveBeenNthCalledWith(1, 'TokenA');
    expect(mockedPrice).toHaveBeenNthCalledWith(2, 'TokenB');
    expect(mockedPrice).toHaveBeenNthCalledWith(3, 'TokenC');
  });

  it('mint 空 → 不 fire', () => {
    prefetchTokenForTrade('');
    expect(mockedPrice).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it('API 没配 → 不 fire(防 backend 缺时一直试)', () => {
    mockedConfigured.mockReturnValue(false);
    prefetchTokenForTrade('TokenA');
    expect(mockedPrice).not.toHaveBeenCalled();
  });

  it('fetcher 抛错 · prefetch 自身不抛(fire-and-forget)', async () => {
    mockedPrice.mockRejectedValueOnce(new Error('boom'));
    mockedAudit.mockRejectedValueOnce(new Error('boom2'));
    expect(() => prefetchTokenForTrade('TokenA')).not.toThrow();
    // microtask flush · 让 unhandled rejection 不发生
    await Promise.resolve();
    await Promise.resolve();
  });
});
