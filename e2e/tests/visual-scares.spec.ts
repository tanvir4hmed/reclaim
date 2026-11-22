import { expect, test } from '@playwright/test';
import { add, catchBat, fresh } from './helpers';

const OUT = process.env.SHOTS_DIR;
const ONLY = process.env.SCARE_IDS?.split(',');

const IDS = [
  'pocket-watch',
  'typewriter',
  'valve-radio',
  'letter',
  'cake',
  'unopened-gift',
  'advent-calendar',
  'music-box',
  'instant-camera',
  'glass-ornament',
  'candle',
  'mittens',
  'snow-globe',
  'teddy-bear',
  'tin-soldier',
  'photo-frame',
  'chocolate-box',
  'shoes',
  // Last: the phone keeps ringing in the cart for 20 s and holds the Stage while it does.
  'telephone',
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
      const layer = page.getByTestId('take-scare');
      await expect(layer).toBeVisible({ timeout: id === 'shoes' ? 15_000 : 8_000 });
      await page.waitForTimeout(1900);
      await page.screenshot({ path: `${OUT}/scare-${id}.jpeg`, type: 'jpeg', quality: 55, scale: 'css' });
      await expect(layer).toHaveCount(0, { timeout: 25_000 });
    }
  });
});
