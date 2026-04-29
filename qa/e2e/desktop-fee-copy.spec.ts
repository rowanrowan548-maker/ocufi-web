import { test, expect } from '@playwright/test';

// T-FEE-COPY-CONSISTENCY · 全网 0.2% → 0.1% 一致性
// 验 landing / faq / docs / invite 4 关键页 · 0.2% 字符串完全消失
test.describe('fee copy consistency · 0.1% only', () => {
  test.setTimeout(120_000);

  for (const path of ['/zh-CN', '/zh-CN/faq', '/zh-CN/docs', '/zh-CN/invite']) {
    test(`zh ${path} · 不应含 "0.2%"`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      const body = (await page.locator('body').textContent()) ?? '';
      expect(body).not.toContain('0.2%');
      // 0.1% 必须出现 (除 invite 推文动态加载 · 该页只验不含 0.2%)
      if (path !== '/zh-CN/invite') {
        expect(body).toContain('0.1%');
      }
    });
  }

  for (const path of ['/en-US', '/en-US/faq', '/en-US/docs']) {
    test(`en ${path} · must not contain "0.2%"`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      const body = (await page.locator('body').textContent()) ?? '';
      expect(body).not.toContain('0.2%');
      expect(body).toContain('0.1%');
    });
  }

  test('landing tagline + screenshots', async ({ page }) => {
    await page.goto('/zh-CN', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/fee-copy-landing-zh.png', fullPage: false });

    await page.goto('/en-US', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/fee-copy-landing-en.png', fullPage: false });

    await page.goto('/zh-CN/faq', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/fee-copy-faq-zh.png', fullPage: true });

    await page.goto('/zh-CN/docs', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/fee-copy-docs-zh.png', fullPage: true });
  });
});
