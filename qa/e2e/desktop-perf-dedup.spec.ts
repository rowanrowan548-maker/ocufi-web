import { test, expect } from '@playwright/test';
import { tradeUrl, gotoAndSettle, MINTS } from './_helpers';

// T-PERF-FE-DEDUP-REQUESTS · 验 /price/SOL + /token/trades 同 mint 跨组件只调 1 次
test.describe('frontend request dedup · /price + /token/trades', () => {
  test.setTimeout(120_000);

  test('Bonk trade · /price/SOL 调 1 次 · /token/trades 调 1 次', async ({ page }) => {
    const priceSolHits: string[] = [];
    const tradesHits: string[] = [];

    page.on('request', (req) => {
      const url = req.url();
      if (/\/price\/So11111111111111111111111111111111111111112/.test(url)) {
        priceSolHits.push(url);
      }
      if (/\/token\/trades\?mint=/.test(url)) {
        tradesHits.push(url);
      }
    });

    await gotoAndSettle(page, tradeUrl(MINTS.BONK));
    // 让 activity-board + mini-trade-flow + candlestick-chart 都挂载完
    await page.waitForTimeout(5000);

    // 同 mint /price/SOL 多组件并发 → cache + inflight 合并 = 1 次
    expect(priceSolHits.length).toBeLessThanOrEqual(1);

    // /token/trades 同 mint 跨组件应只 1 次(activity-board 100 + mini-flow 8 共享)
    // 注:30s 自动刷新 · 测试 5s 内不会触发第 2 次
    expect(tradesHits.length).toBeLessThanOrEqual(1);

    await page.screenshot({
      path: 'test-results/perf-dedup-bonk.png',
      fullPage: false,
    });
  });
});
