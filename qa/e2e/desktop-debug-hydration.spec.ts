import { test } from '@playwright/test';
import * as fs from 'fs';

// 调试用 spec · 复现用户:强刷 → 等 3s → 点搜索 → 点首行 → 捕全 console + page error
test('reproduce hydration #418 + first-click swallow', async ({ page }) => {
  test.setTimeout(120_000);
  const lines: string[] = [];
  page.on('console', (msg) => {
    lines.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    lines.push(`[pageerror] ${err.message}\n${err.stack ?? ''}`);
  });

  // 用户路径:/trade?mint=SOL · 进 trade 页(SOL 是 default · 可能 trade-screen 走 default 分支)
  await page.goto('/trade?mint=So11111111111111111111111111111111111111112', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(3000);

  lines.push('---- after 3s wait ----');

  // 真鼠标点击搜索 trigger(用 force 跳过 stability check · dev HMR 永不 networkidle)
  const trigger = page.locator('button[aria-label*="DApp"]').first();
  if (await trigger.count()) {
    await trigger.click({ force: true, timeout: 10_000 }).catch((e) => lines.push(`[trigger click err] ${e.message}`));
    await page.waitForTimeout(1500);
  } else {
    lines.push('[no trigger found]');
  }

  // 点 modal 内首行(用 fill 加 force · 走真 React event 路径)
  const input = page.locator('input[placeholder*="DApp"]:visible').first();
  if (await input.count()) {
    await input.fill('SOL', { force: true, timeout: 10_000 }).catch((e) => lines.push(`[fill err] ${e.message}`));
    await page.waitForTimeout(2500);
  }

  const firstRow = page.locator('div.fixed.inset-0.z-\\[80\\] button:visible:has(span.tabular-nums)').first();
  if (await firstRow.count()) {
    const urlBefore = page.url();
    await firstRow.click({ force: true, timeout: 10_000 }).catch((e) => lines.push(`[row click err] ${e.message}`));
    await page.waitForTimeout(2500);
    const urlAfter = page.url();
    lines.push(`---- url before=${urlBefore} ----`);
    lines.push(`---- url after =${urlAfter} ----`);
    lines.push(`---- url changed? ${urlBefore !== urlAfter} ----`);
  } else {
    lines.push('[no row found]');
  }

  fs.writeFileSync('/tmp/hydration-debug.log', lines.join('\n'));
  console.log(`saved ${lines.length} lines to /tmp/hydration-debug.log`);
});
