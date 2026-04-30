import { test, expect } from '@playwright/test';
import { tradeUrl, gotoAndSettle, MINTS } from './_helpers';

test.describe('desktop /trade @ 1920x1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  for (const mint of ['SOL', 'USDC', 'BONK'] as const) {
    test(`trade page renders + baseline screenshot · ${mint}`, async ({ page }) => {
      await gotoAndSettle(page, tradeUrl(mint));

      // Smoke: page chrome
      await expect(page).toHaveTitle(/Ocufi/);
      await expect(page.locator('header').first()).toBeVisible();
      await expect(page.locator('main').first()).toBeVisible();

      // T-OKX-2 trading-header: SOL pair link / favorite button hint
      // (single-row dense header — verified visually via screenshot baseline)

      // 6 audit cards (T-OKX-1C-fe): zh-CN labels — at least 4 of 6 must be on page (some scroll below fold)
      const auditLabels = ['Top 10', '老鼠仓', '开发者', '捆绑', '狙击手', '烧池子'];
      let visibleAuditCount = 0;
      for (const label of auditLabels) {
        if ((await page.getByText(label, { exact: false }).count()) > 0) visibleAuditCount += 1;
      }
      expect(visibleAuditCount, `expected ≥4 audit labels on ${mint}, got ${visibleAuditCount}`).toBeGreaterThanOrEqual(4);

      // T-OKX-1A right-column markers: 优先级 (priority fee tier) tier toggle visible
      // (自动卖出 only shows when wallet connected — skip in headless)
      await expect(page.getByText(/优先级|优先费/).first()).toBeVisible();
      // 4 priority tiers visible: Pilot / P1 / P2 / P3
      for (const tier of ['Pilot', 'P1', 'P2', 'P3']) {
        await expect(page.getByText(tier, { exact: true }).first(), `priority tier ${tier} missing`).toBeVisible();
      }

      // T-CHART-COMPRESS: chart container at lg:h-[400px] for tradable pairs.
      // SOL is base — no chart, instead "K 线请在 USDC / USDT 等交易对中查看" message.
      if (mint === 'SOL') {
        await expect(page.getByText(/K ?线请在|基础币/).first()).toBeVisible();
      } else {
        const canvas = page.locator('canvas').first();
        await expect(canvas).toBeVisible({ timeout: 15_000 });
        const box = await canvas.boundingBox();
        expect(box?.height ?? 0, `chart canvas height (${mint}) should be <= 520`).toBeLessThanOrEqual(520);
        expect(box?.height ?? 0, `chart canvas height (${mint}) should be >= 200`).toBeGreaterThanOrEqual(200);
      }

      await page.waitForTimeout(800);
      await expect(page).toHaveScreenshot(`desktop-trade-${mint}.png`, {
        fullPage: false,
        animations: 'disabled',
        caret: 'hide',
        mask: [page.locator('canvas')],
        maxDiffPixelRatio: 0.05,
      });
    });
  }
});
