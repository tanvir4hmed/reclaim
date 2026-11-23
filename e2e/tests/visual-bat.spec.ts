import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { catchBat, fresh } from './helpers';

const OUT = process.env.SHOTS_DIR;
const LABEL = process.env.BAT_LABEL ?? 'now';

/** The bat's rendered box, and its drawn silhouette (the SVG rig's bounding box) in CSS px. */
async function measure(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel);
    const svg = el?.querySelector<SVGSVGElement>('svg.bat');
    const rig = svg?.querySelector<SVGGElement>('.bat-rig');
    if (!el || !svg || !rig) return null;
    const box = el.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const k = box.width / vb.width;
    const b = rig.getBBox();
    const face = svg.querySelector<SVGGElement>('.bat-face')?.getBoundingClientRect();
    const ears = [...svg.querySelectorAll<SVGGElement>('.bat-ear')].map((e) => e.getBoundingClientRect());
    const feet = svg.querySelector<SVGGElement>('.bat-body > g')?.getBoundingClientRect();
    return {
      box: { x: box.x, y: box.y, w: box.width, h: box.height },
      silhouette: { w: b.width * k, h: b.height * k },
      face: face ? { w: face.width, h: face.height } : null,
      ears: ears.map((r) => ({ w: r.width, h: r.height })),
      feetTop: feet ? feet.top - box.top : null,
    };
  }, selector);
}

/** A copy of the bat drawn big (same SVG, same defs), so its details can be compared by eye. */
async function enlarge(page: Page, selector: string, file: string) {
  await page.evaluate((sel) => {
    document.getElementById('bat-zoom')?.remove();
    const svg = document.querySelector(`${sel} svg.bat`);
    if (!svg) return;
    const wrap = document.createElement('div');
    wrap.id = 'bat-zoom';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;gap:40px;align-items:center;justify-content:center;background:#9a8f80';
    const big = svg.cloneNode(true) as SVGSVGElement;
    big.setAttribute('style', 'width:300px;height:733px;overflow:visible');
    const real = svg.cloneNode(true) as SVGSVGElement;
    const r = svg.getBoundingClientRect();
    real.setAttribute('style', `width:${r.width}px;height:${r.height}px;overflow:visible`);
    wrap.append(big, real);
    document.body.append(wrap);
  }, selector);
  await page.waitForTimeout(200);
  await page.screenshot({ path: file });
  await page.evaluate(() => document.getElementById('bat-zoom')?.remove());
}

test.describe('visual capture of the bat', () => {
  test.skip(!OUT, 'set SHOTS_DIR to capture screenshots');

  test('Christmas and haunted bat, sizes and close-ups', async ({ page }, info) => {
    test.skip(info.project.name === 'reduced-motion', 'not needed');
    test.setTimeout(120_000);
    const tag = `${LABEL}-${info.project.name}`;
    await fresh(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    const day = page.getByTestId('day-bat');
    await expect(day).toBeVisible({ timeout: 10_000 });
    // At rest: hanging, not in the middle of a flight or a look.
    await expect(day).not.toHaveClass(/is-flying|is-looking/, { timeout: 20_000 });
    const christmas = await measure(page, '[data-testid="day-bat"]');
    await enlarge(page, '[data-testid="day-bat"]', `${OUT}/bat-${tag}-christmas.png`);
    const r = await day.boundingBox();
    if (r) await page.screenshot({ path: `${OUT}/bat-${tag}-christmas-insitu.png`, clip: { x: Math.max(0, r.x - 60), y: Math.max(0, r.y - 30), width: 180, height: 180 } });
    await catchBat(page, info);
    const ghost = page.getByTestId('haunted-bat').first();
    await expect(ghost).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(2500);
    const haunted = await measure(page, '[data-testid="haunted-bat"]:not(.is-flying)');
    await enlarge(page, '[data-testid="haunted-bat"]:not(.is-flying)', `${OUT}/bat-${tag}-haunted.png`);
    const h = await page.locator('[data-testid="haunted-bat"]:not(.is-flying)').first().boundingBox();
    if (h) await page.screenshot({ path: `${OUT}/bat-${tag}-haunted-insitu.png`, clip: { x: Math.max(0, h.x - 60), y: Math.max(0, h.y - 30), width: 180, height: 180 } });
    writeFileSync(`${OUT}/bat-${tag}.json`, JSON.stringify({ christmas, haunted }, null, 2));
  });
});
