import { test } from '@playwright/test';
import * as fs from 'fs';

// 调试用 spec · 复现用户:强刷 → 等 3s → 点搜索 → 点首行 → 捕全 console + page error
// 用 evaluate 触发原生 click + input event(避开 dev HMR 永不 networkidle 卡死)
test('reproduce hydration #418 + first-click swallow', async ({ page }) => {
  test.setTimeout(120_000);
  const lines: string[] = [];
  page.on('console', (msg) => {
    lines.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    lines.push(`[pageerror] ${err.message}\n${err.stack ?? ''}`);
  });

  await page.goto('/trade?mint=So11111111111111111111111111111111111111112', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(3000);

  lines.push('---- after 3s wait ----');

  // 触发搜索 trigger 的 click(原生 .click() 直接调,不经 Playwright actionability)
  await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label*="DApp"]') as HTMLButtonElement | null;
    if (btn) btn.click();
  });
  await page.waitForTimeout(1500);
  lines.push('---- after trigger click ----');

  // 输入 SOL · 用原生 setter + input event(走真 React onChange 路径 · 双 modal 实例时取可见的)
  await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input[placeholder*="DApp"]')) as HTMLInputElement[];
    const el = inputs.find((e) => e.offsetParent !== null) ?? inputs[0];
    if (!el) return;
    const proto = Object.getPrototypeOf(el);
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, 'SOL');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(2500);
  lines.push('---- after input SOL ----');

  // 点 modal 内首行(原生 click)
  const urlBefore = page.url();
  await page.evaluate(() => {
    const modal = document.querySelector('div.fixed.inset-0.z-\\[80\\]');
    const row = modal?.querySelector('button:has(span.tabular-nums)') as HTMLButtonElement | null;
    if (row) row.click();
  });
  await page.waitForTimeout(2500);
  const urlAfter = page.url();
  lines.push(`---- url before=${urlBefore} ----`);
  lines.push(`---- url after =${urlAfter} ----`);
  lines.push(`---- url changed? ${urlBefore !== urlAfter} ----`);

  fs.writeFileSync('/tmp/hydration-debug.log', lines.join('\n'));
  console.log(`saved ${lines.length} lines to /tmp/hydration-debug.log`);
});
