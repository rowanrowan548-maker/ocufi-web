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
      name: 'iphone-14-pro',
      use: { ...devices['iPhone 14 Pro'] },
      testMatch: /mobile-.*\.spec\.ts/,
    },
    {
      name: 'desktop-default',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /(search-modal-click|buysell-color)\.spec\.ts/,
    },
  ],
});

export { PREVIEW_KEY, BASE_URL };
