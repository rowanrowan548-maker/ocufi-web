import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchOhlc, type OhlcCandle } from '@/lib/ohlc';

/**
 * T-504a fetchOhlc · BUG-026 实证 + 时间戳归一 + 严格递增去重
 * T-700b:数据源从直击 GT 改成走后端代理 `/chart/ohlc`,响应格式扁平化
 *   旧: { data: { attributes: { ohlcv_list: [...] } } }
 *   新: { ok: true, ohlcv_list: [...], cached: bool, fetched_at: number }
 *   错: { ok: false, error: 'rate_limit' | 'upstream_5xx' | ... }
 *
 * ohlc.ts 把 parsing 逻辑封在 fetchOhlc 内部(没单独 export normalizeTime / parseOhlcv),
 * 只能 mock 全局 fetch 端到端测。
 *
 * 模块级 `cache` Map 跨测试可能污染,每个测试用 unique pool/tf/limit 三元组绕开。
 *
 * vitest 在 vitest.config 已设 NEXT_PUBLIC_API_URL,fetchOhlc 才会走后端路径(否则直接返 [])。
 */

interface OhlcvRow {
  // [timestamp, open, high, low, close, volume]
  0: number | string | null | undefined;
  1: number | string | null | undefined;
  2: number | string | null | undefined;
  3: number | string | null | undefined;
  4: number | string | null | undefined;
  5: number | string | null | undefined;
}

function mockBackendResponse(rows: Array<unknown[]>): Response {
  return {
    ok: true,
    json: async () => ({ ok: true, ohlcv_list: rows, cached: false, fetched_at: 1700000000 }),
  } as unknown as Response;
}

function mockBackendError(error: string): Response {
  return {
    ok: true, // 后端契约:HTTP 一律 200,错误走 ok:false
    json: async () => ({ ok: false, error }),
  } as unknown as Response;
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  // 没设 NEXT_PUBLIC_API_URL 时 fetchOhlc 直接返 [],测试场景需要任意值激活后端路径
  if (!process.env.NEXT_PUBLIC_API_URL) {
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000';
  }
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fetchOhlc · 时间戳归一(seconds vs ms)', () => {
  it('seconds 时间戳(< 1e12)→ 直接保留', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockBackendResponse([
        [1700000000, 1, 1.1, 0.9, 1.05, 100],
      ]),
    );
    const c = await fetchOhlc('mint-time-sec', 'minute_1', 100);
    expect(c).toHaveLength(1);
    expect(c[0].time).toBe(1700000000);
  });

  it('ms 时间戳(> 1e12)→ 自动除 1000 转 seconds', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockBackendResponse([
        [1700000000123, 1, 1.1, 0.9, 1.05, 100],
      ]),
    );
    const c = await fetchOhlc('mint-time-ms', 'minute_1', 100);
    expect(c).toHaveLength(1);
    expect(c[0].time).toBe(1700000000); // floor(1700000000123 / 1000)
  });

  it('time = 0 / 负值 / 非数 → 跳过该 candle', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockBackendResponse([
        [0, 1, 1, 1, 1, 100],
        [-1, 1, 1, 1, 1, 100],
        ['abc', 1, 1, 1, 1, 100],
        [null, 1, 1, 1, 1, 100],
        [1700000300, 1, 1.1, 0.9, 1.05, 100], // 唯一合法
      ]),
    );
    const c = await fetchOhlc('mint-time-bad', 'minute_1', 100);
    expect(c).toHaveLength(1);
    expect(c[0].time).toBe(1700000300);
  });
});

describe('fetchOhlc · BUG-026 NaN 过滤(实证当前行为)', () => {
  it('open 是 NaN(非数字符串)→ 跳过 candle ✅(已实现)', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockBackendResponse([
        [1700001000, 'NaN-open', 1.1, 0.9, 1.05, 100],
        [1700001060, 1, 1.1, 0.9, 1.05, 100], // 合法
      ]),
    );
    const c = await fetchOhlc('mint-bug26-open', 'minute_1', 100);
    expect(c).toHaveLength(1);
    expect(c[0].time).toBe(1700001060);
  });

  it('close 是 null → 当前 NOT 跳过(Number(null)=0 通过 isFinite,真 bug · BUG-026 加强)', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockBackendResponse([
        [1700002000, 1, 1.1, 0.9, null, 100],
        [1700002060, 1, 1.1, 0.9, 1.05, 100],
      ]),
    );
    const c = await fetchOhlc('mint-bug26-close', 'minute_1', 100);
    // 锁定当前 broken 行为:Number(null) = 0 → isFinite(0) = true → 不跳
    // 期望(BUG-026 修后):c.length === 1,只保留 1700002060
    expect(c).toHaveLength(2);
    expect(c[0].close).toBe(0); // null 被强转 0
  });

  it('close 是字符串 "abc" → 跳过 ✅(NaN 被 isFinite 挡住)', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockBackendResponse([
        [1700002500, 1, 1.1, 0.9, 'abc', 100],
        [1700002560, 1, 1.1, 0.9, 1.05, 100],
      ]),
    );
    const c = await fetchOhlc('mint-bug26-close-str', 'minute_1', 100);
    expect(c).toHaveLength(1);
    expect(c[0].time).toBe(1700002560);
  });

  // BUG-026 已修(ohlc.ts:134-144):high/low/open/close 任一非 finite -> drop
  it('high 是 "abc"(NaN)→ candle 被 drop ✅(BUG-026 已修)', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockBackendResponse([
        [1700003000, 1, 'abc', 0.9, 1.05, 100],
        [1700003060, 1, 1.1, 0.9, 1.05, 100], // 合法
      ]),
    );
    const c = await fetchOhlc('mint-bug26-high', 'minute_1', 100);
    expect(c).toHaveLength(1);
    expect(c[0].time).toBe(1700003060);
  });

  it('low 是 Infinity → candle 被 drop ✅(BUG-026 已修)', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockBackendResponse([
        [1700004000, 1, 1.1, Infinity, 1.05, 100],
        [1700004060, 1, 1.1, 0.9, 1.05, 100], // 合法
      ]),
    );
    const c = await fetchOhlc('mint-bug26-low', 'minute_1', 100);
    expect(c).toHaveLength(1);
    expect(c[0].time).toBe(1700004060);
  });

  it('volume 非数 → fallback 到 0 ✅(已实现)', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockBackendResponse([
        [1700005000, 1, 1.1, 0.9, 1.05, 'xyz'],
      ]),
    );
    const c = await fetchOhlc('mint-bug26-vol', 'minute_1', 100);
    expect(c).toHaveLength(1);
    expect(c[0].volume).toBe(0);
  });
});

