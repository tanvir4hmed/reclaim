import { expect, test } from '@playwright/test';

test('the day shop loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Reclaim & Co\. Holiday Market/);
  await expect(page.getByRole('heading', { level: 1, name: /Gifts for everyone coming home/ })).toBeVisible();
});
