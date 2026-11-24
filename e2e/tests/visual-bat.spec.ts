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
    // held still at rest (wings spread, not caught mid-beat), so its shape can be compared
    big.querySelectorAll<SVGElement>('.wing, .bat-body').forEach((e) => {
      e.style.animation = 'none';
    });
    const vb = (svg as SVGSVGElement).viewBox.baseVal;
    const bigW = vb.width > vb.height ? 1100 : 300;
    big.setAttribute('style', `width:${bigW}px;height:${(bigW * vb.height) / vb.width}px;overflow:visible`);
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
    test.setTimeout(180_000);
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
    // In flight: the same scale, wings spread. Wait for it to take off on its own.
    let flying: unknown = null;
    let flight: unknown[] = [];
    if (info.project.name === 'desktop') {
      // Its drawn width through one whole flight, every frame: own size, swell, own size.
      await page.evaluate(() => {
        const out: { ms: number; w: number; flying: boolean }[] = [];
        (window as unknown as { __flight: unknown[] }).__flight = out;
        let t0 = 0;
        const tick = () => {
          const el = document.querySelector<HTMLElement>('[data-testid="day-bat"]');
          const flying = !!el?.classList.contains('is-flying');
          if (flying && !t0) t0 = performance.now();
          if (t0 && el) out.push({ ms: Math.round(performance.now() - t0), w: Math.round(el.getBoundingClientRect().width), flying });
          if (!t0 || performance.now() - t0 < 4500) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await expect(day).toHaveClass(/is-flying/, { timeout: 30_000 });
      await page.waitForTimeout(300);
      flying = await measure(page, '[data-testid="day-bat"]');
      await enlarge(page, '[data-testid="day-bat"]', `${OUT}/bat-${tag}-flying.png`);
      await expect(day).not.toHaveClass(/is-flying/, { timeout: 10_000 });
      await page.waitForTimeout(500);
      flight = await page.evaluate(() => (window as unknown as { __flight: unknown[] }).__flight.filter((_, i) => i % 6 === 0));
    }
    // The hand over the bat, then the catch and the lunge, frame by frame.
    let hand: unknown = null;
    const lunge: unknown[] = [];
    if (!info.project.use.hasTouch) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await day.hover();
      const sk = page.getByTestId('skeleton-hand');
      await expect(sk).toBeVisible();
      hand = await sk.boundingBox();
      const b = await day.boundingBox();
      if (b) await page.screenshot({ path: `${OUT}/bat-${tag}-hand.png`, clip: { x: Math.max(0, b.x - 40), y: Math.max(0, b.y - 20), width: 120, height: 120 } });
      // Record the lunge every frame inside the page (screenshots are too slow to follow it).
      await page.evaluate(() => {
        const out: unknown[] = [];
        (window as unknown as { __lunge: unknown[] }).__lunge = out;
        const t0 = performance.now();
        const tick = () => {
          const l = document.querySelector('[data-testid="lunge"]');
          const face = l?.querySelector('.lunge-bat .bat-face')?.getBoundingClientRect();
          const bat = l?.querySelector('.lunge-bat')?.getBoundingClientRect();
          const shade = l?.querySelector<HTMLElement>('.lunge-shade');
          const maw = l?.querySelector<HTMLElement>('.lunge-maw');
          out.push({
            ms: Math.round(performance.now() - t0),
            step: l?.className.replace('lunge ', '') ?? 'none',
            batW: bat ? Math.round(bat.width) : null,
            faceY: face && face.height > 0 ? +((face.top + face.height / 2) / window.innerHeight).toFixed(3) : null,
            faceX: face && face.width > 0 ? +((face.left + face.width / 2) / window.innerWidth).toFixed(3) : null,
            shade: shade ? +getComputedStyle(shade).opacity : null,
            maw: maw ? +getComputedStyle(maw).opacity : null,
          });
          if (performance.now() - t0 < 4000) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await day.click();
      for (let i = 0; i < 8; i++) {
        await page.waitForTimeout(260);
        await page.screenshot({ path: `${OUT}/bat-${tag}-lunge-${String(i).padStart(2, '0')}.jpeg`, type: 'jpeg', quality: 60, scale: 'css' });
      }
      await page.waitForTimeout(1500);
      lunge.push(...(await page.evaluate(() => (window as unknown as { __lunge: unknown[] }).__lunge)));
      await expect(page.locator('html')).toHaveAttribute('data-state', 'haunted', { timeout: 20_000 });
      await expect(page.getByTestId('lunge')).toHaveCount(0, { timeout: 15_000 });
    } else {
      await catchBat(page, info);
    }
    const ghost = page.getByTestId('haunted-bat').first();
    await expect(ghost).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(2500);
    const haunted = await measure(page, '[data-testid="haunted-bat"]:not(.is-flying)');
    await enlarge(page, '[data-testid="haunted-bat"]:not(.is-flying)', `${OUT}/bat-${tag}-haunted.png`);
    const h = await page.locator('[data-testid="haunted-bat"]:not(.is-flying)').first().boundingBox();
    if (h) await page.screenshot({ path: `${OUT}/bat-${tag}-haunted-insitu.png`, clip: { x: Math.max(0, h.x - 60), y: Math.max(0, h.y - 30), width: 180, height: 180 } });
    writeFileSync(`${OUT}/bat-${tag}.json`, JSON.stringify({ christmas, flying, flight, hand, lunge, haunted }, null, 2));
  });
});
