import { test, expect } from '@playwright/test';
import { tradeUrl, gotoAndSettle, MINTS } from './_helpers';

// T-BRAND-COLOR-ROLLOUT 验证 · 桌面 + 模拟移动 · USDC 页 buy/sell + /trade-preview demo
test.describe('brand color rollout · screenshots for review', () => {
  test.setTimeout(120_000);

  test('USDC trade page · desktop + mobile · buy/sell brand colors', async ({ page }) => {
    await gotoAndSettle(page, tradeUrl(MINTS.USDC));
    await page.waitForTimeout(2000);

    // 桌面 1920 全页截图(默认 viewport from project)
    await page.screenshot({
      path: 'test-results/brand-color-trade-desktop.png',
      fullPage: true,
    });

    // buy 默认 active · 切到 sell · 截 sell active
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('[role="tab"]')) as HTMLElement[];
      const sellTab = tabs.find((el) => el.offsetParent && (el.textContent?.includes('卖出') || el.textContent?.toLowerCase().includes('sell')));
      sellTab?.click();
    });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: 'test-results/brand-color-trade-sell-active.png',
      clip: { x: 1400, y: 200, width: 480, height: 100 },
    });

    // 模拟移动 viewport
    await page.setViewportSize({ width: 393, height: 852 });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: 'test-results/brand-color-trade-mobile.png',
      fullPage: true,
    });
  });

  test('trade-preview demo · 涨青绿 + 跌珊瑚粉红', async ({ page }) => {
    await page.goto('/trade-preview?demo=1', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('div.rounded-lg.border.bg-\\[\\#0a0a0a\\]').first()).toBeVisible({
      timeout: 15_000,
    });
    await page
      .waitForFunction(
        () => {
          const txt = document.body.textContent ?? '';
          return /蜡烛/.test(txt) && !/加载.*中/.test(txt);
        },
        undefined,
        { timeout: 30_000 },
      )
      .catch(() => {});
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'test-results/brand-color-demo-page.png',
      fullPage: true,
    });
  });
});
