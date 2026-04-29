import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchOhlcvBirdeye } from '@/lib/birdeye-client';

/**
 * T-CHAIN-BIRDEYE-OHLCV-LIB · birdeye-client 6 case
 *
 * 重点:
 *   - URL 含 `source=birdeye` query(后端将来 ship 此 query 即强制走 Birdeye)
 *   - 后端不支持 query 时忽略走默认 · 行为同 fetchOhlc(mint, tf, limit)
 *   - 字段格式跟现有 OhlcCandle type 完全兼容(thin wrapper 透传)
 *   - 失败 / mint 缺 / 后端 ok:false 行为同 fetchOhlc · stale-while-error / [] 兜底
 */

function mockBackendResponse(rows: Array<unknown[]>): Response {
  return {
    ok: true,
    json: async () => ({ ok: true, ohlcv_list: rows, cached: false, fetched_at: 1700000000 }),
  } as unknown as Response;
}

function mockBackendError(error: string): Response {
  return {
    ok: true,
    json: async () => ({ ok: false, error }),
  } as unknown as Response;
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  if (!process.env.NEXT_PUBLIC_API_URL) {
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000';
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fetchOhlcvBirdeye · URL 含 source=birdeye query', () => {
  it('调用方 URL 必含 source=birdeye(让后端强制走 Birdeye)', async () => {
    const fetchMock = (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockBackendResponse([[1700700000, 1, 1, 1, 1, 100]])
    );
    await fetchOhlcvBirdeye('mint-bd-source', 'hour_4', 50);
    expect(fetchMock).toHaveBeenCalledOnce();
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain('/chart/ohlc');
    expect(calledUrl).toContain('mint=mint-bd-source');
    expect(calledUrl).toContain('tf=hour_4');
    expect(calledUrl).toContain('limit=50');
    expect(calledUrl).toContain('source=birdeye');
    expect(calledUrl).not.toContain('api.geckoterminal.com');
  });
});

describe('fetchOhlcvBirdeye · 数据透传(字段格式同 fetchOhlc)', () => {
  it('正常 candle 数组 → 转 OhlcCandle[] · time 升序', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockBackendResponse([
        [1700100200, 1, 1.1, 0.9, 1.05, 100],
        [1700100100, 1, 1, 1, 1, 50],
        [1700100000, 0.5, 0.8, 0.4, 0.7, 200],
      ])
    );
    const c = await fetchOhlcvBirdeye('mint-bd-data', 'minute_5', 100);
    expect(c).toHaveLength(3);
    expect(c[0].time).toBe(1700100000); // asc
    expect(c[1].time).toBe(1700100100);
    expect(c[2].time).toBe(1700100200);
    expect(c[2].open).toBe(1);
    expect(c[2].close).toBe(1.05);
    expect(c[2].volume).toBe(100);
  });
});

describe('fetchOhlcvBirdeye · 边界 / 失败兜底', () => {
  it('mint 为空 → 返 []', async () => {
    const fetchMock = (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockBackendResponse([])
    );
    const c = await fetchOhlcvBirdeye('', 'hour_4', 100);
    expect(c).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled(); // 短路不打 RPC
  });

  it('后端返 ok:false rate_limit → 返 []', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockBackendError('rate_limit'));
    const c = await fetchOhlcvBirdeye('mint-bd-rl', 'minute_1', 100);
    expect(c).toEqual([]);
  });

  it('网络错 → 返 [](无旧缓存时)', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network'));
    const c = await fetchOhlcvBirdeye('mint-bd-net', 'minute_1', 100);
    expect(c).toEqual([]);
  });
});

describe('fetchOhlcvBirdeye · cache 跟 fetchOhlc auto 独立(不同 source 不共享)', () => {
  it('birdeye 跟 auto 用不同 cache key · 不互相污染', async () => {
    const { fetchOhlc } = await import('@/lib/ohlc');
    const fetchMock = (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockBackendResponse([[1700300000, 5, 5, 5, 5, 1000]])) // auto
      .mockResolvedValueOnce(mockBackendResponse([[1700300060, 9, 9, 9, 9, 2000]])); // birdeye

    // 同一 mint+tf+limit · 但不同 source · 两次都打 RPC(各自独立 cache)
    const cAuto = await fetchOhlc('mint-bd-cache', 'minute_15', 50);
    const cBirdeye = await fetchOhlcvBirdeye('mint-bd-cache', 'minute_15', 50);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cAuto[0].time).toBe(1700300000); // auto 数据
    expect(cBirdeye[0].time).toBe(1700300060); // birdeye 数据(独立 cache)

    // 验证 URL 区分:第 1 次无 source query,第 2 次含 source=birdeye
    const url1 = String(fetchMock.mock.calls[0][0]);
    const url2 = String(fetchMock.mock.calls[1][0]);
    expect(url1).not.toContain('source=');
    expect(url2).toContain('source=birdeye');
  });
});
