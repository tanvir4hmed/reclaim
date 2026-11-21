import { expect, test } from '@playwright/test';

const OUT = process.env.SHOTS_DIR;

test.describe('visual capture', () => {
  test.skip(!OUT, 'set SHOTS_DIR to capture screenshots');

  test('day shop, product view, catch and haunted shop', async ({ page }, info) => {
    test.setTimeout(90_000);
    const name = (n: string) => `${OUT}/${info.project.name}-${n}.png`;
    await page.goto('/');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: name('1-day') });
    await page.locator('#shop').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await page.screenshot({ path: name('2-grid') });
    await page.getByRole('link', { name: 'Heirloom Pocket Watch' }).click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: name('3-product') });
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    const bat = page.getByTestId('day-bat');
    await expect(bat).toBeVisible();
    await bat.hover();
    await page.waitForTimeout(500);
    await page.screenshot({ path: name('4-hover') });
    await bat.click();
    // Rapid low-cost frames through the catch and lunge.
    for (let i = 0; i < 10; i++) {
      await page.screenshot({ path: name(`5-catch-${i}`), type: 'jpeg', quality: 45, scale: 'css' });
    }
    await page.waitForTimeout(3500);
    await page.screenshot({ path: name('6-haunted') });
    await page.locator('#shop').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await page.screenshot({ path: name('7-haunted-grid') });
  });
});
