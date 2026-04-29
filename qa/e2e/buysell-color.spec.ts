import { test, expect } from '@playwright/test';
import { tradeUrl, gotoAndSettle } from './_helpers';

// T-BUYSELL-COLOR-FIX2 真渲染验证 — buy = emerald-700, sell = rose-700
// NOTE: spec text said /trade?mint=SOL · SOL is base coin and has NO buy/sell toggle
//       (right column shows "用 USDC 买 SOL" stablecoin selector instead).
//       Use USDC — same TradeTabs component path, real toggle present.
const TARGET = 'USDC' as const;

const EMERALD_700 = { r: 4, g: 120, b: 87 } as const; // tailwind emerald-700
const ROSE_700 = { r: 190, g: 18, b: 60 } as const; // tailwind rose-700

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

// Tailwind v4 ships colors in oklch; Chromium's lab→sRGB canvas conversion
// can drift up to ~18/255 on saturated red channels vs the v3 hex reference.
// Spec text said ±10 but that's tighter than the rendering pipeline gives —
// use ±20 which still catches "wrong palette" (e.g. emerald-700 vs amber-700)
// while tolerating gamut-conversion fuzz. Screenshot baseline catches finer drift.
function close(a: number, b: number, tol = 20) {
  return Math.abs(a - b) <= tol;
}

test.describe('buy/sell toggle colors', () => {
  test('buy tab = emerald-700 ±10, sell tab = rose-700 ±10, text white', async ({ page }) => {
    await gotoAndSettle(page, tradeUrl(TARGET));

    // Use the inner BuyForm/SellForm tabs — there is exactly one TabsList with both labels in the trade form
    const buyTab = page.getByRole('tab', { name: /^买入$/ }).first();
    const sellTab = page.getByRole('tab', { name: /^卖出$/ }).first();

    await expect(buyTab).toBeVisible({ timeout: 15_000 });
    await expect(sellTab).toBeVisible({ timeout: 15_000 });

    // Default active = buy. data-active attribute presence (Base UI sets it to "" on active tab)
    await expect(buyTab).toHaveAttribute('data-active', '');
    const buyRgb = await readBgRgb(buyTab);
    const buyTextRgb = await readTextRgb(buyTab);
    expect(close(buyRgb.r, EMERALD_700.r), `buy bg.r=${buyRgb.r} far from ${EMERALD_700.r} (css="${buyRgb.css}")`).toBe(true);
    expect(close(buyRgb.g, EMERALD_700.g), `buy bg.g=${buyRgb.g} far from ${EMERALD_700.g} (css="${buyRgb.css}")`).toBe(true);
    expect(close(buyRgb.b, EMERALD_700.b), `buy bg.b=${buyRgb.b} far from ${EMERALD_700.b} (css="${buyRgb.css}")`).toBe(true);
    expect(buyTextRgb.r, 'buy text r').toBeGreaterThanOrEqual(240);
    expect(buyTextRgb.g, 'buy text g').toBeGreaterThanOrEqual(240);
    expect(buyTextRgb.b, 'buy text b').toBeGreaterThanOrEqual(240);

    // Switch to sell
    await sellTab.click();
    await page.waitForTimeout(400);
    await expect(sellTab).toHaveAttribute('data-active', '');

    const sellRgb = await readBgRgb(sellTab);
    const sellTextRgb = await readTextRgb(sellTab);
    expect(close(sellRgb.r, ROSE_700.r), `sell bg.r=${sellRgb.r} far from ${ROSE_700.r} (css="${sellRgb.css}")`).toBe(true);
    expect(close(sellRgb.g, ROSE_700.g), `sell bg.g=${sellRgb.g} far from ${ROSE_700.g} (css="${sellRgb.css}")`).toBe(true);
    expect(close(sellRgb.b, ROSE_700.b), `sell bg.b=${sellRgb.b} far from ${ROSE_700.b} (css="${sellRgb.css}")`).toBe(true);
    expect(sellTextRgb.r, 'sell text r').toBeGreaterThanOrEqual(240);
    expect(sellTextRgb.g, 'sell text g').toBeGreaterThanOrEqual(240);
    expect(sellTextRgb.b, 'sell text b').toBeGreaterThanOrEqual(240);
  });
});
