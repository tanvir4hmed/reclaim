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
    await expect(page.getByTestId('skeleton-hand')).toBeVisible();
    await bat.click();
  }
  // The Reveal takes under 4 s on a real GPU; software WebGL in CI is far slower.
  try {
    await expect(page.locator('html')).toHaveAttribute('data-state', 'haunted', { timeout: 20_000 });
  } catch (e) {
    const why = await page.evaluate(() => ({
      lunge: document.querySelector('[data-testid="lunge"]')?.className ?? 'none',
      bat: !!document.querySelector('[data-testid="day-bat"]'),
      phase: localStorage.getItem('reclaim:v1')?.match(/"phase":"(\w+)"/)?.[1] ?? 'unsaved',
      dialog: document.querySelector('dialog[open]')?.getAttribute('aria-label') ?? document.querySelector('dialog[open]')?.id ?? 'none',
      hidden: document.hidden,
    }));
    throw new Error(`Reveal did not finish: ${JSON.stringify(why)}\n${String(e)}`);
  }
  try {
    await expect(page.getByTestId('lunge')).toHaveCount(0, { timeout: 15_000 });
  } catch (e) {
    const step = await page.evaluate(() => document.querySelector('[data-testid="lunge"]')?.className ?? 'none');
    throw new Error(`The lunge did not end (step: ${step})\n${String(e)}`);
  }
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
