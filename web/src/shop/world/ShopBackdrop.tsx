import { useEffect, useRef } from 'react';
import { PumpkinView } from '../../gl/Pumpkin';
import { hasWebGL2 } from '../../gl/webgl';
import { GraveSkeletons } from './GraveSkeletons';
import { paintCity } from './paintCity';
import { paintGraveyard } from './paintGraveyard';
import { paintGround } from './paintGround';
import { paintSky } from './paintSky';

const YARD_W = 1600;
const YARD_H = 420;

/** Where the lantern stands, in the graveyard canvas's own pixels (it is drawn right-aligned). */
function lanternX(yard: HTMLCanvasElement, pumpkin: HTMLElement | null): number {
  const c = yard.getBoundingClientRect();
  if (!pumpkin || c.width === 0) return YARD_W * 0.82;
  const p = pumpkin.getBoundingClientRect();
  const k = Math.max(c.width / YARD_W, c.height / YARD_H);
  const fromRight = c.right - (p.left + p.width / 2);
  return Math.max(0, Math.min(YARD_W, YARD_W - fromRight / k));
}

/**
 * Behind the whole haunted shop: the street it stood on, burnt out and still smouldering, and
 * at the bottom the graveyard the street ended in. Painted in code (no image files) and
 * stretched to cover the shelves; a jack-o'-lantern burns among the graves on the right, part
 * of the scene, not a thing for sale. Skeletons are at work among the graves (GraveSkeletons).
 */
export function ShopBackdrop() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const yard = useRef<HTMLCanvasElement>(null);
  const pumpkin = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const id = requestAnimationFrame(() => {
      const w = 1600;
      const h = 1000;
      c.width = w;
      c.height = h;
      const g = c.getContext('2d', { willReadFrequently: true });
      if (!g) return;
      const horizon = h * 0.42;
      paintSky(g, w, h, { x: w * 0.82, y: h * 0.12, r: 70 });
      paintCity(g, w, h * 0.7, horizon);
      paintGround(g, w, h, horizon);
    });
    return () => cancelAnimationFrame(id);
  }, []);
  // The graves gather round the lantern, so they are repainted if the window changes size.
  useEffect(() => {
    const c = yard.current;
    if (!c) return;
    c.width = YARD_W;
    c.height = YARD_H;
    let last = -1;
    let frame = 0;
    const paint = () => {
      const x = Math.round(lanternX(c, pumpkin.current));
      if (Math.abs(x - last) < 12) return;
      last = x;
      const g = c.getContext('2d', { willReadFrequently: true });
      if (g) paintGraveyard(g, YARD_W, YARD_H, x);
    };
    frame = requestAnimationFrame(paint);
    let timer = 0;
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(paint, 250);
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }, []);
  return (
    <div className="shop-backdrop" aria-hidden="true" data-testid="shop-backdrop">
      <canvas ref={canvas} className="shop-backdrop-paint" />
      <div className="shop-backdrop-fire" />
      <div className="shop-backdrop-shade" />
      <canvas ref={yard} className="shop-graveyard" data-testid="graveyard" />
      <GraveSkeletons w={YARD_W} h={YARD_H} pumpkin={pumpkin} />
      {hasWebGL2() && (
        <div ref={pumpkin} className="shop-pumpkin" data-testid="pumpkin">
          <PumpkinView />
        </div>
      )}
    </div>
  );
}
