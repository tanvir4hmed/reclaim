import { expect, test } from '@playwright/test';
import { add, fresh, openCart } from './helpers';

test.beforeEach(async ({ page }) => fresh(page));

test('search, category, product view, cart and the paused Day checkout (Req 3–6, 22.1)', async ({ page }) => {
  const search = page.getByRole('searchbox', { name: 'Search the shop' });
  await search.fill('pocket watch');
  await expect(page.getByTestId('product-grid').getByRole('article')).toHaveCount(1);
  if (test.info().project.use.hasTouch) await search.fill('');
  else await search.press('Escape');
  await expect(page.getByTestId('product-grid').getByRole('article')).not.toHaveCount(1);

  await page.getByRole('button', { name: /Sweets/ }).first().click();
  await expect(page).toHaveURL(/cat=sweets/);
  await expect(page.getByTestId('product-grid').getByRole('article')).toHaveCount(2);

  await page.getByRole('link', { name: 'Festive Truffle Box, 24' }).click();
  const view = page.getByTestId('product-view');
  // The first product view on a cold dev server compiles every product model (software WebGL).
  await expect(view).toBeVisible({ timeout: 15_000 });
  await expect(view.getByRole('button', { name: /Inspect/ })).toBeVisible();
  await view.getByTestId('pv-add').click();
  await page.keyboard.press('Escape');
  await expect(view).toBeHidden();

  await openCart(page);
  await expect(page.getByTestId('line-chocolate-box')).toBeVisible();
  await expect(page.getByTestId('cart-total')).toHaveText('$29.00');
  await page.getByTestId('cart-drawer').getByRole('button', { name: 'Increase quantity' }).click();
  await expect(page.getByTestId('cart-total')).toHaveText('$58.00');
  await page.getByTestId('checkout').click();
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /gift wrap/ })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Place order' })).toBeDisabled();
  await expect(page.getByText(/Payments are paused/)).toBeVisible();
});

test('the cart survives a reload (Req 6.3)', async ({ page }) => {
  await add(page, 'candle');
  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.getByTestId('cart-icon')).toHaveAccessibleName(/1 item/);
});

test('works by keyboard alone: search, open a product, add it', async ({ page }, info) => {
  test.skip(!!info.project.use.hasTouch, 'keyboard flow is for desktop projects');
  await page.getByRole('searchbox', { name: 'Search the shop' }).focus();
  await page.keyboard.type('mirror');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('product-grid').getByRole('article')).toHaveCount(1);
  const link = page.getByRole('link', { name: 'Gilded Hall Mirror' });
  await expect(link).toBeVisible();
  await link.focus();
  await expect(link).toBeFocused();
  await page.keyboard.press('Enter');
  // The first product view on a cold dev server compiles every product model (software WebGL).
  await expect(page.getByTestId('product-view')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('pv-add').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('cart-icon')).toHaveAccessibleName(/1 item/);
});

test('Add to cart is confirmed, and stock limits answer back (Req 6.1)', async ({ page }) => {
  await add(page, 'candle');
  const candle = page.locator('[data-product="candle"]');
  // Right after the click the line says "1 added. 1 in your cart."; a few seconds later it
  // settles to "You have 1 in your cart." Either way it is under the button.
  await expect(candle.locator('[data-testid^="note-"]')).toContainText('1 in your cart');
  // The pocket watch says "Only 1 left": a second one is refused, under its own button.
  await add(page, 'pocket-watch');
  await add(page, 'pocket-watch');
  await expect(page.locator('[data-product="pocket-watch"]').getByTestId('note-greedy')).toBeVisible();
  await expect(page.getByTestId('cart-icon')).toHaveAccessibleName(/2 items/);
});
