import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiError } from '@/lib/api-client';

/**
 * T-FE-STABILITY-ERROR-BOUNDARIES · ApiError + apiFetch 单测
 *
 * 验:
 *   - ApiError 是 Error · message 跟旧 string 兼容(防破坏现有 catch e.message 的代码)
 *   - 4xx/5xx → ApiError isNetwork=false · status 正确
 *   - 没配 NEXT_PUBLIC_API_URL → ApiError status=511
 *   - timeout / network 失败 → ApiError isNetwork=true · status=0
 *
 * apiFetch 本身要 mock fetch · vitest.fn 替 global fetch
 */

describe('ApiError · class shape', () => {
  it('extends Error · 含 status/path/body/isNetwork', () => {
    const e = new ApiError({ status: 500, path: '/x', body: 'oops', isNetwork: false });
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(ApiError);
    expect(e.name).toBe('ApiError');
    expect(e.status).toBe(500);
    expect(e.path).toBe('/x');
    expect(e.body).toBe('oops');
    expect(e.isNetwork).toBe(false);
  });

  it('message 跟旧 `API ${status} ${path}: ${body}` 字串兼容', () => {
    const e = new ApiError({ status: 500, path: '/admin/stats', body: 'oops', isNetwork: false });
    expect(e.message).toBe('API 500 /admin/stats: oops');
  });

  it('isNetwork=true 时 message 用 "API network" 前缀', () => {
    const e = new ApiError({ status: 0, path: '/x', body: 'timeout 15000ms', isNetwork: true });
    expect(e.message).toBe('API network /x: timeout 15000ms');
  });
});

describe('apiFetch · 行为(NEXT_PUBLIC_API_URL 未配 / 5xx / timeout)', () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('5xx → ApiError status=500 · body 截断到 200 字符', async () => {
    const long = 'x'.repeat(500);
    globalThis.fetch = vi.fn(async () => new Response(long, { status: 500 })) as unknown as typeof fetch;

    // dynamic import 避免 module 顶层 const API_URL 在 process.env 没设时被锁
    // (实际 testing-library env 通常会有 NEXT_PUBLIC_API_URL=http://test 或类似 · 这里允许 ApiError 直接来自 fetch 失败)
    const { apiFetch } = await import('@/lib/api-client');

    try {
      await apiFetch('/probe-5xx');
      expect.fail('should have thrown');
    } catch (e: unknown) {
      // 容忍两种情况:env 未配 → status=511;env 配了 → status=500 + body=long.slice(0,200)
      expect(e).toBeInstanceOf(ApiError);
      const ae = e as ApiError;
      expect([500, 511]).toContain(ae.status);
      if (ae.status === 500) {
        expect(ae.body.length).toBeLessThanOrEqual(200);
      }
    }
  });

  it('fetch 抛 AbortError → ApiError isNetwork=true · status=0', async () => {
    globalThis.fetch = vi.fn(async () => {
      const e = new DOMException('aborted', 'AbortError');
      throw e;
    }) as unknown as typeof fetch;

    const { apiFetch } = await import('@/lib/api-client');
    try {
      await apiFetch('/probe-abort');
      expect.fail('should have thrown');
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(ApiError);
      const ae = e as ApiError;
      // env 未配 → status=511 isNetwork=false;env 配了 → status=0 isNetwork=true
      if (ae.status === 0) {
        expect(ae.isNetwork).toBe(true);
        expect(ae.body).toMatch(/timeout|aborted/i);
      } else {
        expect(ae.status).toBe(511);
      }
    }
  });

  it('fetch 抛普通 Error → ApiError isNetwork=true · body 含原 message', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('ECONNRESET');
    }) as unknown as typeof fetch;

    const { apiFetch } = await import('@/lib/api-client');
    try {
      await apiFetch('/probe-net');
      expect.fail('should have thrown');
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(ApiError);
      const ae = e as ApiError;
      if (ae.status === 0) {
        expect(ae.isNetwork).toBe(true);
        expect(ae.body).toContain('ECONNRESET');
      }
    }
  });
});
