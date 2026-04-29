import { test, expect, type Page } from '@playwright/test';
import { tradeUrl, gotoAndSettle, MINTS } from './_helpers';

// dev server HMR 永不 networkidle · Playwright fill() 卡死 · 用原生 setter + input event
// 双 HeaderSearch 实例(桌面 + 移动)都 mount · 必须挑可见的那个
async function typeViaReact(page: Page, selector: string, value: string) {
  await page.evaluate(
    ({ selector, value }) => {
      const all = Array.from(document.querySelectorAll(selector)) as HTMLInputElement[];
      const el = all.find((e) => e.offsetParent !== null) ?? all[0];
      if (!el) throw new Error(`input not found: ${selector}`);
      const proto = Object.getPrototypeOf(el);
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      desc?.set?.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    },
    { selector, value },
  );
}

// T-SEARCH-CLICK-FIX4 真生效验证:第二次点击同样跳转,console log 出现 2 次
// 改 URL 派生 mint(单源)+ 删 router.refresh() 后 · 双向同步死锁解除
test.describe('header search modal · click navigation', () => {
  test.setTimeout(120_000);
  test('two consecutive result clicks both navigate + log fires twice', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'log') logs.push(msg.text());
    });

    await gotoAndSettle(page, tradeUrl('SOL'));
    const initialUrl = page.url();

    // Open search modal · evaluate 直接 dispatch 键盘事件(全局 "/" 快捷键监听)
    // dev server HMR 永不 networkidle · 任何 actionability check 都会卡死 · 必须走 evaluate
    const modalInput = page.locator('input[placeholder*="DApp"]:visible').first();
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
    });
    await expect(modalInput).toBeVisible({ timeout: 10_000 });

    // 第一次:输入 BONK · 等 DexScreener 远端结果 · 点首行
    // (本地 dev 没有 NEXT_PUBLIC_API_URL · trending 拉空 · 改用 typed-search 路径走 DexScreener public API)
    await typeViaReact(page, 'input[placeholder*="DApp"]', 'BONK');
    // 等 modal 内 BONK row 出现(modal 是 z-[80] fixed)
    await page.waitForFunction(
      () => {
        const modal = document.querySelector('div.fixed.inset-0.z-\\[80\\]');
        return !!modal && (modal.textContent?.toLowerCase() ?? '').includes('bonk');
      },
      undefined,
      { timeout: 20_000 },
    );
    const bonkRow = page.locator('div.fixed.inset-0.z-\\[80\\] button:visible:has(span.tabular-nums)').first();
    await bonkRow.dispatchEvent('click');

    // Modal closes + URL navigates · 等 mint 真换(初始是 SOL · 不能匹配 SOL)
    await expect(modalInput).toBeHidden({ timeout: 5_000 });
    await page.waitForFunction(
      (prev) => location.href !== prev && location.search.includes('mint='),
      initialUrl,
      { timeout: 10_000 },
    );
    const urlAfterFirst = page.url();
    const mintAfterFirst = new URL(urlAfterFirst).searchParams.get('mint');
    expect(mintAfterFirst, 'first click writes new mint').toBeTruthy();
    expect(mintAfterFirst, 'first mint must differ from SOL').not.toBe(MINTS.SOL);

    // 第二次:再开 modal · 输入 WIF · 点首行 · mint 必须真换
    // 等 navigation 全部 commit · 再发键盘事件(否则 evaluate 抛 context destroyed)
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
    });
    await expect(modalInput).toBeVisible({ timeout: 10_000 });
    await typeViaReact(page, 'input[placeholder*="DApp"]', 'WIF');
    // 等 modal 内 WIF row 出现 · 350ms 防抖 + DexScreener 慢
    await page.waitForFunction(
      () => {
        const modal = document.querySelector('div.fixed.inset-0.z-\\[80\\]');
        return !!modal && (modal.textContent?.toLowerCase() ?? '').includes('wif');
      },
      undefined,
      { timeout: 20_000 },
    );
    const wifRow = page.locator('div.fixed.inset-0.z-\\[80\\] button:visible:has(span.tabular-nums)').first();
    await wifRow.dispatchEvent('click');

    await expect(modalInput).toBeHidden({ timeout: 5_000 });
    // 等 mint 真换成跟 first 不一样 · 这是核心验证(FIX4 前 bug 是 URL 不变)
    await page.waitForFunction(
      (prevMint) => {
        const cur = new URLSearchParams(location.search).get('mint');
        return cur !== null && cur !== prevMint;
      },
      mintAfterFirst,
      { timeout: 15_000 },
    );
    const urlAfterSecond = page.url();
    const mintAfterSecond = new URL(urlAfterSecond).searchParams.get('mint');
    expect(mintAfterSecond, 'second mint must differ from first (FIX4 真生效)').not.toBe(mintAfterFirst);

    // Console log [search-modal] navigate v4 must appear ≥2 times
    const navLogs = logs.filter((l) => l.includes('[search-modal] navigate v4'));
    expect(navLogs.length, `expected ≥2 navigate v4 logs, got ${navLogs.length}\n${navLogs.join('\n')}`).toBeGreaterThanOrEqual(2);
  });
});
