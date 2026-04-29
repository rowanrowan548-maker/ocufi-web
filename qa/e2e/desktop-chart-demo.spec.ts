import { test, expect } from '@playwright/test';

// T-CHART-DEMO + V2 视觉截图 · 自家 K 线 demo · /trade-preview?demo=1
// 不进 CI 回归套件 · 看完用户拍板后整页 git revert 即可
test('chart-demo · screenshot for user review', async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto('/trade-preview?demo=1', { waitUntil: 'domcontentloaded' });

  // V2 后页面有 1 大 + 4 小共 5 个 chart container · 取首个验存在
  await expect(page.locator('div.rounded-lg.border.bg-\\[\\#0a0a0a\\]').first()).toBeVisible({
    timeout: 15_000,
  });
  // 等数据加载(成功 / 合成 都终态 · loading 不算)
  await page
    .waitForFunction(
      () => {
        const txt = document.body.textContent ?? '';
        return /蜡烛/.test(txt) && !/加载.*中/.test(txt);
      },
      undefined,
      { timeout: 30_000 },
    )
    .catch(() => {});
  // 给 chart 渲染一帧
  await page.waitForTimeout(2000);

  await page.screenshot({
    path: 'test-results/chart-demo-preview.png',
    fullPage: false,
  });

  // T-CHART-DEMO-V2 · 4 色红对比追加 · 全页截图(含上方原 demo + 下方 4 色横排)
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: 'test-results/chart-demo-v2-full.png',
    fullPage: true,
  });
});
