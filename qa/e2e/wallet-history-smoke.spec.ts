import { walletTest as test, expect } from './fixtures/wallet';
import { PREVIEW_KEY } from './_helpers';

/**
 * T-QA-PHANTOM-EXT-SETUP step 4 · smoke verifies the full chain works:
 *   AI test wallet imported → connect → /history loads → table has data.
 *
 * Doubles as live verification for T-HISTORY-CHAIN-DETAIL-FE: the three
 * new columns (成交价 / 优先费 / Gas) must show real numbers, not "—".
 *
 * Run only after `pnpm exec tsx qa/e2e/fixtures/setup-phantom.ts`.
 */

const HISTORY_URL = `/history?preview=${PREVIEW_KEY}`;

// Headed (extension) tests are slow — bump per-test timeout.
test.setTimeout(180_000);

test('connect wallet · /history renders table with chain detail', async ({
  page,
  connectWallet,
}) => {
  // Land on /trade first so wallet adapter is mounted.
  await page.goto(`/trade?preview=${PREVIEW_KEY}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2_000);

  await connectWallet(page);

  // After connect, navigate to /history.
  await page.goto(HISTORY_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);

  // Table renders.
  const firstRow = page.locator('table tbody tr').first();
  await expect(firstRow).toBeVisible({ timeout: 30_000 });

  // Snapshot the table region (mask volatile cells like timestamps).
  await expect(page.locator('table')).toHaveScreenshot('wallet/history-table.png', {
    animations: 'disabled',
    caret: 'hide',
    mask: [page.locator('[data-volatile]'), page.locator('time')],
    maxDiffPixelRatio: 0.05,
  });

  // T-HISTORY-CHAIN-DETAIL-FE assertion:
  // The three new columns must contain something other than "—" / "-" /
  // empty for at least the first data row.  We grep cell text instead of
  // depending on column index (header order may shift).
  const headers = await page.locator('table thead th').allTextContents();
  const rowCells = await firstRow.locator('td').allTextContents();
  const colIndex = (label: RegExp) => headers.findIndex((h) => label.test(h));

  for (const label of [/成交价|price/i, /优先费|priority/i, /gas|手续费/i]) {
    const i = colIndex(label);
    expect(i, `column "${label}" missing from history table; got headers ${JSON.stringify(headers)}`).toBeGreaterThanOrEqual(0);
    const cell = rowCells[i]?.trim() ?? '';
    expect(
      cell,
      `${label} column for first row was "${cell}" — chain detail not loaded`,
    ).not.toMatch(/^[—\-–\s]*$/);
  }
});
