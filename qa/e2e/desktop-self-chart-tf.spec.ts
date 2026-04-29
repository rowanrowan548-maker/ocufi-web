import { test, expect } from '@playwright/test';
import { tradeUrl, gotoAndSettle, MINTS } from './_helpers';

// T-CHART-FULL-2 · 自家蜡烛图 6 档 timeframe toggle + zustand persist
test.describe('candlestick timeframe toggle', () => {
  test.setTimeout(180_000);

  test('USDC trade · 切自家图 · 6 档 tf 按钮全 visible · 点 1h 高亮', async ({ page }) => {
    await gotoAndSettle(page, tradeUrl(MINTS.USDC));
    await page.waitForTimeout(2500);

    // 切自家图
    const selfBtn = page.locator('[data-testid="chart-source-self"]').first();
    await selfBtn.click();
    await page.waitForTimeout(1500);

    // 6 档 tf 按钮全应 visible
    const TFS = ['minute_1', 'minute_5', 'minute_15', 'hour_1', 'hour_4', 'day_1'];
    for (const tf of TFS) {
      const btn = page.locator(`[data-testid="tf-${tf}"]`).first();
      await expect(btn).toBeVisible({ timeout: 10_000 });
    }

    // 默认 5m active(active 含 brand-up text 颜色)
    const default5m = page.locator('[data-testid="tf-minute_5"]').first();
    const cls5m = await default5m.getAttribute('class');
    expect(cls5m ?? '').toContain('var(--brand-up)');

    // 点 1h
    await page.locator('[data-testid="tf-hour_1"]').first().click();
    await page.waitForTimeout(1000);
    const cls1h = await page.locator('[data-testid="tf-hour_1"]').first().getAttribute('class');
    expect(cls1h ?? '').toContain('var(--brand-up)');

    // 验 zustand 持久化(reload 后应保持 1h)
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const selfBtn2 = page.locator('[data-testid="chart-source-self"]').first();
    await selfBtn2.click();
    await page.waitForTimeout(1500);
    const cls1hAfter = await page.locator('[data-testid="tf-hour_1"]').first().getAttribute('class');
    expect(cls1hAfter ?? '').toContain('var(--brand-up)');

    await page.screenshot({ path: 'test-results/self-chart-tf-1h.png', fullPage: false });
  });
});
