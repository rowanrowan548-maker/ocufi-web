import { test, expect } from '@playwright/test';

// T-REWARDS-POLISH · emoji 换 Lucide 图标 · 文案去竞品名 · /rewards + /markets
//
// 跑法:OCUFI_BASE_URL=http://localhost:3000 npx playwright test --config qa/e2e/playwright.config.ts desktop-rewards-polish

test.describe('T-REWARDS-POLISH · emoji + brand voice', () => {
  test.setTimeout(60_000);

  test('/rewards 页面无 emoji · subtitle 无 gmgn / photon', async ({ page }) => {
    await page.goto('/rewards', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(800);

    // 取整个 body 的可见文本 · 检查不含 emoji 4 件套 + 不含竞品名
    const bodyText = await page.locator('body').innerText();
    for (const e of ['🎁', '⚡', '🎯', '💰', '🔥', '🆕', '📈', '📉', '✅', '⚠️']) {
      expect(bodyText, `should not contain emoji ${e}`).not.toContain(e);
    }
    expect(bodyText.toLowerCase()).not.toContain('gmgn');
    expect(bodyText.toLowerCase()).not.toContain('photon');

    // 3 tab data-testid 还在(spec V1 没破)
    for (const k of ['reclaim', 'mev', 'invite']) {
      await expect(page.locator(`[data-testid="rewards-tab-${k}"]`).first()).toBeVisible();
    }
  });

  test('/markets 页面 6 tab 按钮无 emoji · 仅 Lucide icon + 文字', async ({ page }) => {
    await page.goto('/markets', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(800);

    // 6 tab 按钮文字不能含 emoji
    for (const k of ['trending', 'new', 'gainers1h', 'losers24h', 'verified', 'risk']) {
      const btn = page.locator(`[data-testid="markets-tab-${k}"]`).first();
      const text = await btn.innerText();
      for (const e of ['🔥', '🆕', '📈', '📉', '✅', '⚠️']) {
        expect(text, `tab ${k} should not contain ${e}`).not.toContain(e);
      }
      // 但每个 tab 应包含 SVG icon(Lucide 渲染为 svg)
      const svgCount = await btn.locator('svg').count();
      expect(svgCount, `tab ${k} should have Lucide svg`).toBeGreaterThanOrEqual(1);
    }
  });
});
