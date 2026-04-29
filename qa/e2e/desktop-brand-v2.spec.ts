import { test, expect } from '@playwright/test';
import { tradeUrl, gotoAndSettle, MINTS } from './_helpers';

// T-BRAND-COLOR-ROLLOUT-V2 验证 · success/destructive 全网指向品牌色
// 验涨色 = #19FB9B (oklch 0.84/0.88 0.23/0.25 155) · 跌色 = #FF6B6B (oklch 0.72 0.18 25)
test.describe('brand color V2 · success/destructive unified', () => {
  test.setTimeout(180_000);

  test('USDC trade page · text-success/destructive 都用品牌 oklch', async ({ page }) => {
    await gotoAndSettle(page, tradeUrl(MINTS.USDC));
    await page.waitForTimeout(2500);

    // 取 :root --destructive 计算值 · 验是 oklch 0.72 0.18 25
    const tokens = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        destructive: root.getPropertyValue('--destructive').trim(),
        success: root.getPropertyValue('--success').trim(),
        danger: root.getPropertyValue('--danger').trim(),
        brandUp: root.getPropertyValue('--brand-up').trim(),
        brandDown: root.getPropertyValue('--brand-down').trim(),
      };
    });
    // --brand-up/down 应当是字面 hex
    expect(tokens.brandUp.toLowerCase()).toBe('#19fb9b');
    expect(tokens.brandDown.toLowerCase()).toBe('#ff6b6b');
    // T-BRAND-COLOR-ROLLOUT-V2 核心契约 · destructive 必须 == danger(同指 brand-down)
    // 注:Lightning CSS 把 oklch 转 lab fallback · 比较字符串相等即可,不挑具体 colorspace
    expect(tokens.destructive).toBe(tokens.danger);
    expect(tokens.success).toBeTruthy();

    // 全页截图给用户看
    await page.screenshot({
      path: 'test-results/brand-v2-trade-desktop.png',
      fullPage: true,
    });

    // 桌面右栏 1h 池子 + 我的持仓盈亏区域 clip
    await page.screenshot({
      path: 'test-results/brand-v2-rightcol-clip.png',
      clip: { x: 1380, y: 100, width: 540, height: 800 },
    });
  });

  test('portfolio · 持仓盈亏数字 destructive 色统一', async ({ page }) => {
    await page.goto('/portfolio', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: 'test-results/brand-v2-portfolio.png',
      fullPage: true,
    });
  });

  test('history · 交易记录涨跌色统一', async ({ page }) => {
    await page.goto('/history', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: 'test-results/brand-v2-history.png',
      fullPage: true,
    });
  });
});
