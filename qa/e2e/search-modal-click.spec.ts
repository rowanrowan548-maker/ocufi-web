import { test, expect } from '@playwright/test';
import { tradeUrl, gotoAndSettle, MINTS } from './_helpers';

// T-SEARCH-CLICK-FIX4 真生效验证:第二次点击同样跳转,console log 出现 2 次
// 改 URL 派生 mint(单源)+ 删 router.refresh() 后 · 双向同步死锁解除
test.describe('header search modal · click navigation', () => {
  test('two consecutive result clicks both navigate + log fires twice', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'log') logs.push(msg.text());
    });

    await gotoAndSettle(page, tradeUrl('SOL'));

    // Open search modal
    const searchTrigger = page.getByRole('button', { name: /币种 \/ 地址 \/ DApp/ });
    await searchTrigger.click();

    // Modal opens — input gets focus
    const modalInput = page.getByPlaceholder(/币种 \/ 地址 \/ DApp/);
    await expect(modalInput).toBeVisible({ timeout: 10_000 });

    // Wait for trending list to load (≥3 rows)
    const rowButtons = page.locator('button:has(span.tabular-nums)');
    await expect(rowButtons.nth(2)).toBeVisible({ timeout: 15_000 });

    // First click — row #1 (index 0)
    const firstRow = rowButtons.nth(0);
    await firstRow.scrollIntoViewIfNeeded();
    await firstRow.click();

    // Modal closes + URL navigates
    await expect(modalInput).toBeHidden({ timeout: 5_000 });
    await page.waitForURL(/\/trade\?mint=/, { timeout: 10_000 });
    const urlAfterFirst = page.url();

    // Open modal again
    await searchTrigger.click();
    await expect(modalInput).toBeVisible({ timeout: 10_000 });
    await expect(rowButtons.nth(2)).toBeVisible({ timeout: 15_000 });

    // Second click — row #2 (index 1) — must be a different mint than first
    const secondRow = rowButtons.nth(1);
    await secondRow.scrollIntoViewIfNeeded();
    await secondRow.click();

    await expect(modalInput).toBeHidden({ timeout: 5_000 });
    await page.waitForFunction(
      (prev) => location.pathname === '/trade' && location.href !== prev,
      urlAfterFirst,
      { timeout: 10_000 },
    );
    const urlAfterSecond = page.url();
    expect(urlAfterSecond, 'second click must change URL').not.toBe(urlAfterFirst);

    // Console log [search-modal] navigate v4 must appear ≥2 times
    const navLogs = logs.filter((l) => l.includes('[search-modal] navigate v4'));
    expect(navLogs.length, `expected ≥2 navigate v4 logs, got ${navLogs.length}\n${navLogs.join('\n')}`).toBeGreaterThanOrEqual(2);
  });
});
