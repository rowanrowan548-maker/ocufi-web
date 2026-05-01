import { defineConfig, devices } from '@playwright/test';

const PREVIEW_KEY = process.env.OCUFI_PREVIEW_KEY ?? 'aa112211';
const BASE_URL = process.env.OCUFI_BASE_URL ?? 'https://www.ocufi.io';

export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  snapshotPathTemplate: '{testDir}/__snapshots__/{arg}{ext}',
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.05 },
  },
  use: {
    baseURL: BASE_URL,
    extraHTTPHeaders: {},
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop-1920',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
      },
      testMatch: /desktop-(trade|search)-.*\.spec\.ts/,
    },
    {
      name: 'daily-smoke',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
      },
      testMatch: /daily-smoke\.spec\.ts/,
    },
    {
      name: 'regression-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
      },
      testMatch: /regression-pages\.spec\.ts/,
    },
    {
      name: 'regression-mobile',
      use: { ...devices['iPhone 14 Pro'] },
      testMatch: /regression-pages\.spec\.ts/,
    },
    {
      name: 'iphone-14-pro',
      use: { ...devices['iPhone 14 Pro'] },
      testMatch: /mobile-.*\.spec\.ts/,
    },
    {
      name: 'desktop-default',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /(search-modal-click|buysell-color)\.spec\.ts/,
    },
    {
      // Wallet specs override `context` themselves (persistent profile +
      // unpacked Phantom). The project just needs the right matcher and
      // a longer expect timeout — popups take time to appear.
      name: 'wallet-phantom',
      timeout: 180_000,
      use: { baseURL: BASE_URL },
      testMatch: /wallet-.*\.spec\.ts/,
    },
    {
      name: 'admin-smoke',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
      testMatch: /admin-smoke\.spec\.ts/,
    },
    {
      // Real-machine perf baseline against live prod. Numbers go to stdout
      // and are summarised in REPORTS/perf-stage2.md.
      name: 'perf-baseline',
      timeout: 180_000,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
      testMatch: /perf-baseline\.spec\.ts/,
    },
    {
      // Stubs the API via page.route — slower than baseline specs because of
      // the timeout case (~17s wait to trigger the AbortController path).
      name: 'error-degradation',
      timeout: 90_000,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
      testMatch: /error-degradation\.spec\.ts/,
    },
    {
      name: 'user-reported-bugs',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
      testMatch: /user-reported-bugs-.*\.spec\.ts/,
    },
    {
      // T-QA-FULLSITE-DEEP-AUDIT 阶段 2 · 14 页 + /trade × 4 mint 非数据维度。
      // 数据维度(audit-card 真填 / 9 chip 数据 / 持币地址 数据 / search modal 真出
      // 结果 / markets tab 真有数据)用 test.fixme 占位 · BUG-046 修后激活。
      name: 'fullsite-deep-audit',
      timeout: 120_000,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
      testMatch: /fullsite-deep-audit\.spec\.ts/,
    },
  ],
});

export { PREVIEW_KEY, BASE_URL };
