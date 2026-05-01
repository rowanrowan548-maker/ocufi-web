/**
 * One-shot seed script · populate the AI test wallet's /history with two
 * real swap rows so the slippage column has data to validate against.
 *
 * Why: Tech Lead 2026-04-30 — the smoke spec wallet-history-smoke.spec.ts
 * passes against an empty wallet (skips chain-detail check). To actually
 * verify the new 滑点 column on BUY + SELL rows, we need at least one
 * BUY row + one SELL row in the wallet's history. The cleanest way is
 * to drive ocufi-web's own swap UI in the SAME persistent profile so the
 * Jupiter quote gets persisted to localStorage too (slippage cell reads
 * that to compute realized bps).
 *
 * Run once (after ⛓️ T-ONCHAIN-QUOTE-DECIMALS + 🎨 T-FE-SLIPPAGE-BUY ship):
 *   pnpm exec tsx qa/e2e/fixtures/seed-swap-history.ts
 *
 * Hard limits (per Tech Lead 2026-04-30, user-authorized one-time):
 *   - AI test wallet only (72zX5utG…EVg4w · ~0.05 SOL balance).
 *   - Two small swaps: ~0.001 SOL each (~$0.20). Total cost: trade size +
 *     ~0.0002 SOL gas.
 *   - User signs each tx in the Phantom popup. We do NOT auto-approve sign
 *     prompts — that's a deliberate safety boundary.
 */

import { chromium } from '@playwright/test';
import * as readline from 'node:readline/promises';
import * as path from 'node:path';
import * as fs from 'node:fs';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const EXT_DIR = path.join(ROOT, 'qa', 'e2e', 'fixtures', 'phantom-extension');
const USER_DATA_DIR = path.join(ROOT, 'qa', 'e2e', '.cache', 'playwright-user-data');
const TRADE_URL = 'https://www.ocufi.io/trade?mint=USDC&preview=aa112211';

function fail(msg: string): never {
  console.error(`\n[seed-swap] FATAL: ${msg}\n`);
  process.exit(1);
}

function ensureProfile() {
  if (!fs.existsSync(EXT_DIR + '/manifest.json')) {
    fail(`Phantom extension missing at ${EXT_DIR}. Run setup-phantom.ts first.`);
  }
  if (!fs.existsSync(USER_DATA_DIR)) {
    fail(`AI wallet profile missing at ${USER_DATA_DIR}. Run setup-phantom.ts first.`);
  }
}

async function main() {
  ensureProfile();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('[seed-swap] launching browser with AI test wallet profile...');
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXT_DIR}`,
      `--load-extension=${EXT_DIR}`,
    ],
    viewport: { width: 1280, height: 800 },
  });

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(TRADE_URL, { waitUntil: 'domcontentloaded' });
    await page.bringToFront();

    const bar = '═'.repeat(72);
    console.log(`\n${bar}`);
    console.log('  📋 在打开的浏览器里做 2 笔小 swap · 各约 0.001 SOL');
    console.log(bar);
    console.log('');
    console.log('  💰 AI 测试钱包(72zX…EVg4w)有 ~0.05 SOL · 够做 50+ 笔');
    console.log('');
    console.log('  ─────── 第 1 步 · 买 USDC ───────');
    console.log('    1. 顶栏右上 · 看是否已显示 72zX… 地址(已连接 → 跳第 4 步)');
    console.log('    2. 没连 → 点 "Other wallets"');
    console.log('    3. 弹窗里点 "Phantom" → Phantom 弹窗点 "批准/连接"');
    console.log('    4. 主屏右栏切到 "买入" tab(默认就是)');
    console.log('    5. 数量填 0.001(SOL)');
    console.log('    6. 点 "买入 USDC" 按钮');
    console.log('    7. Phantom 弹窗 → 点 "批准/确认"(可能弹两次:setup + swap)');
    console.log('    8. 等几秒 · 等成功 toast');
    console.log('');
    console.log('  ─────── 第 2 步 · 卖 USDC ───────');
    console.log('    9. 右栏切 "卖出" tab');
    console.log('   10. 数量点 "全部" 或 100%');
    console.log('   11. 点 "卖出 USDC"');
    console.log('   12. Phantom 弹窗再批准一次');
    console.log('   13. 等成功 toast');
    console.log('');
    console.log(bar);
    console.log('  ⚠️ 总花费 = ~0.001 × 2 SOL trade size + ~0.0003 SOL gas ≈ $0.40');
    console.log('  ⚠️ 这是用户单独授权的真链上签名 · 仅限这两笔 · 别签别的');
    console.log(bar);
    console.log('');

    await rl.question('  > 2 笔都做完看到成功 toast 后按 Enter: ');

    // Quick sanity check: verify the wallet actually has swap activity by
    // jumping to /history and counting non-transfer rows. Don't fail — just
    // print the result so the human knows whether to run the smoke test next.
    await page.goto('https://www.ocufi.io/history?preview=aa112211', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
    const rowTypes = await page.locator('table tbody tr').evaluateAll((rows) =>
      rows
        .map((r) => (r.querySelector('td:nth-child(2)') as HTMLElement | null)?.innerText?.trim() ?? '')
        .filter(Boolean),
    );
    const swapRows = rowTypes.filter((t) => /买入|卖出|buy|sell/i.test(t));

    console.log('');
    console.log(`[seed-swap] /history 当前类型分布: ${JSON.stringify(rowTypes.slice(0, 10))}`);
    console.log(`[seed-swap] 检测到 ${swapRows.length} 笔 swap 行`);
    if (swapRows.length === 0) {
      console.log('[seed-swap] ⚠️ 没看到 swap 行 · 可能 tx 还在确认 · 或 swap 没成功');
      console.log('[seed-swap] 等 30s 再刷新 /history 看 · 或重跑这个脚本');
    } else {
      console.log('[seed-swap] ✅ swap 数据已落地 · 现在可以跑 smoke 自动验滑点列:');
      console.log('[seed-swap]   pnpm exec playwright test --config qa/e2e/playwright.config.ts --project=wallet-phantom');
    }
  } finally {
    rl.close();
    await context.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
