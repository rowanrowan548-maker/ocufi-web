import { test, expect } from '@playwright/test';
import { tradeUrl, gotoAndSettle, MINTS } from './_helpers';

// T-PHANTOM-SPLIT-TX-FE · wrap cleanup toast · 注 localStorage 后下次进 trade 弹 toast
test.describe('wrap cleanup toast', () => {
  test.setTimeout(120_000);

  test('localStorage pendingWrap → trade 页 mount toast', async ({ page }) => {
    // 先进 trade 页让 localStorage origin 准备好
    await page.goto('/zh-CN/trade?mint=' + MINTS.USDC, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // 注一个 24h 内的 pendingWrap
    await page.evaluate(() => {
      const data = {
        setupSig: 'TestSetupSignature123abc456def789ghi012jkl345mno678pqr901stu234vwx567yz',
        ts: Math.floor(Date.now() / 1000),
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      };
      localStorage.setItem('ocufi.pendingWrap', JSON.stringify(data));
    });

    // 重新加载 · WrapCleanupToast mount 时检测
    await gotoAndSettle(page, tradeUrl(MINTS.USDC));
    await page.waitForTimeout(2000);

    // 隐藏 marker · 验组件 mount 检测到 pendingWrap(toast 渲染在 portal · 文案断言不稳)
    const marker = page.locator('[data-testid="wrap-cleanup-detected"]');
    await expect(marker).toHaveCount(1, { timeout: 8_000 });
    const setupSig = await marker.getAttribute('data-setup-sig');
    expect(setupSig).toContain('TestSetupSignature');

    await page.screenshot({ path: 'test-results/wrap-cleanup-toast.png', fullPage: false });
  });

  test('过期 24h+ pendingWrap → 不弹', async ({ page }) => {
    await page.goto('/zh-CN/trade?mint=' + MINTS.USDC, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const data = {
        setupSig: 'OldSig',
        ts: Math.floor(Date.now() / 1000) - 25 * 3600,   // 25h 前
        mint: 'X',
      };
      localStorage.setItem('ocufi.pendingWrap', JSON.stringify(data));
    });
    await gotoAndSettle(page, tradeUrl(MINTS.USDC));
    await page.waitForTimeout(2500);
    const marker = page.locator('[data-testid="wrap-cleanup-detected"]');
    expect(await marker.count()).toBe(0);
  });
});
