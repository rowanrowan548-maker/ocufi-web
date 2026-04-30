/**
 * One-shot Phantom wallet setup for Playwright e2e.
 *
 * What it does:
 *   1. Launches Chromium with the Phantom unpacked extension loaded.
 *   2. Discovers the extension ID from the service-worker URL (won't be the
 *      production hash; unpacked extensions get a key derived from the
 *      manifest "key" field — see below).
 *   3. Drives the Phantom welcome flow:
 *        a. "I already have a wallet" → "Import private key"
 *        b. Pastes the AI test wallet base58 secret read from
 *           ../../../.coordination/SECRETS.local.md
 *        c. Sets a random password (saved to .cache/phantom-password.txt)
 *        d. Confirms ToS / done
 *   4. Persists the user data dir at qa/e2e/.cache/playwright-user-data/.
 *      Subsequent test runs reuse this profile so the wallet is already
 *      unlocked (until the auto-lock timer fires — see wallet.ts fixture).
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
 *
 * If a UI selector breaks (Phantom updates often), fail fast with a clear
 * message — do NOT silently retry. Tech Lead will decide whether to patch
 * the selector or fall back to the wallet-adapter mock path.
 */

import { chromium, type BrowserContext, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

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

function getOrCreatePassword(): string {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  if (fs.existsSync(PASSWORD_FILE)) {
    return fs.readFileSync(PASSWORD_FILE, 'utf8').trim();
  }
  const pw = crypto.randomBytes(16).toString('base64url');
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

async function clickByText(page: Page, candidates: string[], opts: { timeout?: number } = {}) {
  const timeout = opts.timeout ?? 15_000;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    for (const text of candidates) {
      // Build a case-insensitive substring regex from the text candidate.
      const safe = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(safe, 'i');

      // 1) ARIA button role (most stable, works for <button> and role="button").
      const byRole = page.getByRole('button', { name: re });
      if (await byRole.first().isVisible().catch(() => false)) {
        await byRole.first().click();
        return text;
      }
      // 2) Link role (some Phantom screens use anchors styled as buttons).
      const byLink = page.getByRole('link', { name: re });
      if (await byLink.first().isVisible().catch(() => false)) {
        await byLink.first().click();
        return text;
      }
      // 3) Plain text fallback (case-insensitive via getByText).
      const byText = page.getByText(re).first();
      if (await byText.isVisible().catch(() => false)) {
        await byText.click();
        return text;
      }
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  // Diagnostic dump before failing — write HTML + screenshot + visible-text outline
  // so we can patch selectors quickly when Phantom changes the welcome flow.
  await dumpDiagnostics(page, `clickByText-fail-${Date.now()}`).catch(() => undefined);
  fail(`none of these buttons appeared within ${timeout}ms: ${candidates.join(' | ')}`);
}

async function dumpDiagnostics(page: Page, label: string): Promise<void> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const htmlPath = path.join(CACHE_DIR, `${label}.html`);
  const pngPath = path.join(CACHE_DIR, `${label}.png`);
  const outlinePath = path.join(CACHE_DIR, `${label}.outline.txt`);
  try {
    const html = await page.content();
    fs.writeFileSync(htmlPath, html, 'utf8');
  } catch {}
  try {
    await page.screenshot({ path: pngPath, fullPage: true });
  } catch {}
  try {
    // Outline of every visible button / link / clickable text element
    const outline = await page.evaluate(() => {
      const out: string[] = [];
      const tags = ['button', 'a', '[role="button"]', '[role="link"]', '[type="submit"]'];
      for (const sel of tags) {
        document.querySelectorAll(sel).forEach((el) => {
          const text = (el as HTMLElement).innerText?.trim() || '';
          const aria = el.getAttribute('aria-label') || '';
          const dataTestId = el.getAttribute('data-testid') || '';
          if (text || aria || dataTestId) {
            out.push(`<${el.tagName.toLowerCase()}> "${text.slice(0, 80)}" aria="${aria}" data-testid="${dataTestId}"`);
          }
        });
      }
      const url = window.location.href;
      const title = document.title;
      return `URL: ${url}\nTITLE: ${title}\n\nCLICKABLES:\n${out.join('\n')}`;
    });
    fs.writeFileSync(outlinePath, outline, 'utf8');
  } catch {}
  console.error(`\n[setup-phantom] DIAGNOSTIC dump:`);
  console.error(`  HTML     → ${htmlPath}`);
  console.error(`  PNG      → ${pngPath}`);
  console.error(`  OUTLINE  → ${outlinePath}`);
  console.error(`  Share the OUTLINE file with Tech Lead — it has every visible button/link.\n`);
}

// Soft variant: returns null if no candidate appears within `timeout` (does not exit the process).
async function tryClickByText(
  page: Page,
  candidates: string[],
  opts: { timeout?: number } = {},
): Promise<string | null> {
  const timeout = opts.timeout ?? 4_000;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    for (const text of candidates) {
      const safe = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(safe, 'i');
      for (const loc of [
        page.getByRole('button', { name: re }),
        page.getByRole('link', { name: re }),
        page.getByText(re),
      ]) {
        if (await loc.first().isVisible().catch(() => false)) {
          await loc.first().click();
          return text;
        }
      }
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

async function fillFirstVisible(page: Page, selector: string, value: string, opts: { timeout?: number } = {}) {
  const timeout = opts.timeout ?? 10_000;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const inputs = await page.locator(selector).all();
    for (const el of inputs) {
      if (await el.isVisible().catch(() => false)) {
        await el.fill(value);
        return;
      }
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  await dumpDiagnostics(page, `fillFirstVisible-fail-${Date.now()}`).catch(() => undefined);
  fail(`no visible input matched ${selector} within ${timeout}ms`);
}

// Find the first visible empty input/textarea (any type) and fill it.
// Used when we don't know the placeholder text or label and just want to
// fill the next form field that's waiting for input.
async function fillFirstEmpty(page: Page, value: string, opts: { timeout?: number; types?: string[] } = {}) {
  const timeout = opts.timeout ?? 10_000;
  const types = opts.types ?? ['textarea', 'input[type="text"]', 'input[type="password"]', 'input:not([type])'];
  const selector = types.join(', ');
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const inputs = await page.locator(selector).all();
    for (const el of inputs) {
      if (!(await el.isVisible().catch(() => false))) continue;
      if (await el.isDisabled().catch(() => false)) continue;
      const current = await el.inputValue().catch(() => '');
      if (current.length > 0) continue; // skip already-filled fields
      await el.fill(value);
      return;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  await dumpDiagnostics(page, `fillFirstEmpty-fail-${Date.now()}`).catch(() => undefined);
  fail(`no visible empty input found within ${timeout}ms (types: ${types.join('|')})`);
}

async function importWallet(page: Page, secret: { privateKey: string }, password: string) {
  // Step 0 (optional): a splash / "Get Started" screen on some builds. Best-effort, ok if absent.
  await tryClickByText(page, ['Get Started', 'Get started', '开始', '开始使用'], { timeout: 3_000 });

  // Step 1: "I Already Have a Wallet" / "Use Existing Wallet" / 我已有一个钱包 / etc.
  // Phantom localizes by Chrome locale — keep both English and Chinese candidates.
  await clickByText(page, [
    'I Already Have a Wallet',
    'Already Have a Wallet',
    'Use Existing Wallet',
    'Import an existing wallet',
    'Import Wallet',
    '我已有一个钱包',
    '我已有钱包',
    '导入钱包',
    '使用现有钱包',
  ]);

  // Step 2: pick the import method (we want private key, not seed phrase).
  await clickByText(page, [
    'Import Private Key',
    'Private Key',
    'Use Private Key',
    'Import a Solana private key',
    '导入私钥',
    '私钥',
  ]);

  // Step 3: Some flows show a wallet-name screen before the private-key screen.
  // We can't rely on placeholder text (varies by locale + version) so we look for
  // the first visible empty input/textarea on the current page. If a "继续/Next"
  // button is enabled afterward, we treat it as the name step; otherwise it's
  // the private-key step and we move on.
  // Strategy: peek at the page — if it has only a single short text input visible,
  // assume name step. Try-fill name + try-click next. If the next page still has
  // an empty input, it's the private-key step.
  const visibleEmptyCount = async () => {
    const inputs = await page
      .locator('textarea, input[type="text"], input[type="password"], input:not([type])')
      .all();
    let n = 0;
    for (const el of inputs) {
      if (!(await el.isVisible().catch(() => false))) continue;
      if ((await el.inputValue().catch(() => '')).length === 0) n++;
    }
    return n;
  };

  // Wait until at least one empty input is visible (the page rendered).
  for (let i = 0; i < 30; i++) {
    if ((await visibleEmptyCount()) > 0) break;
    await new Promise((r) => setTimeout(r, 200));
  }

  // Heuristic: if there's exactly ONE empty text input AND no textarea, it's the name step.
  const textareaCount = await page.locator('textarea').count();
  const emptyCount = await visibleEmptyCount();
  if (textareaCount === 0 && emptyCount === 1) {
    await fillFirstEmpty(page, 'AI Test Wallet');
    await clickByText(page, ['Continue', 'Next', '继续', '下一步', 'Import', '导入']);
  }

  // Step 4: paste the base58 secret. Use fillFirstEmpty so we don't try to fill
  // the name field again if it's still on the page; the secret field is usually
  // a textarea but we accept any empty text input.
  await fillFirstEmpty(page, secret.privateKey);
  await clickByText(page, ['Import', 'Continue', 'Next', '导入', '继续', '下一步']);

  // Password creation (some flows show two fields, some one).
  await fillFirstVisible(page, 'input[type="password"]', password);
  // Try to fill a confirm field if it exists.
  const pwInputs = await page.locator('input[type="password"]').all();
  if (pwInputs.length >= 2) {
    await pwInputs[1].fill(password);
  }

  // Accept ToS checkbox if present.
  const tos = page.locator('input[type="checkbox"]').first();
  if (await tos.isVisible().catch(() => false)) {
    await tos.check().catch(() => undefined);
  }

  await clickByText(page, ['Continue', 'Submit', 'Save', 'Done', 'Finish', '继续', '提交', '保存', '完成']);

  // Wait for the "all done" / dashboard screen.  Selectors vary by version,
  // so we just wait for either a "Got it" / "Finish" button or a balance UI.
  await Promise.race([
    page.getByRole('button', { name: /got it|finish|done|完成|知道了|开始/i }).first().waitFor({ timeout: 15_000 }).catch(() => {}),
    page.getByText(/SOL|balance|余额/i).first().waitFor({ timeout: 15_000 }).catch(() => {}),
  ]);
  await tryClickByText(page, ['Got it', 'Finish', 'Done', '完成', '知道了', '开始'], { timeout: 5_000 });
}

async function main() {
  ensureExtensionPresent();
  const secret = readSecret();
  const password = getOrCreatePassword();

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

    console.log('[setup-phantom] importing AI test wallet...');
    await importWallet(page, secret, password);

    console.log(
      `[setup-phantom] DONE.\n` +
        `  user data:   ${USER_DATA_DIR}\n` +
        `  password:    ${PASSWORD_FILE}\n` +
        `  extension id: ${extId}\n` +
        `  wallet addr: ${secret.address}\n`,
    );
  } finally {
    await context.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
