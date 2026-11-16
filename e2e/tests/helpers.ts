import { expect, type Page, type TestInfo } from '@playwright/test';

export async function fresh(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

/** Catches the Day bat the way each device would (Req 9: click, keyboard, or two taps). */
export async function catchBat(page: Page, info: TestInfo, via: 'pointer' | 'keyboard' = 'pointer') {
  await page.evaluate(() => window.scrollTo(0, 0));
  const bat = page.getByTestId('day-bat');
  await expect(bat).toBeVisible({ timeout: 10_000 });
  if (via === 'keyboard') {
    await bat.focus();
    await page.keyboard.press('Enter');
  } else if (info.project.use.hasTouch) {
    await bat.tap();
    await bat.tap();
  } else {
    await bat.hover();
    await expect(page.locator('.reaching-hand')).toBeVisible();
    await bat.click();
  }
  await expect(page.locator('html')).toHaveAttribute('data-state', 'haunted', { timeout: 10_000 });
  await expect(page.getByTestId('lunge')).toHaveCount(0, { timeout: 10_000 });
}

export async function add(page: Page, id: string) {
  const btn = page.getByTestId(`add-${id}`);
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
}

export async function openCart(page: Page) {
  await page.getByTestId('cart-icon').click();
  await expect(page.getByTestId('cart-drawer')).toBeVisible();
}
