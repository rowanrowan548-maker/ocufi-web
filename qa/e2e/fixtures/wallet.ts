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
      const unlock = popup.getByRole('button', { name: /unlock|sign in|解锁|登录/i }).first();
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
  // Short-circuit: if the wallet is already connected (persistent profile
  // remembers approvals across test runs), the top bar shows the AI test
  // wallet's shortened address (72zX…EVg4w) instead of the connect buttons.
  const alreadyConnected = page.getByText(/72zX|EVg4w/).first();
  if (await alreadyConnected.isVisible({ timeout: 2_000 }).catch(() => false)) {
    return;
  }

  // ocufi-web shows two top-bar entry points side by side:
  //   1) "Phantom Connect"  → @phantom/react-sdk SDK (phantom.com web flow,
  //      no extension popup) — DON'T click this for the AI test wallet.
  //   2) "Other wallets"    → standard wallet-adapter modal that lists the
  //      installed Phantom extension. THIS is the path that triggers the
  //      extension popup we approve below.
  // Both screens may also have a generic "Connect Wallet" trigger on /history
  // and other pages — try that first if present, then fall back to "Other wallets".
  const otherWalletsTrigger = page.getByRole('button', { name: /^other wallets$|其他钱包/i }).first();
  const genericConnect = page.getByRole('button', { name: /^connect wallet$|^连接钱包$/i }).first();
  const dataTestIdConnect = page.locator('[data-testid="connect-wallet"]').first();

  let clicked = false;
  for (const t of [otherWalletsTrigger, genericConnect, dataTestIdConnect]) {
    if (await t.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await t.click();
      clicked = true;
      break;
    }
  }
  if (!clicked) {
    throw new Error(
      'Wallet entry point not visible. Expected one of: "Other wallets" / "Connect Wallet" / [data-testid="connect-wallet"].',
    );
  }

  // Wait for the @solana/wallet-adapter-react-ui modal to mount (rendered in
  // a portal at body level — has class "wallet-adapter-modal").
  const modal = page.locator('.wallet-adapter-modal').first();
  await modal.waitFor({ state: 'visible', timeout: 10_000 }).catch(async () => {
    // Save a screenshot so we can see what actually rendered.
    const dump = `qa/e2e/.cache/connect-modal-fail-${Date.now()}.png`;
    await page.screenshot({ path: dump, fullPage: true }).catch(() => undefined);
    throw new Error(`wallet-adapter modal did not appear after clicking "Other wallets". Screenshot: ${dump}`);
  });

  // Inside the modal, find the Phantom row. The standard wallet-adapter-react-ui
  // markup is `<li><button>...Phantom <span>Detected</span></button></li>`, so the
  // button accessible name is usually "Phantom Detected" or just "Phantom".
  // Scope to the modal so we don't accidentally re-click the top-bar buttons.
  const phantomOption = modal.getByRole('button', { name: /phantom/i }).first();
  await phantomOption.waitFor({ state: 'visible', timeout: 10_000 });
  // The popup is opened as a side effect of this click.
  const [popup] = await Promise.all([
    context.waitForEvent('page', { timeout: 15_000 }),
    phantomOption.click(),
  ]);

  // 3. Approve the connection in Phantom's popup.
  await popup.waitForLoadState('domcontentloaded').catch(() => undefined);

  // 3a. Race: either the popup shows a password input (locked) or an approve
  // button (unlocked + ready to connect). React inside the popup needs ~3-5s
  // to mount on a cold start, so we wait up to 12s for one of them to appear.
  const popupPw = popup.locator('input[type="password"]').first();
  const approveRegex = /^(connect|approve|continue|trust|连接|批准|继续|信任|确认)$/i;
  const approveButton = () => popup.getByRole('button', { name: approveRegex }).first();

  const sawPassword = await Promise.race([
    popupPw.waitFor({ state: 'visible', timeout: 12_000 }).then(() => 'password' as const).catch(() => null),
    approveButton().waitFor({ state: 'visible', timeout: 12_000 }).then(() => 'approve' as const).catch(() => null),
  ]);

  if (sawPassword === 'password') {
    const password = fs.readFileSync(PASSWORD_FILE, 'utf8').trim();
    await popupPw.fill(password);
    const unlockBtn = popup
      .getByRole('button', { name: /unlock|sign in|解锁|登录/i })
      .first();
    if (await unlockBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await unlockBtn.click();
    } else {
      await popupPw.press('Enter');
    }
    // Wait for unlock to clear and approve screen to render.
    await popupPw.waitFor({ state: 'hidden', timeout: 8_000 }).catch(() => undefined);
  } else if (sawPassword === null) {
    const dump = `qa/e2e/.cache/connect-popup-blank-${Date.now()}.png`;
    await popup.screenshot({ path: dump, fullPage: true }).catch(() => undefined);
    throw new Error(`Phantom popup never showed password OR approve. Screenshot: ${dump}`);
  }

  // 3b. Now wait for the approve button (whether we just unlocked or it was
  // already unlocked and we won the first race).
  try {
    await approveButton().waitFor({ state: 'visible', timeout: 15_000 });
  } catch (err) {
    const dump = `qa/e2e/.cache/connect-popup-fail-${Date.now()}.png`;
    await popup.screenshot({ path: dump, fullPage: true }).catch(() => undefined);
    throw new Error(
      `Phantom popup never showed an approve button. Screenshot: ${dump}\nOriginal: ${(err as Error).message}`,
    );
  }
  await approveButton().click();
  // Some flows show a second confirmation step.
  const second = popup
    .getByRole('button', { name: /confirm|approve|确认|批准/i })
    .first();
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
