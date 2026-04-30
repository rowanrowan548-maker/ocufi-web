/**
 * One-shot Phantom wallet setup for Playwright e2e — manual-assisted.
 *
 * What it does:
 *   1. Launches Chromium with the Phantom unpacked extension loaded.
 *   2. Discovers the extension ID and saves it to .cache/.
 *   3. Opens the Phantom onboarding page in front of you.
 *   4. Prints the AI test wallet's private key + step-by-step instructions
 *      to your terminal — you click through Phantom yourself (10 steps,
 *      ~2 minutes). Automating this proved too brittle across versions
 *      and locales (zh-CN button text, name-step heuristics, etc.).
 *   5. Waits for you to press Enter once the wallet dashboard is visible.
 *   6. Asks you for the password you set, saves it to .cache/ for the
 *      walletTest fixture's auto-unlock helper.
 *   7. Persists the user data dir so subsequent test runs reuse the unlocked
 *      profile.
 *
 * Run once:
 *   pnpm exec tsx qa/e2e/fixtures/setup-phantom.ts
 *
 * Reset (start over):
 *   rm -rf qa/e2e/.cache && pnpm exec tsx qa/e2e/fixtures/setup-phantom.ts
 *
 * Hard limits (per Tech Lead 2026-04-30):
 *   - This profile is for the AI test wallet only.
 *   - NEVER let it sign a real mainnet tx. Read-only + reject is the rule.
 */

