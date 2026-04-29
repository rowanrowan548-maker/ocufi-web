import { test, expect } from '@playwright/test';
import { tradeUrl, gotoAndSettle, MINTS } from './_helpers';

// T-FE-STALE-UI 验证 · mock 后端 stale=true · 验灰条 "数据约 5 分钟前 · 自动刷新中"
test.describe('stale bar · screenshots for review', () => {
  test.setTimeout(120_000);

  test('USDC trade page · pool-stats-1h + audit-cards stale bar', async ({ page }) => {
    // 拦截后端 /pool/stats-1h 与 /token/audit-card · 注入 stale fallback shape
    await page.route(/\/pool\/stats-1h\?pool=/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          buy_count: 12, buy_volume_usd: 4500,
          sell_count: 7, sell_volume_usd: 2100,
          net_volume_usd: 2400, total_volume_usd: 6600,
          fetched_at: Math.floor(Date.now() / 1000) - 300,
          cached: true,
          stale: true,
          data_age_sec: 300,
        }),
      });
    });
    await page.route(/\/token\/audit-card\?mint=/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          top10_pct: 18.5, rat_warehouse_pct: 3.2,
          dev_status: 'holding', bundle_pct: 4.1,
          sniper_pct: 2.8, lp_burn_pct: 99.9,
          cached: true,
          stale: true,
          data_age_sec: 300,
        }),
      });
    });

    await gotoAndSettle(page, tradeUrl(MINTS.USDC));
    await page.waitForTimeout(2500);

    const bars = page.locator('[data-testid="stale-bar"]');
    await expect(bars.first()).toBeVisible({ timeout: 15_000 });
    const count = await bars.count();
    expect(count).toBeGreaterThanOrEqual(1);

    await page.screenshot({
      path: 'test-results/stale-bar-desktop.png',
      fullPage: true,
    });

    await page.screenshot({
      path: 'test-results/stale-bar-rightcol-clip.png',
      clip: { x: 1380, y: 100, width: 540, height: 700 },
    });
  });
});
