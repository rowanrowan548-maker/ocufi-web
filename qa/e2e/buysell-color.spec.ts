import { test, expect } from '@playwright/test';
import { tradeUrl, gotoAndSettle } from './_helpers';

// T-BUYSELL-COLOR-FIX3 渲染验证 — buy = 透明深绿底 + emerald-300 文字 / sell = 透明深红底 + rose-300 文字
// USDC 页有真 buy/sell tab(SOL 走 "用 USDC 买 SOL" 特殊分支)
const TARGET = 'USDC' as const;

const EMERALD_300 = { r: 110, g: 231, b: 183 } as const; // tailwind emerald-300
const ROSE_300 = { r: 253, g: 164, b: 175 } as const; // tailwind rose-300

// Browsers may serialize computed colors as lab() / oklch() — normalize via canvas
async function readBgRgb(handle: import('@playwright/test').Locator) {
  return handle.evaluate((el) => {
    const css = getComputedStyle(el).backgroundColor;
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return { r, g, b, a, css };
  });
}

async function readTextRgb(handle: import('@playwright/test').Locator) {
  return handle.evaluate((el) => {
    const css = getComputedStyle(el).color;
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return { r, g, b, a, css };
  });
}

// Tailwind v4 oklch + canvas conversion 偏差 ±20 内
function close(a: number, b: number, tol = 25) {
  return Math.abs(a - b) <= tol;
}

test.describe('buy/sell toggle colors', () => {
  test.setTimeout(120_000);
  test('buy active = emerald-300 文字 + 透明绿底; sell active = rose-300 文字 + 透明红底', async ({ page }) => {
    await gotoAndSettle(page, tradeUrl(TARGET));

    // 多语言:zh "买入"/"卖出" · en "Buy"/"Sell" · trade-tabs 第一组 TabsList 是 buy/sell
    // role=tab 在桌面 trade-tabs 内 · USDC 页右栏首个 TabsList(buy/sell)+ 第二个(market/limit)
    const allTabs = page.locator('[role="tab"]:visible');
    await expect(allTabs.first()).toBeVisible({ timeout: 15_000 });
    const buyTab = allTabs.nth(0);
    const sellTab = allTabs.nth(1);

    await expect(sellTab).toBeVisible({ timeout: 15_000 });

    // Default active = buy · base-ui Tab 在 active 时挂 data-active=""
    await expect(buyTab).toHaveAttribute('data-active', '');
    const buyTextRgb = await readTextRgb(buyTab);
    const buyBgRgb = await readBgRgb(buyTab);

    // 文字色 = emerald-300 family
    expect(
      close(buyTextRgb.r, EMERALD_300.r) &&
        close(buyTextRgb.g, EMERALD_300.g) &&
        close(buyTextRgb.b, EMERALD_300.b),
      `buy text expected emerald-300 (${EMERALD_300.r},${EMERALD_300.g},${EMERALD_300.b}), got rgba(${buyTextRgb.r},${buyTextRgb.g},${buyTextRgb.b}) css="${buyTextRgb.css}"`,
    ).toBe(true);

    // 背景:透明 emerald 在黑底上 ≈ 0.15 × emerald-500(16,185,129)= ≈(2,28,19)
    // 必须 g > b > r 形成绿色调,且亮度低(透明感)
    expect(
      buyBgRgb.g > buyBgRgb.r + 5 && buyBgRgb.b > 0 && buyBgRgb.g < 100,
      `buy bg expected 透明绿 (g>r, low brightness), got rgba(${buyBgRgb.r},${buyBgRgb.g},${buyBgRgb.b}) css="${buyBgRgb.css}"`,
    ).toBe(true);

    // Switch to sell · dispatchEvent 绕过 dev server actionability
    await sellTab.dispatchEvent('click');
    await page.waitForTimeout(400);
    await expect(sellTab).toHaveAttribute('data-active', '');

    const sellTextRgb = await readTextRgb(sellTab);
    const sellBgRgb = await readBgRgb(sellTab);

    // 文字色 = rose-300 family
    expect(
      close(sellTextRgb.r, ROSE_300.r) &&
        close(sellTextRgb.g, ROSE_300.g) &&
        close(sellTextRgb.b, ROSE_300.b),
      `sell text expected rose-300 (${ROSE_300.r},${ROSE_300.g},${ROSE_300.b}), got rgba(${sellTextRgb.r},${sellTextRgb.g},${sellTextRgb.b}) css="${sellTextRgb.css}"`,
    ).toBe(true);

    // 背景:透明 rose 在黑底上 ≈ 0.15 × rose-500(244,63,94)= ≈(36,9,14)
    // r > g, r > b 形成红色调,且亮度低
    expect(
      sellBgRgb.r > sellBgRgb.g + 5 && sellBgRgb.r < 100,
      `sell bg expected 透明红 (r>g, low brightness), got rgba(${sellBgRgb.r},${sellBgRgb.g},${sellBgRgb.b}) css="${sellBgRgb.css}"`,
    ).toBe(true);
  });
});
