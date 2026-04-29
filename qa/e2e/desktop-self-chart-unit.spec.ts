import { test, expect } from '@playwright/test';
import { tradeUrl, gotoAndSettle, MINTS } from './_helpers';

// T-CHART-FULL-8 · USD / SOL 单位切换 + zustand 持久化
test.describe('candlestick unit toggle USD/SOL', () => {
  test.setTimeout(180_000);

  test('USDC trade · 切自家图 · USD 默认 · 切 SOL 高亮 · reload 持久化', async ({ page }) => {
    await gotoAndSettle(page, tradeUrl(MINTS.USDC));
    await page.waitForTimeout(2500);

    const selfBtn = page.locator('[data-testid="chart-source-self"]').first();
    await selfBtn.click();
    await page.waitForTimeout(1500);

    const usdBtn = page.locator('[data-testid="chart-unit-USD"]').first();
    const solBtn = page.locator('[data-testid="chart-unit-SOL"]').first();
    await expect(usdBtn).toBeVisible({ timeout: 10_000 });
    await expect(solBtn).toBeVisible();

    // 默认 USD active
    expect(await usdBtn.getAttribute('class') ?? '').toContain('var(--brand-up)');

    // 点 SOL
    await solBtn.click();
    await page.waitForTimeout(1000);
    expect(await solBtn.getAttribute('class') ?? '').toContain('var(--brand-up)');

    // reload 持久化
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.locator('[data-testid="chart-source-self"]').first().click();
    await page.waitForTimeout(1500);
    expect(await page.locator('[data-testid="chart-unit-SOL"]').first().getAttribute('class') ?? '').toContain('var(--brand-up)');

    await page.screenshot({ path: 'test-results/self-chart-unit-sol.png', fullPage: false });
  });
});
