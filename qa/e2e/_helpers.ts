import type { Page } from '@playwright/test';

export const PREVIEW_KEY = process.env.OCUFI_PREVIEW_KEY ?? 'aa112211';

export const MINTS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
} as const;

export type MintKey = keyof typeof MINTS;

export function tradeUrl(mint: MintKey | string, key = PREVIEW_KEY) {
  const m = (MINTS as Record<string, string>)[mint] ?? mint;
  return `/trade?mint=${m}&preview=${key}`;
}

export async function gotoAndSettle(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(1500);
}
