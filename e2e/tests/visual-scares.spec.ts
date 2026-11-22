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
});
