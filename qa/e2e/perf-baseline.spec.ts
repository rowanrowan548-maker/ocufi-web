import { test, expect, type Page } from '@playwright/test';
import { tradeUrl, MINTS, PREVIEW_KEY } from './_helpers';

/**
 * T-QA-PERF-V2-BENCHMARK · 阶段 2 性能基线
 *
 * 验 🅱️ T-FE-PERF-V2-PREFETCH (`11da553`) + 🗄️ T-BE-PERF-V2-WARM-CACHE
 * (`b06bf4a`) ship 后的真机数字。三页 / 三指标:
 *
 *   - /trade /markets /history 三页 LCP(目标 < 1.5s)
 *   - /trade /markets /history 三页 TBT(目标 < 200ms)
 *   - /trade SOL → USDC 切币种(目标 < 800ms)
 *
 * 数字直接收集到 stdout · 这个 spec **不主动 fail**(除非 page crash)·
 * 让 spec runner 顺利完整跑完 · 所有数字会再被 perf-stage2.md report 摘录。
 *
 * 测两轮:cold(首次 visit · 后端缓存可能没命中)+ warm(第二次 visit ·
 * warm-cache 应该已经预热)· 都打到 stdout。
 */

const RUNS = 2;
const SETTLE_MS = 3_500; // 给 LCP 落定 + 后端 warm cache 可能的 SWR 刷新

interface PerfNumbers {
  page: string;
  url: string;
  run: 'cold' | 'warm';
  lcp_ms: number | null;
  tbt_ms: number;
  fcp_ms: number | null;
  domContentLoaded_ms: number | null;
}

// Run BEFORE any page script: register PerformanceObservers so LCP / longtask
// entries actually get captured. Without this, getEntriesByType returns [].
const INIT_SCRIPT = `
  window.__perf = { lcp: 0, tbt: 0, longtaskCount: 0 };
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // last LCP candidate wins
        window.__perf.lcp = entry.startTime;
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (_) { /* not supported */ }
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__perf.tbt += Math.max(0, entry.duration - 50);
        window.__perf.longtaskCount += 1;
      }
    }).observe({ type: 'longtask', buffered: true });
  } catch (_) { /* not supported */ }
`;

async function measurePagePerf(page: Page, url: string, label: 'cold' | 'warm', name: string): Promise<PerfNumbers> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(SETTLE_MS);

  const m = await page.evaluate(() => {
    function num(v: unknown) {
      return typeof v === 'number' && Number.isFinite(v) ? v : null;
    }
    const w = window as unknown as { __perf?: { lcp: number; tbt: number; longtaskCount: number } };
    const perf = w.__perf;
    const lcp = perf && perf.lcp > 0 ? perf.lcp : null;
    const tbt = perf ? perf.tbt : 0;

    const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
    const fcp = fcpEntry ? fcpEntry.startTime : null;

    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const dcl = nav ? nav.domContentLoadedEventEnd - nav.startTime : null;

    return { lcp: num(lcp), fcp: num(fcp), tbt, dcl: num(dcl) };
  });

  return {
    page: name,
    url,
    run: label,
    lcp_ms: m.lcp,
    tbt_ms: Math.round(m.tbt),
    fcp_ms: m.fcp,
    domContentLoaded_ms: m.dcl,
  };
}

test.describe('perf baseline · 阶段 2 · LCP/TBT/切币', () => {
  test.setTimeout(120_000);
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(INIT_SCRIPT);
  });

  for (const target of [
    { name: '/trade SOL', url: tradeUrl('SOL') },
    { name: '/markets', url: `/markets?preview=${PREVIEW_KEY}` },
    { name: '/history', url: `/history?preview=${PREVIEW_KEY}` },
  ]) {
    test(`LCP/TBT · ${target.name}`, async ({ page }) => {
      const results: PerfNumbers[] = [];
      for (let i = 0; i < RUNS; i++) {
        const label: 'cold' | 'warm' = i === 0 ? 'cold' : 'warm';
        const numbers = await measurePagePerf(page, target.url, label, target.name);
        results.push(numbers);
        // eslint-disable-next-line no-console
        console.log(`[perf] ${JSON.stringify(numbers)}`);
      }

      // 不主动 fail · 报告里再判断目标 · 但页面整体得 render
      const last = results[results.length - 1];
      expect(last.domContentLoaded_ms, '页面 DCL 没拿到 · 大概率没 render').toBeGreaterThan(0);
    });
  }

  test('切币种 · /trade SOL → USDC < 800ms 目标', async ({ page }) => {
    await page.goto(tradeUrl('SOL'), { waitUntil: 'domcontentloaded' });
    // 等 mint render 稳定
    await page.waitForTimeout(2_500);

    // 触发搜索 modal · 输入 USDC · 点首行
    const switches: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      const label = i === 0 ? 'cold' : 'warm';
      const start = Date.now();

      await page.evaluate(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
      });
      await page.waitForTimeout(500);

      await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input[placeholder*="DApp"]')) as HTMLInputElement[];
        const el = inputs.find((e) => e.offsetParent !== null) ?? inputs[0];
        if (!el) throw new Error('search input not found');
        Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set?.call(el, 'USDC');
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // 等 USDC 出现在 modal · 点首行
      await page.waitForFunction(
        () => {
          const modal = document.querySelector('div.fixed.inset-0.z-\\[80\\]');
          return !!modal && (modal.textContent?.toLowerCase() ?? '').includes('usdc');
        },
        undefined,
        { timeout: 10_000 },
      );

      await page.evaluate(() => {
        const modal = document.querySelector('div.fixed.inset-0.z-\\[80\\]');
        const row = modal?.querySelector('button:has(span.tabular-nums)') as HTMLButtonElement | null;
        if (row) row.click();
      });

      // 等 URL 真换 mint
      await page.waitForFunction(
        (initial) => {
          const cur = new URL(location.href).searchParams.get('mint');
          return !!cur && cur !== initial;
        },
        MINTS.SOL,
        { timeout: 10_000 },
      );

      const elapsed = Date.now() - start;
      switches.push(elapsed);
      // eslint-disable-next-line no-console
      console.log(`[perf] {"page":"/trade switch","run":"${label}","switch_ms":${elapsed}}`);

      // reset 回 SOL 准备下一轮
      await page.goto(tradeUrl('SOL'), { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2_500);
    }

    // 整体 sanity · 至少触发了 RUNS 次成功切换
    expect(switches.length).toBe(RUNS);
    expect(switches.every((t) => t > 0)).toBe(true);
  });
});
