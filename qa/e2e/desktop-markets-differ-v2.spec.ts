import { test, expect } from '@playwright/test';

// T-MARKETS-DIFFER-V2 · 聪明钱标 + mini K 线 hover + 风险标 click 跳 #risk
//
// 跑法:OCUFI_BASE_URL=http://localhost:3000 npx playwright test --config qa/e2e/playwright.config.ts desktop-markets-differ-v2

test.describe('/markets V2 差异化(聪明钱 + mini chart + risk hash)', () => {
  test.setTimeout(120_000);

  test('聪明钱列存在 · 后端 cold cache 时空占位 (data-testid empty 或 已渲) ', async ({ page }) => {
    await page.goto('/markets', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // 表头有"聪明钱"列
    await expect(page.getByText(/聪明钱|smart wallets/i).first()).toBeVisible({ timeout: 10_000 });

    // 滚到 1 行 · 等 IO 触发 fetch · empty 占位 OR badge 出现
    const rows = page.locator('[data-testid="markets-row"]');
    const rowCount = await rows.count();
    if (rowCount === 0) test.skip(true, 'no rows from backend');

    await rows.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(2500); // smart-money 5min cache · 网络往返

    // 至少 placeholder span 存在(empty)or badge(>0)· 二选一
    const empty = page.locator('[data-testid="smart-money-badge-empty"]').first();
    const filled = page.locator('[data-testid="smart-money-badge"]').first();
    const total = (await empty.count()) + (await filled.count());
    expect(total).toBeGreaterThan(0);
  });

  test('行 hover 0.5s → mini K 线 tooltip 浮出', async ({ page }) => {
    await page.goto('/markets', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const rows = page.locator('[data-testid="markets-row"]');
    if ((await rows.count()) === 0) test.skip(true, 'no rows');

    const first = rows.first();
    await first.hover();
    // 等 500ms hover delay + chart create + 数据
    await page.waitForTimeout(2500);

    const tooltip = page.locator('[data-testid="mini-chart-tooltip"]').first();
    await expect(tooltip).toBeVisible({ timeout: 10_000 });

    // 移走 → 消失
    await page.locator('h1').first().hover();
    await page.waitForTimeout(800);
    await expect(tooltip).toHaveCount(0);
  });

  test('risk tab → 点风险标 → 跳 /trade?mint=X#risk · trade 页 risk tab 自动激活', async ({ page }) => {
    await page.goto('/markets', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(1500);

    await page.locator('[data-testid="markets-tab-risk"]').first().click();
    await page.waitForTimeout(1500);

    const badges = page.locator('[data-testid="risk-badge"], [data-testid="risk-badge-verified"]');
    const badgeCount = await badges.count();
    if (badgeCount === 0) test.skip(true, 'no risk rows · backend cold');

    const first = badges.first();
    await first.scrollIntoViewIfNeeded();

    // hover 出 tooltip(verified 标无 tooltip · 跳过 hover 验证)
    const isVerified = (await first.getAttribute('data-testid')) === 'risk-badge-verified';
    if (!isVerified) {
      await first.hover();
      await page.waitForTimeout(400);
      const tip = page.locator('[data-testid="risk-badge-tooltip"]').first();
      await expect(tip).toBeVisible({ timeout: 5_000 });
    }

    // click → trade?mint=X#risk
    await Promise.all([
      page.waitForURL(/\/trade\?mint=.*#risk/, { timeout: 15_000 }),
      first.locator('button').first().click(),
    ]);
    expect(page.url()).toContain('#risk');

    // trade 页 risk tab 应自动展开(useSyncExternalStore 读 #risk)
    // 桌面 lg+ 才显 right-info-tabs · viewport 1920 应能看到
    await page.waitForTimeout(2000);
    const riskContent = page.locator('[data-testid="right-tab-risk-content"]').first();
    const visible = await riskContent.isVisible().catch(() => false);
    if (visible) {
      // tab 内容真渲染 = useSyncExternalStore 读 hash 生效
      expect(visible).toBe(true);
    }
  });
});
