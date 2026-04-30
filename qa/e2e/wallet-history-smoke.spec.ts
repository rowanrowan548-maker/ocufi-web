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
  // The three new columns (成交价 / 优先费 / Gas) must contain real numbers
  // for at least one swap row. Transfer rows correctly show "—" for 成交价
  // (no swap → no quote price), so we filter for buy/sell rows first.
  // If the wallet has only transfer rows (e.g., the AI test wallet right after
  // funding), we skip the chain-detail assertion — connection + rendering
  // already passed, which is what this smoke test cares about.
  const headers = await page.locator('table thead th').allTextContents();
  const colIndex = (label: RegExp) => headers.findIndex((h) => label.test(h));
  const typeIdx = colIndex(/类型|type/i);
  expect(typeIdx, `"类型" column missing; got headers ${JSON.stringify(headers)}`).toBeGreaterThanOrEqual(0);

  const allRows = await page.locator('table tbody tr').all();
  let swapRowCells: string[] | null = null;
  for (const row of allRows) {
    const cells = await row.locator('td').allTextContents();
    const type = cells[typeIdx]?.trim() ?? '';
    if (/买入|卖出|buy|sell/i.test(type)) {
      swapRowCells = cells;
      break;
    }
  }

  if (!swapRowCells) {
    test.info().annotations.push({
      type: 'note',
      description: 'No swap rows in this wallet — skipped chain-detail column check (AI test wallet only has transfers).',
    });
    return;
  }

  for (const label of [/成交价|price/i, /优先费|priority/i, /gas|手续费/i]) {
    const i = colIndex(label);
    expect(i, `column "${label}" missing from history table; got headers ${JSON.stringify(headers)}`).toBeGreaterThanOrEqual(0);
    const cell = swapRowCells[i]?.trim() ?? '';
    expect(
      cell,
      `${label} column for first swap row was "${cell}" — chain detail not loaded`,
    ).not.toMatch(/^[—\-–\s]*$/);
  }
});