import { chromium, type BrowserContext, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline/promises';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const EXT_DIR = path.join(ROOT, 'qa', 'e2e', 'fixtures', 'phantom-extension');
const CACHE_DIR = path.join(ROOT, 'qa', 'e2e', '.cache');
const USER_DATA_DIR = path.join(CACHE_DIR, 'playwright-user-data');
const PASSWORD_FILE = path.join(CACHE_DIR, 'phantom-password.txt');
const SECRETS_FILE = path.resolve(ROOT, '..', '.coordination', 'SECRETS.local.md');

function fail(msg: string): never {
  console.error(`\n[setup-phantom] FATAL: ${msg}\n`);
  process.exit(1);
}

function readSecret(): { address: string; privateKey: string } {
  if (!fs.existsSync(SECRETS_FILE)) {
    fail(
      `SECRETS.local.md not found at ${SECRETS_FILE} — copy from coordination repo first.`,
    );
  }
  const text = fs.readFileSync(SECRETS_FILE, 'utf8');
  // Match the "AI 测试钱包" section.  Tolerant to whitespace / formatting drift.
  const section = text.split(/^##\s+/m).find((s) => s.startsWith('AI 测试钱包'));
  if (!section) fail('AI 测试钱包 section not found in SECRETS.local.md');

  const addr = section.match(/地址[^`]*`([1-9A-HJ-NP-Za-km-z]{32,44})`/)?.[1];
  const key = section.match(/私钥[^`]*`([1-9A-HJ-NP-Za-km-z]{60,120})`/)?.[1];
  if (!addr || !key) {
    fail(
      `could not parse AI 测试钱包 address/private key. Section was:\n---\n${section.slice(0, 400)}\n---`,
    );
  }
  return { address: addr, privateKey: key };
}

function ensureExtensionPresent() {
  if (!fs.existsSync(path.join(EXT_DIR, 'manifest.json'))) {
    fail(
      `Phantom extension not found at ${EXT_DIR}/manifest.json.\n` +
        `Download the .crx from the Chrome Web Store, unpack it (it's just a zip),\n` +
        `and put the unpacked folder there. See qa/e2e/README.md → Phantom extension setup.`,
    );
  }
}

async function promptForPassword(rl: readline.Interface): Promise<string> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  if (fs.existsSync(PASSWORD_FILE)) {
    return fs.readFileSync(PASSWORD_FILE, 'utf8').trim();
  }
  let pw = '';
  while (pw.length < 8) {
    pw = (await rl.question('  你在 Phantom 里设的密码是? (≥ 8 字符): ')).trim();
    if (pw.length < 8) console.log('    ⚠ 太短 · Phantom 要求至少 8 字符 · 重输:');
  }
  fs.writeFileSync(PASSWORD_FILE, pw + '\n', { mode: 0o600 });
  return pw;
}

async function findExtensionId(context: BrowserContext, timeoutMs = 15_000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const sw of context.serviceWorkers()) {
      const m = sw.url().match(/^chrome-extension:\/\/([a-p]{32})\//);
      if (m) return m[1];
    }
    for (const bg of context.backgroundPages()) {
      const m = bg.url().match(/^chrome-extension:\/\/([a-p]{32})\//);
      if (m) return m[1];
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  fail(
    `extension service worker did not appear within ${timeoutMs}ms. ` +
      `Check that ${EXT_DIR} contains a valid unpacked Phantom build.`,
  );
}

async function waitForWelcomePage(context: BrowserContext, extId: string, timeoutMs = 20_000): Promise<Page> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const p = context.pages().find((pg) => pg.url().startsWith(`chrome-extension://${extId}/`));
    if (p) return p;
    await new Promise((r) => setTimeout(r, 250));
  }
  // Welcome page didn't auto-open — open onboarding.html directly (popup.html
  // shows a splash for first-time users that varies by build).
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extId}/onboarding.html`);
  return page;
}

// Note: we tried automating the Phantom welcome flow (clickByText + heuristics
// for name vs private-key vs password screens) but it broke across versions /
// locales (zh-CN button text, name-step required vs optional). Per Tech Lead
// 2026-04-30: just open the browser and let the human click through. Saves
// ~200 lines of brittle selectors and is faster end-to-end.

function printManualInstructions(secret: { address: string; privateKey: string }) {
  const bar = '═'.repeat(72);
  console.log(`\n${bar}`);
  console.log('  📋 你接下来在浏览器手动做这几步(我自动化太脆弱 · 你点比较快):');
  console.log(bar);
  console.log('');
  console.log('  1. 浏览器里点 "我已有一个钱包"(或英文 "I Already Have a Wallet")');
  console.log('  2. 选 "导入私钥"(或 "Import Private Key")');
  console.log('  3. 钱包名字随便填(比如 "AI Test")');
  console.log('  4. 私钥粘贴下面这串(已自动从 SECRETS.local.md 读出):');
  console.log('');
  console.log(`     ${secret.privateKey}`);
  console.log('');
  console.log('  5. 设个密码 · 至少 8 字符 · 记下来回头要回终端输一次');
  console.log('  6. 走完所有 next/继续 · 看到钱包主界面就算完成');
  console.log(`  7. 主界面应该显示这个地址(末 4 位 ${secret.address.slice(-4)}):`);
  console.log(`     ${secret.address}`);
  console.log('');
  console.log(bar);
  console.log('  ⚠️  这个钱包**只能用来读 + 模拟签** · 绝不能签真 mainnet 交易');
  console.log(bar);
  console.log('');
}

async function main() {
  ensureExtensionPresent();
  const secret = readSecret();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('[setup-phantom] launching headed Chromium with Phantom...');
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXT_DIR}`,
      `--load-extension=${EXT_DIR}`,
    ],
    viewport: { width: 1280, height: 800 },
  });

  try {
    const extId = await findExtensionId(context);
    console.log(`[setup-phantom] extension id: ${extId}`);
    fs.writeFileSync(path.join(CACHE_DIR, 'phantom-extension-id.txt'), extId + '\n');

    const page = await waitForWelcomePage(context, extId);
    await page.bringToFront();
    await page.waitForLoadState('domcontentloaded');

    printManualInstructions(secret);
    await rl.question('  > 全部走完看到钱包主界面后 · 回终端按 Enter 继续: ');

    const password = await promptForPassword(rl);

    console.log('');
    console.log(
      `[setup-phantom] ✅ DONE.\n` +
        `  浏览器 profile:  ${USER_DATA_DIR}\n` +
        `  Phantom 密码:    ${PASSWORD_FILE}(只本机可读)\n` +
        `  Extension ID:    ${extId}\n` +
        `  钱包地址:        ${secret.address}\n` +
        `\n` +
        `  这个 profile 已可被 walletTest fixture 复用 · /history 等钱包态测试能跑了。\n` +
        `  浏览器窗口关掉 · 回头跑 e2e 时会自动起一个新的(headed)。\n`,
    );
  } finally {
    rl.close();
    await context.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
