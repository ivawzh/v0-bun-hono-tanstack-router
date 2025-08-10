import { test, expect } from '@playwright/test';

test('home shows API status box', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('API Status')).toBeVisible();
});
