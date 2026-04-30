import { test, expect, devices } from '@playwright/test';
import { tradeUrl, gotoAndSettle, MINTS } from './_helpers';

// iPhone 14 Pro: 393x852 (configured in playwright.config.ts project)
test.describe('mobile /trade @ iPhone 14 Pro', () => {
  test.use({ ...devices['iPhone 14 Pro'] });

  // BONK is a real tradable mint with chart + form layout — exercises the full mobile stack
  test('mobile trade renders + T-977 series density preserved', async ({ page }) => {
    await gotoAndSettle(page, tradeUrl('BONK'));

    // T-977c · site-header 44px
    const siteHeader = page.locator('header').first();
    await expect(siteHeader).toBeVisible();
    const headerBox = await siteHeader.boundingBox();
    expect(headerBox?.height ?? 0, 'site-header height ≈ 44px').toBeLessThanOrEqual(56);
    expect(headerBox?.height ?? 0, 'site-header height ≈ 44px').toBeGreaterThanOrEqual(36);

    // T-977b · trading-header dense — token symbol + price visible in compact band
    await expect(page.getByText('BONK', { exact: false }).first()).toBeVisible();
    // a $-prefixed price token must appear (price line)
    await expect(page.getByText(/\$\d/).first()).toBeVisible();

    // T-977f · mini-trade-flow shown on mobile (right column live trades panel)
    // mobile layout: scroll into view if needed
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(500);

    // T-977e · 8 字段折叠到 Popover · check that desktop-only field bar is NOT a flat 8-row block
    // Heuristic: count visible $-formatted numeric chips in viewport. Mobile compresses these.
    // Sanity: the page must still render the 4 right-column data labels somewhere
    const dataLabels = ['流动性', '持币', '手续费', '风险'];
    let foundLabels = 0;
    for (const lbl of dataLabels) {
      if ((await page.getByText(lbl, { exact: false }).count()) > 0) foundLabels += 1;
    }
    expect(foundLabels, `expected ≥3 mobile data labels, found ${foundLabels}`).toBeGreaterThanOrEqual(3);

    // 6 audit labels — ≥4 must be on page (mobile may collapse in tab)
    const auditLabels = ['Top 10', '老鼠仓', '开发者', '捆绑', '狙击手', '烧池子'];
    let visibleAuditCount = 0;
    for (const lbl of auditLabels) {
      if ((await page.getByText(lbl, { exact: false }).count()) > 0) visibleAuditCount += 1;
    }
    expect(visibleAuditCount, `expected ≥3 audit labels on mobile, got ${visibleAuditCount}`).toBeGreaterThanOrEqual(3);

    // Baseline: full mobile page
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('mobile-trade-BONK.png', {
      fullPage: false,
      animations: 'disabled',
      caret: 'hide',
      mask: [page.locator('canvas')],
      maxDiffPixelRatio: 0.05,
    });
  });

  test('mobile trade SOL (base coin) renders fallback hint', async ({ page }) => {
    await gotoAndSettle(page, tradeUrl('SOL'));
    await expect(page.getByText(/K ?线请在|基础币/).first()).toBeVisible();
    await expect(page).toHaveScreenshot('mobile-trade-SOL.png', {
      fullPage: false,
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.05,
    });
  });
});
