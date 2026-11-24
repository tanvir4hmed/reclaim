import { expect, test } from '@playwright/test';
import { add, catchBat, fresh } from './helpers';

const OUT = process.env.SHOTS_DIR;
const ONLY = process.env.SCARE_IDS?.split(',');

const IDS = [
  'letter',
  'cake',
  'photo-frame',
  'typewriter',
  'advent-calendar',
  'tin-soldier',
  'valve-radio',
  'unopened-gift',
  'rocking-chair',
  'snow-globe',
  'chocolate-box',
  'music-box',
  'glass-ornament',
  'candle',
  'teddy-bear',
  'shoes',
];

test.describe('visual capture of the Take scares', () => {
  test.skip(!OUT, 'set SHOTS_DIR to capture screenshots');

  test('every product has a scare when taken', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop only');
    test.setTimeout(300_000);
    await fresh(page);
    await catchBat(page, info);
    for (const id of ONLY ?? IDS) {
      // An ambient quirk sometimes puts a small item in the cart by itself; taking it again is "greedy".
      if ((await page.locator(`[data-product="${id}"] [data-testid="note-have"]`).count()) > 0) continue;
      await add(page, id);
      // Most Take events happen inside the product's own picture; give them time to play out.
      await page.waitForTimeout(id === 'valve-radio' ? 6500 : 2400);
      await page.screenshot({ path: `${OUT}/scare-${id}.jpeg`, type: 'jpeg', quality: 60, scale: 'css' });
      // Let the Stage clear before the next one (the shoes walk the longest).
      await page.waitForTimeout(id === 'shoes' ? 8000 : id === 'candle' ? 5000 : 1800);
      await expect(page.getByTestId('take-scare')).toHaveCount(0, { timeout: 20_000 });
    }
  });

  // Taken from the product view: every event must play right there, not after it is closed.
  const PV_IDS = ['shoes', 'instant-camera', 'glass-ornament', 'candle', 'teddy-bear', 'unopened-gift', 'chocolate-box', 'doll', 'telephone', 'pocket-watch', 'letter', 'mirror', 'tin-soldier'];

  test('Take events play inside the product view', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop only');
    test.setTimeout(600_000);
    await fresh(page);
    await catchBat(page, info);
    await page.waitForTimeout(3000);
    for (const id of process.env.PV_IDS?.split(',') ?? PV_IDS) {
      const link = page.locator(`.card[data-product="${id}"] .card-title a`);
      // Jump (no smooth scroll) so the card holds still, then click it.
      await link.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await page.waitForTimeout(800);
      await link.evaluate((el) => (el as HTMLElement).click());
      const view = page.getByTestId('product-view');
      // A slammed door or a held Stage can swallow the first try; only then, try once more
      // (clicking again while it is still opening would open it twice).
      // A view that is only slow to render has already changed the URL: clicking again then
      // would push a second entry, and Close would step back onto the same product.
      const opened = await page.waitForURL(`**/product/${id}**`, { timeout: 4000 }).then(() => true, () => false);
      if (!opened) await link.evaluate((el) => (el as HTMLElement).click());
      await expect(view).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(1500);
      // Before the take, twice, to see which way anything moving goes.
      await page.screenshot({ path: `${OUT}/pv-${id}-pre1.jpeg`, type: 'jpeg', quality: 60, scale: 'css' });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${OUT}/pv-${id}-pre2.jpeg`, type: 'jpeg', quality: 60, scale: 'css' });
      await page.getByTestId('pv-add').click();
      await page.waitForTimeout(id === 'teddy-bear' ? 250 : 900);
      await page.screenshot({ path: `${OUT}/pv-${id}-a.jpeg`, type: 'jpeg', quality: 60, scale: 'css' });
      await page.waitForTimeout(1800);
      await page.screenshot({ path: `${OUT}/pv-${id}-b.jpeg`, type: 'jpeg', quality: 60, scale: 'css' });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${OUT}/pv-${id}-d.jpeg`, type: 'jpeg', quality: 60, scale: 'css' });
      // The slow ones are still going: one more, later.
      if (['typewriter', 'advent-calendar', 'instant-camera', 'doll', 'chocolate-box', 'telephone'].includes(id)) {
        await page.waitForTimeout(4000);
        await page.screenshot({ path: `${OUT}/pv-${id}-e.jpeg`, type: 'jpeg', quality: 60, scale: 'css' });
      }
      if (id === 'candle') {
        await expect(page.getByTestId('candle-dark')).toBeVisible();
        await page.mouse.move(1380, 40);
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${OUT}/pv-candle-c.jpeg`, type: 'jpeg', quality: 60, scale: 'css' });
      }
      const before = await page.evaluate(() => `${location.pathname} h=${history.length} dialogs=${document.querySelectorAll('dialog[open]').length}`);
      await view.getByRole('button', { name: 'Close', exact: true }).click({ force: true });
      // Back to the whole haunted shop: slow to render on software WebGL.
      try {
        await expect(view).toHaveCount(0, { timeout: 15_000 });
      } catch (e) {
        const after = await page.evaluate(() => `${location.pathname} h=${history.length} dialogs=${document.querySelectorAll('dialog[open]').length}`);
        throw new Error(`${id}: the view did not close (before: ${before}; after: ${after})\n${String(e)}`);
      }
      if (id === 'candle') await expect(page.getByTestId('candle-dark')).toHaveCount(0, { timeout: 3000 });
      await page.waitForTimeout(id === 'shoes' ? 8000 : 2500);
    }
  });
});
