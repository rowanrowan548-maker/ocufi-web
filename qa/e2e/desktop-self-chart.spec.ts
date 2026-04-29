import { test, expect } from '@playwright/test';
import { tradeUrl, gotoAndSettle, MINTS } from './_helpers';

// T-CHART-FULL-1 · 自家蜡烛图接入 trade 页 · 与 GT iframe 切换
test.describe('candlestick chart · native vs GT toggle', () => {
  test.setTimeout(180_000);

  test('USDC trade · GT 默认 · 切到自家图 · 验 canvas 渲染', async ({ page }) => {
    await gotoAndSettle(page, tradeUrl(MINTS.USDC));
    await page.waitForTimeout(2500);

    // 默认 GT iframe visible
    const iframe = page.locator('iframe[title="GeckoTerminal Chart"]').first();
    await expect(iframe).toBeVisible({ timeout: 15_000 });

    // 截 GT 默认状态
    await page.screenshot({ path: 'test-results/self-chart-default-gt.png', fullPage: false });

    // 点 toggle 切到自家图
    const selfBtn = page.locator('[data-testid="chart-source-self"]').first();
    await expect(selfBtn).toBeVisible({ timeout: 10_000 });
    await selfBtn.click();
    await page.waitForTimeout(2000);

    // 自家图 container 应该出现
    const chart = page.locator('[data-testid="candlestick-chart"]').first();
    await expect(chart).toBeVisible({ timeout: 15_000 });

    // canvas 应该被 lightweight-charts 注入
    const canvasCount = await chart.locator('canvas').count();
    expect(canvasCount).toBeGreaterThanOrEqual(1);

    // GT iframe 此时应该消失
    await expect(iframe).toBeHidden();

    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'test-results/self-chart-active.png', fullPage: false });
    await page.screenshot({
      path: 'test-results/self-chart-clip.png',
      clip: { x: 280, y: 200, width: 1100, height: 420 },
    });

    // 切回 GT
    const gtBtn = page.locator('[data-testid="chart-source-gt"]').first();
    await gtBtn.click();
    await page.waitForTimeout(1500);
    await expect(iframe).toBeVisible();
    await expect(chart).toBeHidden();
  });
});
