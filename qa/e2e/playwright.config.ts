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
  ],
});

export { PREVIEW_KEY, BASE_URL };
