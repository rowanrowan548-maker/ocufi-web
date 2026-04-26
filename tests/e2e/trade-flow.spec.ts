import { test, expect } from '@playwright/test';

/**
 * T-007b 半自动化交易流程审查
 * 不连钱包,只测纯前端交互:URL 驱动 mint 切换 / 页面渲染 / 控制台错误 / 时序
 */

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

test.describe('trade flow · URL-driven mint switch', () => {
  test('SOL → USDC → SOL 切换:渲染 / URL / 控制台都干净', async ({ page }) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error') errors.push(`console.error: ${text}`);
      if (msg.type() === 'warning') warnings.push(`console.warn: ${text}`);
    });

    // Step 1: /trade(默认 SOL)— 看 SOL 专属"Buy SOL with USDC/USDT"分支
    const t0 = Date.now();
    await page.goto('/trade');
    const buySolBtn = page.getByRole('button', { name: /Buy SOL with USDC|用 USDC 买 SOL/i });
    await expect(buySolBtn).toBeVisible({ timeout: 10_000 });
    const solRenderMs = Date.now() - t0;

    // Step 2: 切到 USDC(URL 驱动,等价于 combo 选择)
    const t1 = Date.now();
    await page.goto(`/trade?mint=${USDC_MINT}`);
    // 不是 SOL_MINT → 应渲染 Buy/Sell tabs + Connect Wallet 按钮(以 ConnectWallet 为锚点)
    const connect = page.getByRole('button', { name: /Connect Wallet|连接钱包/ }).first();
    await expect(connect).toBeVisible({ timeout: 10_000 });
    const usdcRenderMs = Date.now() - t1;

    // Step 3: combo trigger 文字应在合理时间内切到 USDC symbol(metadata 拉取后)
    // 拉不到也不阻塞 — 但记录耗时
    const symbolStart = Date.now();
    const usdcSymbolVisible = await page
      .getByRole('button', { name: /^USDC/ })
      .first()
      .isVisible({ timeout: 8_000 })
      .catch(() => false);
    const symbolMs = usdcSymbolVisible ? Date.now() - symbolStart : -1;

    // Step 4: 切回 SOL(去掉 mint 参数)
    const t2 = Date.now();
    await page.goto('/trade');
    await expect(buySolBtn).toBeVisible({ timeout: 10_000 });
    const backToSolMs = Date.now() - t2;

    // Step 5: 测一个真实 meme 币(BONK)看远端搜索 + 风险审查不爆炸
    const BONK_MINT = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
    const t3 = Date.now();
    await page.goto(`/trade?mint=${BONK_MINT}`);
    await expect(connect).toBeVisible({ timeout: 15_000 });
    const bonkRenderMs = Date.now() - t3;

    // 报告
    console.log(`[QA] 渲染时序`);
    console.log(`  - /trade (SOL):              ${solRenderMs}ms`);
    console.log(`  - /trade?mint=USDC:          ${usdcRenderMs}ms`);
    console.log(`  - /trade (back to SOL):      ${backToSolMs}ms`);
    console.log(`  - /trade?mint=BONK:          ${bonkRenderMs}ms`);
    console.log(`  - USDC symbol shown after:   ${symbolMs >= 0 ? symbolMs + 'ms' : 'NOT SHOWN in 8s'}`);

    if (errors.length) {
      console.log(`[QA] 控制台 / 页面错误 (${errors.length}):`);
      errors.forEach((e) => console.log('  - ' + e.slice(0, 200)));
    } else {
      console.log('[QA] 控制台 / 页面错误: 0');
    }
    if (warnings.length) {
      console.log(`[QA] 警告 (${warnings.length}):`);
      warnings.slice(0, 8).forEach((w) => console.log('  - ' + w.slice(0, 200)));
    }
  });

  test('combo trigger 单击打开下拉的状态行为', async ({ page }) => {
    await page.goto('/trade?mint=' + USDC_MINT);
    const trigger = page.getByRole('button', { name: /USDC|USD Coin|选择代币|Pick a token/ }).first();
    await expect(trigger).toBeVisible({ timeout: 10_000 });

    // 单击应打开下拉(出 input)
    await trigger.click();
    const search = page.getByPlaceholder(/Search|搜代币|symbol|name/i).first();
    const opened = await search.isVisible({ timeout: 3_000 }).catch(() => false);
    console.log(`[QA] 单击 trigger 后下拉是否打开: ${opened}`);
    if (!opened) {
      // 复点一次看是否能打开 — 验证 mousedown outside-click 误关 hypothesis
      await trigger.click();
      const opened2 = await search.isVisible({ timeout: 3_000 }).catch(() => false);
      console.log(`[QA] 第二次 click 后下拉打开: ${opened2}`);
    }
  });

  test('375px 移动端:trade 页关键元素不裁切', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/trade?mint=' + USDC_MINT);
    const trigger = page.getByRole('button').filter({ hasText: /USDC/ }).first();
    await expect(trigger).toBeVisible({ timeout: 10_000 });
    const triggerBox = await trigger.boundingBox();
    console.log(`[QA] 375px combo trigger box: ${JSON.stringify(triggerBox)}`);
    expect(triggerBox?.width).toBeLessThanOrEqual(375);

    // 找快捷金额按钮 (应有 0.1 / 0.5 / 1 SOL),量它高度看是否 ≥ 44px
    const quickAmount = page.getByRole('button', { name: /^0\.1 SOL$/ });
    if (await quickAmount.count()) {
      const box = await quickAmount.first().boundingBox();
      console.log(`[QA] 0.1 SOL 快捷按钮 box (375px): ${JSON.stringify(box)}`);
    }
  });
});