describe('fetchOhlc · 严格递增去重 + 排序', () => {
  it('GT 倒序(desc)返回 → 输出按时间 asc', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockBackendResponse([
        [1700100200, 1, 1, 1, 1, 100], // 新
        [1700100100, 1, 1, 1, 1, 100],
        [1700100000, 1, 1, 1, 1, 100], // 旧
      ]),
    );
    const c = await fetchOhlc('mint-sort', 'minute_1', 100);
    expect(c).toHaveLength(3);
    expect(c[0].time).toBe(1700100000);
    expect(c[1].time).toBe(1700100100);
    expect(c[2].time).toBe(1700100200);
  });

  it('同时间戳重复 → 只保留第一条(避免 lightweight-charts assertion)', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockBackendResponse([
        [1700200000, 1, 1, 1, 1.0, 100],
        [1700200000, 1, 1, 1, 2.0, 200], // 同 time,close/volume 不同
        [1700200060, 1, 1, 1, 3.0, 300],
      ]),
    );
    const c = await fetchOhlc('mint-dedup', 'minute_1', 100);
    expect(c).toHaveLength(2);
    expect(c[0].time).toBe(1700200000);
    // 第一条 close 取 1.0(锁定 dedup 用 first-wins 而非 last-wins · 见 ohlc.ts:142-147)
    expect(c[0].close).toBe(1.0);
    expect(c[1].time).toBe(1700200060);
  });

  it('行长度不足 6 → 跳过', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockBackendResponse([
        [1700300000, 1, 1, 1] as unknown as OhlcvRow, // 只有 4 列
        [1700300060, 1, 1, 1, 1, 100],
      ]),
    );
    const c = await fetchOhlc('mint-short', 'minute_1', 100);
    expect(c).toHaveLength(1);
    expect(c[0].time).toBe(1700300060);
  });
});

describe('fetchOhlc · 网络失败 stale-while-error', () => {
  it('fetch reject → 返回 [](无旧缓存时)', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network'));
    const c = await fetchOhlc('mint-net-fail-fresh', 'minute_1', 100);
    expect(c).toEqual<OhlcCandle[]>([]);
  });

  it('HTTP 500 → 返回 [](无旧缓存时)', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'oops',
    } as unknown as Response);
    const c = await fetchOhlc('mint-http-500', 'minute_1', 100);
    expect(c).toEqual<OhlcCandle[]>([]);
  });
});

describe('fetchOhlc · T-700b 后端代理 ok=false 降级', () => {
  it('后端返 { ok: false, error: "rate_limit" } → 返回 []', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockBackendError('rate_limit'));
    const c = await fetchOhlc('mint-rate-limit', 'minute_1', 100);
    expect(c).toEqual<OhlcCandle[]>([]);
  });

  it('后端返 { ok: false, error: "upstream_5xx" } → 返回 []', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockBackendError('upstream_5xx'));
    const c = await fetchOhlc('mint-upstream-5xx', 'minute_1', 100);
    expect(c).toEqual<OhlcCandle[]>([]);
  });

  it('后端返 { ok: false, error: "no_pool" } → 返回 [](T-700b-fix:无 LP token)', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockBackendError('no_pool'));
    const c = await fetchOhlc('mint-no-pool', 'minute_1', 100);
    expect(c).toEqual<OhlcCandle[]>([]);
  });

  it('后端返 { ok: true } 但缺 ohlcv_list → 返回 [](防御性,后端契约外)', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as unknown as Response);
    const c = await fetchOhlc('mint-no-list', 'minute_1', 100);
    expect(c).toEqual<OhlcCandle[]>([]);
  });

  it('请求 URL 走 NEXT_PUBLIC_API_URL/chart/ohlc?mint=...(T-700b-fix:不再传 pool)', async () => {
    const fetchMock = (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockBackendResponse([[1700700000, 1, 1, 1, 1, 100]]),
    );
    await fetchOhlc('mint-url-check', 'hour_4', 50);
    expect(fetchMock).toHaveBeenCalledOnce();
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain('/chart/ohlc');
    expect(calledUrl).toContain('mint=mint-url-check');
    expect(calledUrl).not.toContain('pool=');
    expect(calledUrl).toContain('tf=hour_4');
    expect(calledUrl).toContain('limit=50');
    expect(calledUrl).not.toContain('api.geckoterminal.com');
  });
});
