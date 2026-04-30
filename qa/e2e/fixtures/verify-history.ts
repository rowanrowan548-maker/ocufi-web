/**
 * One-shot verification · launches the AI test wallet profile and checks
 * /history's four columns (成交价 / 滑点 / 优先费 / Gas) all light up.
 *
 * Run after seed-swap-history.ts has populated the wallet with at least
 * one buy + one sell:
 *   pnpm exec tsx qa/e2e/fixtures/verify-history.ts
 *
 * Output:
 *   - Console table of column status per row (✅ / —)
 *   - Screenshot saved to qa/e2e/.cache/verify-history-{timestamp}.png
 */

import { chromium } from '@playwright/test';
import * as path from 'node:path';
import * as fs from 'node:fs';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const EXT_DIR = path.join(ROOT, 'qa', 'e2e', 'fixtures', 'phantom-extension');
const CACHE_DIR = path.join(ROOT, 'qa', 'e2e', '.cache');
const USER_DATA_DIR = path.join(CACHE_DIR, 'playwright-user-data');
const HISTORY_URL = 'https://www.ocufi.io/history?preview=aa112211';

async function main() {
  console.log('[verify-history] launching AI wallet profile...');
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    args: [`--disable-extensions-except=${EXT_DIR}`, `--load-extension=${EXT_DIR}`],
    viewport: { width: 1440, height: 900 },
  });

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    console.log(`[verify-history] navigating to ${HISTORY_URL} ...`);
    await page.goto(HISTORY_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);

    // Wait for the table to render at least one row.
    await page.locator('table tbody tr').first().waitFor({ state: 'visible', timeout: 30_000 });

    // Allow lazy-loaded fee/gas cells to settle.
    await page.waitForTimeout(5_000);

    const headers = await page.locator('table thead th').allTextContents();
    console.log(`\n[verify-history] headers: ${JSON.stringify(headers)}`);

    const allRows = await page.locator('table tbody tr').all();
    console.log(`[verify-history] ${allRows.length} rows visible\n`);

    const colIdx = (label: RegExp) => headers.findIndex((h) => label.test(h));
    const idxType = colIdx(/类型|type/i);
    const idxPrice = colIdx(/成交价|price/i);
    const idxSlip = colIdx(/滑点|slippage/i);
    const idxFee = colIdx(/优先费|priority/i);
    const idxGas = colIdx(/^gas|手续费/i);

    function tag(cell: string): string {
      if (!cell || /^[—\-–\s]*$/.test(cell)) return '—';
      return cell.trim();
    }

    console.log('row | type    | 成交价        | 滑点      | 优先费       | Gas         ');
    console.log('----|---------|---------------|-----------|--------------|-------------');
    let i = 0;
    let buySellSeen = 0;
    let allFourLitOnSwap = 0;
    for (const row of allRows.slice(0, 12)) {
      const cells = await row.locator('td').allTextContents();
      const t = cells[idxType]?.trim() ?? '';
      const p = tag(cells[idxPrice] ?? '');
      const s = tag(cells[idxSlip] ?? '');
      const f = tag(cells[idxFee] ?? '');
      const g = tag(cells[idxGas] ?? '');
      console.log(`${String(++i).padStart(3)} | ${t.padEnd(7)} | ${p.padEnd(13)} | ${s.padEnd(9)} | ${f.padEnd(12)} | ${g}`);
      if (/买入|卖出|buy|sell/i.test(t)) {
        buySellSeen++;
        if (p !== '—' && f !== '—' && g !== '—') allFourLitOnSwap++;
      }
    }

    console.log('');
    console.log(`[verify-history] swap 行总数: ${buySellSeen}`);
    console.log(`[verify-history] 三列(成交价/优先费/Gas)全亮的 swap 行: ${allFourLitOnSwap}`);
    console.log(`[verify-history] 滑点列亮 → 看上面表 row 的"滑点"格 (有数=亮 / —=没量到)`);

    const shotPath = path.join(CACHE_DIR, `verify-history-${Date.now()}.png`);
    await page.locator('table').screenshot({ path: shotPath });
    console.log(`\n[verify-history] 截图: ${shotPath}`);

    fs.writeFileSync(
      path.join(CACHE_DIR, 'verify-history-summary.txt'),
      `headers: ${JSON.stringify(headers)}\nrows: ${allRows.length}\nswap_rows: ${buySellSeen}\nfully_lit_swap: ${allFourLitOnSwap}\n`,
      'utf8',
    );
  } finally {
    await context.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
