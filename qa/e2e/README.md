# QA · Playwright e2e (qa/e2e/)

Live-prod end-to-end tests run against `https://www.ocufi.io` (prelaunch lock
bypassed via `?preview=<key>` cookie). Independent of `tests/e2e/` (which targets
local dev server).

## Layout

```
qa/e2e/
├── playwright.config.ts        # 3 projects: desktop-1920 / iphone-14-pro / desktop-default
├── _helpers.ts                 # MINTS map, tradeUrl(), gotoAndSettle()
├── desktop-trade-1920.spec.ts  # T-OKX layout @ 1920×1080 · SOL/USDC/BONK + screenshot baselines
├── mobile-trade-iphone.spec.ts # T-977 series @ iPhone 14 Pro 393×852 · BONK + SOL + baselines
├── search-modal-click.spec.ts  # T-SEARCH-CLICK-FIX3/FIX4 · 2nd-click navigation regression
├── buysell-color.spec.ts       # T-BUYSELL-COLOR-FIX2 · emerald-700 / rose-700 (canvas-normalized rgb)
└── __snapshots__/              # baseline pngs · maxDiffPixelRatio 0.05
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
