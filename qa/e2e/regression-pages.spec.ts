import { test, expect } from '@playwright/test';
import { gotoAndSettle, PREVIEW_KEY } from './_helpers';

// T-QA-REG-001 · 9 页全站回归 e2e × 桌面 + 移动 = 18 截图基线
// 不重叠 daily-smoke(daily 是日常巡检 · 这条是回归基线 · 跑频更低 · 包 /alerts)
// 2026-04-30: T-QA-MOBILE-REBASELINE 加 /markets + /rewards(7→9 页)
//
// 跑:
//   pnpm exec playwright test --config qa/e2e/playwright.config.ts \
//     --project=regression-desktop --project=regression-mobile
// 重生基线:加 --update-snapshots
//
// 基线落 qa/e2e/__snapshots__/regression/{name}-{viewport}.png

function withPreview(path: string, key = PREVIEW_KEY) {
  return path.includes('?') ? `${path}&preview=${key}` : `${path}?preview=${key}`;
}

const PAGES: Array<{ name: string; url: string }> = [
  { name: 'landing', url: '/' },
  { name: 'docs', url: withPreview('/docs') },
  { name: 'faq', url: withPreview('/faq') },
  { name: 'portfolio', url: withPreview('/portfolio') },
  { name: 'history', url: withPreview('/history') },
  { name: 'alerts', url: withPreview('/alerts') },
  { name: 'invite', url: withPreview('/invite') },
  { name: 'markets', url: withPreview('/markets') },
  { name: 'rewards', url: withPreview('/rewards') },
];

test.describe('regression-pages · 7 pages × desktop/mobile baselines', () => {
  test.setTimeout(60_000);

  for (const p of PAGES) {
    test(`${p.name}`, async ({ page }, testInfo) => {
      await gotoAndSettle(page, p.url);
      await expect(page).toHaveTitle(/Ocufi/);

      // viewport label baked into snapshot filename via project name
      const viewportTag = testInfo.project.name === 'regression-mobile' ? 'mobile' : 'desktop';

      const masks = [
        page.locator('canvas'),
        page.locator('[data-volatile]'),
      ];

      await expect(page).toHaveScreenshot(`regression/${p.name}-${viewportTag}.png`, {
        fullPage: false,
        animations: 'disabled',
        caret: 'hide',
        mask: masks,
        maxDiffPixelRatio: 0.05,
      });
    });
  }
});
