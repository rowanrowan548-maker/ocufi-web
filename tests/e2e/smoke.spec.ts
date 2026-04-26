import { test, expect } from '@playwright/test';

test('landing renders Ocufi hero copy', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Ocufi/);
  await expect(page.locator('body')).toContainText('Ocufi');
});
