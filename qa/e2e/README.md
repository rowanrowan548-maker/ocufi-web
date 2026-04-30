# QA · Playwright e2e (qa/e2e/)

> **🚨 AI 测试钱包安全规则 · 所有人必读**
>
> The AI test wallet (`72zX5u…EVg4w`, profile under `qa/e2e/.cache/`)
> is **read-only + sim-sign only**. Connect, read state, reject popups —
> never approve a real mainnet transaction with this profile, not even
> dust. Real-tx verification is the user's job. Violation → stop and
> report Tech Lead immediately.

Live-prod end-to-end tests run against `https://www.ocufi.io` (prelaunch lock
bypassed via `?preview=<key>` cookie). Independent of `tests/e2e/` (which targets
local dev server).

## Layout

```
qa/e2e/
├── playwright.config.ts          # 7 projects (desktop / mobile / regression / wallet)
├── _helpers.ts                   # MINTS map, tradeUrl(), gotoAndSettle()
├── desktop-trade-1920.spec.ts    # T-OKX layout @ 1920×1080 · SOL/USDC/BONK + baselines
├── mobile-trade-iphone.spec.ts   # T-977 series @ iPhone 14 Pro 393×852 · BONK + SOL + baselines
├── search-modal-click.spec.ts    # T-SEARCH-CLICK-FIX3/FIX4 · 2nd-click navigation regression
├── buysell-color.spec.ts         # T-BUYSELL-COLOR-FIX2 · emerald-700 / rose-700 (canvas rgb)
├── daily-smoke.spec.ts           # T-QA-DAILY-SMOKE · 8 desktop pages @ 1920
├── regression-pages.spec.ts      # T-QA-REG-001 · 7 pages × desktop+mobile
├── wallet-history-smoke.spec.ts  # T-QA-PHANTOM-EXT-SETUP · /history with AI test wallet
├── fixtures/
│   ├── setup-phantom.ts          # one-shot: import wallet into persistent profile
│   ├── wallet.ts                 # walletTest fixture · connectWallet helper
│   └── phantom-extension/        # gitignored · user supplies unpacked extension
└── __snapshots__/                # baseline pngs · maxDiffPixelRatio 0.05
```

## Run locally

Prereq once: `pnpm install` and `pnpm exec playwright install chromium`.

```bash
# all qa specs (3 projects, 4 specs)
pnpm exec playwright test --config qa/e2e/playwright.config.ts

# one spec
pnpm exec playwright test --config qa/e2e/playwright.config.ts qa/e2e/desktop-trade-1920.spec.ts

# update baselines after intentional UI change
pnpm exec playwright test --config qa/e2e/playwright.config.ts --update-snapshots

# pick a different preview key (when prelaunch cookie rotates)
OCUFI_PREVIEW_KEY=newkey pnpm exec playwright test --config qa/e2e/playwright.config.ts

# point at a different env (e.g. preview deployment)
OCUFI_BASE_URL=https://staging.ocufi.io pnpm exec playwright test --config qa/e2e/playwright.config.ts
```

## Phantom extension setup (one-time, per machine)

The `wallet-phantom` project drives a real Phantom extension with the AI
test wallet imported. First-time setup is manual because Phantom doesn't
ship a programmatic install path.

1. **Get the unpacked extension.** Easiest route:

   ```bash
   # Install Phantom in your normal Chrome, then copy the unpacked dir:
   cp -R "$HOME/Library/Application Support/Google/Chrome/Default/Extensions/bfnaelmomeimhlpmgjnjophhpkkoljpa/<version>" \
         qa/e2e/fixtures/phantom-extension
   ```

   Or download the `.crx` from the Chrome Web Store (it's a zip with a
   header) and unpack it with `unzip` into `qa/e2e/fixtures/phantom-extension/`.
   The folder is in `.gitignore` — never commit the binary.

2. **Run the one-shot importer.** A headed Chromium will open, drive the
   Phantom welcome flow, and persist the unlocked profile to
   `qa/e2e/.cache/playwright-user-data/`:

   ```bash
   pnpm exec tsx qa/e2e/fixtures/setup-phantom.ts
   ```

   Reads the AI test wallet base58 secret from
   `~/.openclaw/workspace-taizi/.coordination/SECRETS.local.md` (the
   "AI 测试钱包" section). A random password lands in
   `qa/e2e/.cache/phantom-password.txt`.

3. **Run the smoke spec** to verify everything is wired:

   ```bash
   pnpm exec playwright test --config qa/e2e/playwright.config.ts \
     --project wallet-phantom
   ```

### Reset the profile

If Phantom updates and breaks the unlock flow, or the wallet adapter is
acting up, nuke the cache and re-import:

```bash
rm -rf qa/e2e/.cache && pnpm exec tsx qa/e2e/fixtures/setup-phantom.ts
```

### Writing a new wallet-aware spec

```ts
import { walletTest as test, expect } from './fixtures/wallet';

test('rewards page · wallet connected', async ({ page, connectWallet }) => {
  await page.goto('/?preview=aa112211');
  await connectWallet(page);
  await page.goto('/rewards?preview=aa112211');
  await expect(page.getByText(/MEV reclaim/i)).toBeVisible();
});
```

The fixture handles persistent context, extension load, auto-unlock, and
the Phantom approval popup. Spec just calls `connectWallet(page)`.

## Baseline policy

- Diff threshold: `maxDiffPixelRatio: 0.05` (5%) — set globally in `playwright.config.ts`.
- Canvas (chart) regions are masked in `desktop-trade-*` and `mobile-trade-*` so
  K-line ticks don't trigger false diffs.
- After any ship that intentionally changes layout: re-run with
  `--update-snapshots`, eyeball the new png in `__snapshots__/`, commit.
- On a real diff: the failing spec dumps `test-results/.../actual.png` +
  `diff.png` next to the baseline — attach to the bug report.

## CI integration (future · not wired yet)

Playwright ships a first-party GitHub Action: `microsoft/playwright-github-action`.
Plan:

1. `actions/setup-node` + `pnpm install`.
2. `pnpm exec playwright install --with-deps chromium`.
3. `pnpm exec playwright test --config qa/e2e/playwright.config.ts`.
4. Upload `test-results/` and `playwright-report/` as artifacts.
5. Trigger: `pull_request` on `main` and on a daily cron (catches drift on the
   live preview deploy).

Do NOT wire it up yet — the live-prod target makes CI flaky against transient
RPC / GeckoTerminal blips. Gate on a stable preview deployment first.

## Known caveats

- **Live-prod data**: trending list / chart values are real and change. Tests
  only assert *structural* things (element existence, layout dims, computed
  colors). Visible numbers are masked or asserted against ranges.
- **Color tolerance ±25**: Tailwind v4 ships oklch palette; Chromium's lab→sRGB
  canvas conversion can drift up to ~18/255 on saturated red. Spec text said
  ±10 but that's tighter than the rendering pipeline gives — see comment in
  `buysell-color.spec.ts`. Bumped to ±25 once palette went transparent
  (FIX3, emerald-300 / rose-300 text on transparent bg).
- **First-click navigation regression history**: pre-FIX5 the very first click
  on a freshly-hydrated `/trade` was swallowed by a React #418 hydration
  mismatch (root cause: `phantom-connect.ts` module-level constant differed
  between SSR and CSR). FIX5 (`5da794c`) made the constant a single literal
  string — both clicks now navigate cleanly. The spec asserts both clicks; if
  it ever regresses, that's the canary.
- **No `tests/e2e/` overlap**: those run against `pnpm dev --port 3100` and
  use a separate `playwright.config.ts` at repo root. Don't merge configs.
