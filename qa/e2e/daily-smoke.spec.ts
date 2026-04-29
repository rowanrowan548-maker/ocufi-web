import { test, expect, type Page } from '@playwright/test';
import { tradeUrl, gotoAndSettle, MINTS, PREVIEW_KEY } from './_helpers';

// T-QA-DAILY-SMOKE · 8 页桌面 1920 截图基线 · 5% diff 报警
// 不进 CI · 用户每天 9:00 / 每 ship 后手动跑一次:
//   pnpm exec playwright test --config qa/e2e/playwright.config.ts qa/e2e/daily-smoke.spec.ts
// 重新生成基线:
//   pnpm exec playwright test --config qa/e2e/playwright.config.ts qa/e2e/daily-smoke.spec.ts --update-snapshots
//
// 基线落 qa/e2e/__snapshots__/daily/{name}.png

function withPreview(path: string, key = PREVIEW_KEY) {
  return path.includes('?') ? `${path}&preview=${key}` : `${path}?preview=${key}`;
}

const PAGES: Array<{ name: string; url: string; settleSec?: number }> = [
  { name: 'landing', url: '/' },
  { name: 'trade-USDC', url: tradeUrl('USDC'), settleSec: 4 },
  { name: 'trade-BONK', url: tradeUrl('BONK'), settleSec: 4 },
  { name: 'portfolio', url: withPreview('/portfolio') },
  { name: 'history', url: withPreview('/history') },
  { name: 'docs', url: withPreview('/docs') },
  { name: 'faq', url: withPreview('/faq') },
  { name: 'invite', url: withPreview('/invite') },
];

test.describe('daily-smoke @ desktop 1920×1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });
  test.setTimeout(60_000);

  for (const p of PAGES) {
    test(`smoke · ${p.name}`, async ({ page }) => {
      await gotoAndSettle(page, p.url);
      // Some pages render heavy data (charts, ticker) — give settle headroom
      if (p.settleSec) await page.waitForTimeout(p.settleSec * 1000);

      // Title sanity (every page should keep the Ocufi title)
      await expect(page).toHaveTitle(/Ocufi/);

      // Mask volatile regions: chart canvas, time-stamps, live trade rows
      const masks = [
        page.locator('canvas'),
        page.locator('[data-volatile]'),
      ];

      await expect(page).toHaveScreenshot(`daily/${p.name}.png`, {
        fullPage: false,
        animations: 'disabled',
        caret: 'hide',
        mask: masks,
        maxDiffPixelRatio: 0.05,
      });
    });
  }
});
