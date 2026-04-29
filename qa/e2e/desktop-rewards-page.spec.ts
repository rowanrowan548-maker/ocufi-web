import { test, expect } from '@playwright/test';

// T-REWARDS-PAGE · /rewards 奖励中心 · 3 tab(回收 SOL / MEV 返还 / 邀请返佣)
//
// 跑法:OCUFI_BASE_URL=http://localhost:3000 npx playwright test --config qa/e2e/playwright.config.ts desktop-rewards-page

test.describe('/rewards 3 tab + URL hash + localStorage', () => {
  test.setTimeout(120_000);

  test('3 tab 全 visible · 默认 reclaim 高亮 · 顶部 total SOL 渲', async ({ page }) => {
    await page.goto('/rewards', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(1500);

    for (const k of ['reclaim', 'mev', 'invite']) {
      await expect(page.locator(`[data-testid="rewards-tab-${k}"]`).first()).toBeVisible({
        timeout: 10_000,
      });
    }

    // 顶部累计 SOL 渲染(初始 0.0000)
    const total = page.locator('[data-testid="rewards-total-sol"]').first();
    await expect(total).toBeVisible();
    await expect(total).toContainText(/0\.0000.*SOL|SOL/);

    // reclaim tab content 默认显
    await expect(
      page.locator('[data-testid="rewards-tab-reclaim-content"]').first()
    ).toBeVisible();
  });

  test('点 mev tab → tab 切换 · MEV total + 空态出现', async ({ page }) => {
    await page.goto('/rewards', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(1000);

    await page.locator('[data-testid="rewards-tab-mev"]').first().click();
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid="mev-total-sol"]').first()).toBeVisible();
    // localStorage 空 → 空态
    await expect(page.locator('[data-testid="mev-history-empty"]').first()).toBeVisible();
  });

  test('localStorage 注入 MEV 记录 → mev 列表显示', async ({ page }) => {
    await page.goto('/rewards', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // 注入 2 条假 MEV 记录
    await page.evaluate(() => {
      localStorage.setItem('ocufi.rewards.mev_total_lamports', String(15_000_000)); // 0.015 SOL
      localStorage.setItem('ocufi.rewards.mev_history', JSON.stringify([
        { tx: 'aaaa1111bbbb2222cccc3333', amount_lamports: 10_000_000, ts: Date.now(), token_symbol: 'BONK' },
        { tx: 'dddd4444eeee5555ffff6666', amount_lamports: 5_000_000, ts: Date.now() - 60_000, token_symbol: 'WIF' },
      ]));
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    await page.locator('[data-testid="rewards-tab-mev"]').first().click();
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid="mev-history-list"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="mev-history-list"] li').first()).toContainText('BONK');
    // 累计 0.015 SOL · 注顶部用 6 位小数
    await expect(page.locator('[data-testid="mev-total-sol"]').first()).toContainText('0.015');

    // cleanup
    await page.evaluate(() => {
      localStorage.removeItem('ocufi.rewards.mev_total_lamports');
      localStorage.removeItem('ocufi.rewards.mev_history');
    });
  });

  test('URL hash #mev → 直接打开 MEV tab(useSyncExternalStore)', async ({ page }) => {
    await page.goto('/rewards#mev', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    await expect(
      page.locator('[data-testid="rewards-tab-mev-content"]').first()
    ).toBeVisible();
    // reclaim content 不显
    await expect(
      page.locator('[data-testid="rewards-tab-reclaim-content"]').first()
    ).toBeHidden();
  });

  test('invite tab → CTA 链接指 /invite', async ({ page }) => {
    await page.goto('/rewards#invite', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const cta = page.locator('[data-testid="invite-go"]').first();
    await expect(cta).toBeVisible();
    expect(await cta.getAttribute('href')).toBe('/invite');
  });
});
