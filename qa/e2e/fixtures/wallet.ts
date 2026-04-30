/**
 * Playwright fixture: walletTest
 *
 * Reuses the persistent profile created by `setup-phantom.ts`, so every
 * test starts with Phantom already imported. The fixture also exposes:
 *   - `extensionId` — Phantom's runtime ID (varies between unpacked builds)
 *   - `connectWallet(page)` — clicks the app's "Connect Wallet" button,
 *      handles the Phantom approval popup, and waits for the address to
 *      appear in the footer.
 *
 * Tests opt in by importing `walletTest` instead of `test`:
 *
 *   import { walletTest as test, expect } from './fixtures/wallet';
 *   test('history loads', async ({ page, connectWallet }) => {
 *     await page.goto('/');
 *     await connectWallet(page);
 *     await page.goto('/history?preview=aa112211');
 *     await expect(page.locator('table tr').first()).toBeVisible();
 *   });
 *
 * Hard limit: this wallet is for read-only flows + sim-sign + reject.
 * Do NOT write a test that signs a real mainnet tx with this profile.
 */

import { test as base, chromium, expect, type BrowserContext, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const EXT_DIR = path.join(ROOT, 'qa', 'e2e', 'fixtures', 'phantom-extension');
const CACHE_DIR = path.join(ROOT, 'qa', 'e2e', '.cache');
const USER_DATA_DIR = path.join(CACHE_DIR, 'playwright-user-data');
const PASSWORD_FILE = path.join(CACHE_DIR, 'phantom-password.txt');
const EXT_ID_FILE = path.join(CACHE_DIR, 'phantom-extension-id.txt');

type WalletFixtures = {
  context: BrowserContext;
  extensionId: string;
  connectWallet: (page: Page) => Promise<void>;
};

function ensureProfile() {
  if (!fs.existsSync(USER_DATA_DIR) || !fs.existsSync(PASSWORD_FILE)) {
    throw new Error(
      `Phantom profile missing. Run setup once:\n` +
        `  pnpm exec tsx qa/e2e/fixtures/setup-phantom.ts\n` +
        `Expected:\n  ${USER_DATA_DIR}\n  ${PASSWORD_FILE}`,
    );
  }
}

async function discoverExtensionId(context: BrowserContext, timeoutMs = 15_000): Promise<string> {
  if (fs.existsSync(EXT_ID_FILE)) {
    return fs.readFileSync(EXT_ID_FILE, 'utf8').trim();
  }
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const sw of context.serviceWorkers()) {
      const m = sw.url().match(/^chrome-extension:\/\/([a-p]{32})\//);
      if (m) return m[1];
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Could not discover Phantom extension id; service worker never started.');
}

async function maybeUnlock(context: BrowserContext, extensionId: string) {
  // After a long idle, Phantom auto-locks. Open its popup and enter the
  // password; if it's already unlocked the unlock screen won't render.
  const password = fs.readFileSync(PASSWORD_FILE, 'utf8').trim();
  const popup = await context.newPage();
  try {
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    const pw = popup.locator('input[type="password"]').first();
    if (await pw.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await pw.fill(password);
      const unlock = popup.getByRole('button', { name: /unlock|sign in/i }).first();
      if (await unlock.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await unlock.click();
      } else {
        await pw.press('Enter');
      }
      // Wait for the dashboard to render before we let the test proceed.
      await popup.waitForLoadState('networkidle').catch(() => undefined);
    }
  } finally {
    await popup.close().catch(() => undefined);
  }
}

async function connectWalletImpl(context: BrowserContext, extensionId: string, page: Page) {
  // 1. Click whichever "Connect Wallet" entry point is on screen.
  const triggers = [
    page.getByRole('button', { name: /connect wallet|connect|连接钱包/i }).first(),
    page.locator('[data-testid="connect-wallet"]').first(),
  ];
  let clicked = false;
  for (const t of triggers) {
    if (await t.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await t.click();
      clicked = true;
      break;
    }
  }
  if (!clicked) {
    throw new Error('Connect-wallet trigger not visible on the current page.');
  }

  // 2. The wallet adapter modal lists available wallets — pick Phantom.
  const phantomOption = page.getByRole('button', { name: /phantom/i }).first();
  await phantomOption.waitFor({ state: 'visible', timeout: 10_000 });
  // The popup is opened as a side effect of this click.
  const [popup] = await Promise.all([
    context.waitForEvent('page', { timeout: 15_000 }),
    phantomOption.click(),
  ]);

  // 3. Approve the connection in Phantom's popup.
  await popup.waitForLoadState('domcontentloaded').catch(() => undefined);
  const approve = popup.getByRole('button', { name: /connect|approve|continue/i }).first();
  await approve.waitFor({ state: 'visible', timeout: 15_000 });
  await approve.click();
  // Some flows show a second confirmation step.
  const second = popup.getByRole('button', { name: /confirm|approve/i }).first();
  if (await second.isVisible({ timeout: 1_500 }).catch(() => false)) {
    await second.click();
  }

  // 4. Verify the page now shows the wallet shortened address.
  //    AI test wallet → 72zX5u...EVg4w (first/last 4 of base58).
  await expect(
    page.getByText(/72zX|EVg4w/).first(),
  ).toBeVisible({ timeout: 15_000 });
}

export const walletTest = base.extend<WalletFixtures>({
  // Override the default browser/context — we need the persistent profile.
  context: async ({}, use) => {
    ensureProfile();
    const ctx = await chromium.launchPersistentContext(USER_DATA_DIR, {
      headless: false,
      args: [
        `--disable-extensions-except=${EXT_DIR}`,
        `--load-extension=${EXT_DIR}`,
      ],
      viewport: { width: 1280, height: 800 },
    });
    await use(ctx);
    await ctx.close();
  },
  page: async ({ context }, use) => {
    const page = context.pages()[0] ?? (await context.newPage());
    await use(page);
  },
  extensionId: async ({ context }, use) => {
    const id = await discoverExtensionId(context);
    await maybeUnlock(context, id);
    await use(id);
  },
  connectWallet: async ({ context, extensionId }, use) => {
    await use((page: Page) => connectWalletImpl(context, extensionId, page));
  },
});

export { expect };
