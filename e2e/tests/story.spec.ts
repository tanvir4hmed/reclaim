import { expect, test } from '@playwright/test';
import { add, catchBat, fresh, openCart } from './helpers';

test.beforeEach(async ({ page }) => fresh(page));

test('only the bat starts the Reveal, and the Reveal keeps the cart (Req 8.6, 10.2)', async ({ page }, info) => {
  await add(page, 'letter');
  await page.waitForTimeout(500);
  await expect(page.locator('html')).toHaveAttribute('data-state', 'day');
  await catchBat(page, info);
  await expect(page.getByRole('heading', { level: 1, name: 'Everything Must Go' })).toBeVisible();
  await expect(page.getByTestId('cart-icon')).toHaveAccessibleName(/1 item/);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'haunted');
});

test('the bat can be caught by keyboard (Req 8.7, 9.11)', async ({ page }, info) => {
  test.skip(!!info.project.use.hasTouch, 'desktop only');
  await catchBat(page, info, 'keyboard');
});

test('consequences leave lasting marks (Req 12–21)', async ({ page }, info) => {
  test.setTimeout(90_000);
  await catchBat(page, info);

  await add(page, 'pocket-watch');
  await expect(page.getByTestId('shop-clock')).toHaveAttribute('data-direction', '-1');

  await add(page, 'shoes');
  // Bloody prints, inside the shoes' own card and nowhere else on the page.
  await expect(page.locator('.card[data-product="shoes"] [data-testid="shoe-prints"]')).toBeAttached();
  await expect(page.locator('.print, .decal-footprint, .decal-footprint-r')).toHaveCount(0);

  await page.getByTestId('letter-open').click();
  await expect(page.getByTestId('sorry')).toHaveText('Sorry.');

  await add(page, 'telephone');
  await openCart(page);
  await expect(page.getByTestId('call-ringing')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('answer').click();
  await expect(page.getByTestId('call-subtitles')).toBeVisible();
  await page.keyboard.press('Escape');

  // Lasting after reload.
  await page.waitForTimeout(12_000);
  await page.reload();
  await expect(page.getByTestId('shop-clock')).toHaveAttribute('data-direction', '-1');
  await expect(page.locator('.card[data-product="shoes"] [data-testid="shoe-prints"]')).toBeAttached();
});

test('haunted search summons a product that was never in the shop (Req 32.8)', async ({ page }, info) => {
  await catchBat(page, info);
  await page.getByRole('searchbox', { name: 'Search the shop' }).fill('home');
  const grid = page.getByTestId('product-grid');
  await expect(grid.getByRole('article')).toHaveCount(1);
  await expect(grid.getByRole('heading', { name: /Child’s Drawing of Home/ })).toBeVisible();
});

test('checkout: closing time, decline, accept, ending and echo (Req 22, 23, 38)', async ({ page }, info) => {
  test.setTimeout(90_000);
  await catchBat(page, info);
  await add(page, 'letter');
  await openCart(page);
  await page.getByTestId('checkout').click();
  await expect(page.getByTestId('closing-time')).toBeVisible();
  await page.getByTestId('skip-closing').click();
  await expect(page.getByTestId('accept')).toBeVisible({ timeout: 15_000 });

  await page.getByTestId('decline').click();
  // Back to the whole haunted shop: on software WebGL (CI, a loaded machine) that render can
  // take longer than the default 5 s.
  await expect(page.getByRole('heading', { level: 1, name: 'Everything Must Go' })).toBeVisible({ timeout: 15_000 });

  await openCart(page);
  await page.getByTestId('checkout').click();
  // Closing time plays only once.
  await expect(page.getByTestId('accept')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('accept')).toBeDisabled();
  await page.getByRole('radio', { name: 'Your first snow' }).check();
  await expect(page.getByTestId('accept')).toBeDisabled();
  await page.getByTestId('agree').check();
  await page.getByTestId('accept').click();
  await expect(page.getByTestId('accepted')).toHaveText('Your order has been accepted.');

  await expect(page.locator('html')).toHaveAttribute('data-state', 'day', { timeout: 15_000 });
  await expect(page.getByRole('heading', { level: 1, name: 'Gifts for everyone coming home' })).toBeVisible();
  await expect(page.getByTestId('hero-echo')).toContainText('Unsent Letter');
  await expect(page.getByTestId('cart-icon')).toHaveAccessibleName(/0 items/);
  await expect(page.getByTestId('receipt-link')).toBeVisible();
  await page.getByTestId('receipt-link').click();
  await expect(page.getByRole('heading', { name: 'Receipt' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Confirmshaming' })).toBeVisible();
});

test('after the Reveal there is only one of each, and asking for more is greedy', async ({ page }, info) => {
  await catchBat(page, info);
  await add(page, 'candle');
  const candle = page.locator('[data-product="candle"]');
  await expect(candle.getByTestId('note-added')).toContainText('yours now');
  await add(page, 'candle');
  await expect(candle.getByTestId('note-greedy')).toContainText(/greedy|only ever one|already/i);
});
