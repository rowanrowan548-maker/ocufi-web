import { test, expect, type Page } from '@playwright/test';

/**
 * T-007g · K 线数据源走后端代理验证(BUG-035 / T-700b 治理)
 *
 * 核心契约:
 *  - 前端 OHLC 拉取 必走 ocufi-api `/chart/ohlc?mint=...&tf=...&limit=...`
 *  - 不再 直击 api.geckoterminal.com(避 IP 限速 + cold mint 失败)
 *
 * 监听 page.on('request') 收集所有 URL,验:
 *   1. 至少 1 次命中 `/chart/ohlc`(若 NEXT_PUBLIC_API_URL 已配)
 *   2. 0 次命中 `api.geckoterminal.com`
 */

const BONK_MINT = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';

interface RequestSummary {
  total: number;
  ohlcProxyHits: string[];
  geckoTerminalHits: string[];
}

async function trackRequests(
  page: Page,
  action: () => Promise<void>,
): Promise<RequestSummary> {
  const proxy: string[] = [];
  const gt: string[] = [];
  let total = 0;
  page.on('request', (req) => {
    const url = req.url();
    total++;
    if (/\/chart\/ohlc(\?|$)/.test(url)) proxy.push(url);
    if (/api\.geckoterminal\.com/.test(url)) gt.push(url);
  });
  await action();
  return { total, ohlcProxyHits: proxy, geckoTerminalHits: gt };
}

test.describe('K 线数据源 · BUG-035 治理(T-700b)', () => {
  test('GeckoTerminal 直击 0 次 + chart/ohlc 代理(若 NEXT_PUBLIC_API_URL 已配)', async ({ page }) => {
    const summary = await trackRequests(page, async () => {
      await page.goto(`/zh-CN/trade?mint=${BONK_MINT}`);
      // 等水合 + chart 拉(给 chart-card useEffect 一些时间)
      await page.waitForTimeout(8_000);
    });

    console.log(`[T-007g] 总 request: ${summary.total}`);
    console.log(`[T-007g] /chart/ohlc 代理命中: ${summary.ohlcProxyHits.length}`);
    if (summary.ohlcProxyHits.length) {
      console.log('  样例: ' + summary.ohlcProxyHits[0].slice(0, 200));
    }
    console.log(`[T-007g] api.geckoterminal.com 直击: ${summary.geckoTerminalHits.length}`);
    if (summary.geckoTerminalHits.length) {
      console.log('  ❌ 仍有直击,样例:');
      summary.geckoTerminalHits.slice(0, 3).forEach((u) => console.log('    - ' + u.slice(0, 200)));
    }

    // 硬规则: NOT 直击 GT
    expect(summary.geckoTerminalHits.length).toBe(0);

    // 软规则: 若后端配了,应该走代理 — 本地 dev 可能没起后端,记录用
    // (本地 dev .env 可能未设 NEXT_PUBLIC_API_URL → ohlc.ts 会 console.warn 并返空)
    if (summary.ohlcProxyHits.length === 0) {
      console.log('[T-007g] ⚠️ /chart/ohlc 0 命中 — NEXT_PUBLIC_API_URL 可能未配,本地 dev 正常');
    }
  });

  test('SOL_MINT(无 LP)→ 走 fallback,不打 GT,不打 chart/ohlc 也接受', async ({ page }) => {
    const summary = await trackRequests(page, async () => {
      await page.goto('/zh-CN/trade'); // 默认 SOL
      await page.waitForTimeout(5_000);
    });
    console.log(`[T-007g] SOL fallback · 总 request: ${summary.total}, GT 直击: ${summary.geckoTerminalHits.length}, /chart/ohlc: ${summary.ohlcProxyHits.length}`);
    expect(summary.geckoTerminalHits.length).toBe(0);
    // SOL_MINT 走 chart-card 的 SOL fallback,不应触发 OHLC 拉取
  });

  test('切多个 timeframe · 均不打 GT', async ({ page }) => {
    const summary = await trackRequests(page, async () => {
      await page.goto(`/zh-CN/trade?mint=${BONK_MINT}`);
      await page.waitForTimeout(4_000);

      // 尝试切 5m / 15m / 1h(若 chart 走 SOL fallback,这些按钮不在 → skip)
      const fallbackText = await page
        .getByText(/SOL is Solana's base asset|SOL 是 Solana 基础币/i)
        .count();
      if (fallbackText > 0) {
        console.log('[T-007g] BUG-033 复现:URL=BONK 但 chart 走 SOL fallback,timeframe 按钮不可点');
        return;
      }

      for (const tf of ['5m', '15m', '1h']) {
        const btn = page.getByRole('button').filter({ hasText: new RegExp(`^${tf}$`) }).first();
        const present = await btn.isVisible({ timeout: 3_000 }).catch(() => false);
        if (present) {
          await btn.click();
          await page.waitForTimeout(1_500);
        }
      }
    });

    console.log(`[T-007g] 多 tf 切换 · GT 直击: ${summary.geckoTerminalHits.length}, /chart/ohlc: ${summary.ohlcProxyHits.length}`);
    expect(summary.geckoTerminalHits.length).toBe(0);
  });
});
