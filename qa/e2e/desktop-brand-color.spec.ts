import { test, expect } from '@playwright/test';
import { tradeUrl, gotoAndSettle, MINTS } from './_helpers';

// T-BRAND-COLOR-ROLLOUT 验证 · 桌面 + 模拟移动 · USDC 页 buy/sell
// (trade-preview demo test 在 T-CHART-CLEANUP-PREVIEW 后删除 · /trade-preview 已移除)
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

});
