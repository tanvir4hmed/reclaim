import { expect, test } from '@playwright/test';
import { add, catchBat, fresh } from './helpers';

const OUT = process.env.SHOTS_DIR;
const ONLY = process.env.SCARE_IDS?.split(',');

const IDS = [
  'letter',
  'photo-frame',
  'typewriter',
  'advent-calendar',
  'television',
  'unopened-gift',
  'rocking-chair',
  'snow-globe',
  'chocolate-box',
  'music-box',
  'hourglass',
  'sleigh',
  'oil-lamp',
  'jack-in-the-box',
  'nutcracker',
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
      await page.waitForTimeout(id === 'television' ? 3000 : 2400);
      await page.screenshot({ path: `${OUT}/scare-${id}.jpeg`, type: 'jpeg', quality: 60, scale: 'css' });
      // Let the Stage clear before the next one (the shoes walk the longest).
      await page.waitForTimeout(id === 'shoes' ? 8000 : id === 'candle' ? 5000 : 1800);
      await expect(page.getByTestId('take-scare')).toHaveCount(0, { timeout: 20_000 });
    }
  });

  // Taken from the product view: every event must play right there, not after it is closed.
  const PV_IDS = ['shoes', 'instant-camera', 'candle', 'teddy-bear', 'unopened-gift', 'chocolate-box', 'doll', 'telephone', 'pocket-watch', 'letter', 'mirror'];

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
      if (['typewriter', 'advent-calendar', 'instant-camera', 'doll', 'chocolate-box', 'telephone', 'hourglass', 'oil-lamp', 'sleigh'].includes(id)) {
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

  // By day, before any Reveal: every product's full view, to check it is framed whole.
  test('Christmas product views, framed whole', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop only');
    test.setTimeout(600_000);
    await fresh(page);
    for (const id of process.env.DAY_IDS?.split(',') ?? []) {
      const link = page.locator(`.card[data-product="${id}"] .card-title a`);
      await link.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await page.waitForTimeout(500);
      await link.evaluate((el) => (el as HTMLElement).click());
      const view = page.getByTestId('product-view');
      await expect(view).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(1800);
      await page.screenshot({ path: `${OUT}/day-${id}.jpeg`, type: 'jpeg', quality: 60, scale: 'css' });
      await view.getByRole('button', { name: 'Close', exact: true }).click({ force: true });
      await expect(view).toHaveCount(0, { timeout: 15_000 });
      await page.waitForTimeout(600);
    }
  });

  // A Take frame by frame, inside the product view: a burst of small shots of the picture only.
  test('take burst', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop' || !process.env.BURST_IDS, 'set BURST_IDS to capture');
    test.setTimeout(600_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text().slice(0, 300)}`));
    await fresh(page);
    await catchBat(page, info);
    await page.waitForTimeout(2000);
    for (const id of (process.env.BURST_IDS?.split(',') ?? []).map((s) => s.trim()).filter(Boolean)) {
      const link = page.locator(`.card[data-product="${id}"] .card-title a`);
      await link.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await page.waitForTimeout(500);
      await link.evaluate((el) => (el as HTMLElement).click());
      const view = page.getByTestId('product-view');
      await expect(view).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(4000);
      const box = await page.getByTestId('inspection-canvas').boundingBox();
      await page.screenshot({ path: `${OUT}/burst-${id}-pre.jpeg`, type: 'jpeg', quality: 55, scale: 'css', ...(box ? { clip: box } : {}) });
      await page.getByTestId('pv-add').click();
      const t0 = Date.now();
      for (let i = 0; i < Number(process.env.BURST_N ?? 6); i++) {
        const t = ((Date.now() - t0) / 1000).toFixed(1);
        await page.screenshot({ path: `${OUT}/burst-${id}-${String(i).padStart(2, '0')}-${t}s.jpeg`, type: 'jpeg', quality: 55, scale: 'css', ...(box ? { clip: box } : {}) });
        await page.waitForTimeout(250);
      }
      await view.getByRole('button', { name: 'Close', exact: true }).click({ force: true });
      await expect(view).toHaveCount(0, { timeout: 15_000 });
      await page.waitForTimeout(1500);
      // opened again after the Take: the same size and look as right after it
      await link.evaluate((el) => (el as HTMLElement).click());
      await expect(view).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${OUT}/burst-${id}-reopen.jpeg`, type: 'jpeg', quality: 55, scale: 'css', ...(box ? { clip: box } : {}) });
      await view.getByRole('button', { name: 'Close', exact: true }).click({ force: true });
      await expect(view).toHaveCount(0, { timeout: 15_000 });
      await page.waitForTimeout(1000);
    }
    console.log(`BURST ERRORS (${errors.length})\n${errors.filter((e) => !e.includes('/api/echo')).join('\n')}`);
  });

  // The haunted shop as a whole: the hero, the shelves while scrolling (the 3D must stay on its
  // cards), the graveyard at the bottom, and the shop in the dark.
  test('haunted shop overview', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop' || !process.env.OVERVIEW, 'set OVERVIEW to capture');
    test.setTimeout(300_000);
    await fresh(page);
    // the Christmas shelves first: every product the same size, centred in its picture
    for (let i = 0; i < 3; i++) {
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), 700 + i * 760);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/ov-day-${i}.jpeg`, type: 'jpeg', quality: 70, scale: 'css' });
    }
    await catchBat(page, info);
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${OUT}/ov-hero.jpeg`, type: 'jpeg', quality: 70, scale: 'css' });
    await page.waitForTimeout(9000);
    await page.screenshot({ path: `${OUT}/ov-hero-b.jpeg`, type: 'jpeg', quality: 70, scale: 'css' });
    // the shelves, scrolled by wheel in steps; shot right after each step
    await page.mouse.move(700, 450);
    for (let i = 0; i < 4; i++) {
      await page.mouse.wheel(0, 380);
      await page.waitForTimeout(120);
      await page.screenshot({ path: `${OUT}/ov-scroll-${i}.jpeg`, type: 'jpeg', quality: 70, scale: 'css' });
    }
    const card = await page.evaluate(() => {
      const el = document.querySelector('.card[data-product="candle"] [data-object="candle"]');
      const r = el?.getBoundingClientRect();
      return r ? { top: r.top, left: r.left, w: r.width, h: r.height, sy: window.scrollY } : null;
    });
    console.log('candle card', JSON.stringify(card));
    // the bottom of the shop: the graveyard and its skeletons
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/ov-bottom.jpeg`, type: 'jpeg', quality: 70, scale: 'css' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${OUT}/ov-bottom-b.jpeg`, type: 'jpeg', quality: 70, scale: 'css' });
    // the grid in the dark (the lights fail): nothing on the shelves may glow on its own
    await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' }));
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      const d = document.querySelector<HTMLElement>('.darkness');
      if (d) d.style.opacity = '0.85';
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/ov-dark.jpeg`, type: 'jpeg', quality: 70, scale: 'css' });
  });
});
