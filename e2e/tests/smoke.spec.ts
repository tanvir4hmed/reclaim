import { expect, test } from '@playwright/test';

test('the day shop loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Reclaim & Co\. Holiday Market/);
  await expect(page.getByRole('heading', { name: /Reclaim & Co\. Holiday Market/ })).toBeVisible();
});
