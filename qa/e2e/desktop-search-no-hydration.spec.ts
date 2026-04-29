import { test, expect } from '@playwright/test';

// T-SEARCH-CLICK-FIX5 验证 · prod build only(dev mode 抑制 hydration warning)
// - 强刷 trade?mint=SOL · 不等再点(模拟用户快速操作)
// - 首次 click 就 navigate(URL 真换)
// - 0 条 React #418 / Hydration mismatch / Minified React error
// - 0 条 pageerror
test.describe('desktop search · 0 hydration errors + first-click navigates', () => {
  test.setTimeout(120_000);
  test('first click on search result navigates · no hydration errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/trade?mint=So11111111111111111111111111111111111111112', {
      waitUntil: 'domcontentloaded',
    });

    // 不等 networkidle · 等 trade-screen mount(派生 mint 反应式渲染)
    await page.waitForTimeout(2000);

    // 触发搜索 modal · 用 keydown / 全局 "/"
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
    });
    await page.waitForTimeout(800);

    // 输入查询(SOL → 远端 DexScreener)
    await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[placeholder*="DApp"]')) as HTMLInputElement[];
      const el = inputs.find((e) => e.offsetParent !== null) ?? inputs[0];
      if (!el) throw new Error('input not found');
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set?.call(el, 'BONK');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // 等 modal 出现 BONK row
    await page.waitForFunction(
      () => {
        const modal = document.querySelector('div.fixed.inset-0.z-\\[80\\]');
        return !!modal && (modal.textContent?.toLowerCase() ?? '').includes('bonk');
      },
      undefined,
      { timeout: 20_000 },
    );

    // 第一次点击
    const urlBefore = page.url();
    await page.evaluate(() => {
      const modal = document.querySelector('div.fixed.inset-0.z-\\[80\\]');
      const row = modal?.querySelector('button:has(span.tabular-nums)') as HTMLButtonElement | null;
      if (row) row.click();
    });

    // 第一次 click 必须真跳 · mint 真换
    await page.waitForFunction(
      (initialUrl) => {
        const cur = new URL(location.href).searchParams.get('mint');
        return cur !== null && cur !== '' && location.href !== initialUrl;
      },
      urlBefore,
      { timeout: 10_000 },
    );

    // 0 hydration error 断言
    const hydrationErrors = [...consoleErrors, ...pageErrors].filter((e) =>
      /Minified React error #418|Hydration failed|hydration mismatch|Hydration mismatch/i.test(e),
    );
    expect(
      hydrationErrors,
      `expected 0 hydration errors · got ${hydrationErrors.length}:\n${hydrationErrors.join('\n')}`,
    ).toEqual([]);
  });
});
