import { test, expect } from '@playwright/test';
import { gotoAndSettle, PREVIEW_KEY } from './_helpers';

/**
 * T-QA-OVERNIGHT-REGRESSION-2026-04-30 step 3 · /admin smoke
 *
 * Validates the three card panels render only when an admin key is supplied,
 * without asserting any of the (highly volatile) numbers they show.
 *
 * Cases:
 *   1. /admin (no key)        → "需要管理员密码" prompt + Lock icon
 *   2. /admin?key=invalid     → "连接失败" error card (backend rejects)
 *   3. /admin?key=$ADMIN_KEY  → fee-revenue + trade-volume + bi-metrics cards
 *
 * The third case is skipped when ADMIN_KEY env is absent (CI / shared dev),
 * so this spec is safe to ship without committing the secret.
 */

const ADMIN_KEY = process.env.ADMIN_KEY?.trim();

function adminUrl(query: string = '') {
  const sep = query ? '&' : '';
  return `/admin?preview=${PREVIEW_KEY}${sep}${query}`;
}

test.describe('admin smoke · auth gate + card render', () => {
  test.setTimeout(60_000);

  test('no key · password prompt visible', async ({ page }) => {
    await gotoAndSettle(page, adminUrl());
    await expect(page.getByText('需要管理员密码')).toBeVisible();
    // The card explains how to pass the key.
    await expect(page.getByText('/admin?key=')).toBeVisible();
    // Three data-testid cards must NOT render in the locked state.
    await expect(page.locator('[data-testid="admin-fee-revenue-card"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="admin-trade-volume-card"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="admin-bi-metrics-card"]')).toHaveCount(0);
  });

  test('invalid key · backend rejects with error card', async ({ page }) => {
    await gotoAndSettle(page, adminUrl('key=__definitely_not_a_real_key__'));
    // Backend returns 401/403 → frontend swaps to error state.
    await expect(page.getByText('连接失败')).toBeVisible({ timeout: 15_000 });
    // No data cards should render when auth fails.
    await expect(page.locator('[data-testid="admin-fee-revenue-card"]')).toHaveCount(0);
  });

  test('valid key · 3 dashboard cards render', async ({ page }) => {
    test.skip(!ADMIN_KEY, 'ADMIN_KEY env not set — skipping authenticated /admin smoke');

    await gotoAndSettle(page, adminUrl(`key=${encodeURIComponent(ADMIN_KEY!)}`));

    // Stats fetch is async; allow time for the first poll to land.
    await expect(page.locator('[data-testid="admin-fee-revenue-card"]')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator('[data-testid="admin-trade-volume-card"]')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator('[data-testid="admin-bi-metrics-card"]')).toBeVisible({
      timeout: 30_000,
    });

    // Sanity-check the card titles render — values are intentionally not asserted
    // since fee revenue / volume / BI numbers shift continuously.
    await expect(page.getByText(/费用收入/)).toBeVisible();
  });
});
