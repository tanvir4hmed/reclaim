import { useEffect, useRef } from 'react';
import { PumpkinView } from '../../gl/Pumpkin';
import { hasWebGL2 } from '../../gl/webgl';
import { paintCity } from './paintCity';
import { paintGround } from './paintGround';
import { paintSky } from './paintSky';

/**
 * Behind the whole haunted shop: the street it stood on, burnt out and still smouldering. Painted
 * once in code (no image files) and stretched to cover the shelves; a jack-o'-lantern burns in
 * the rubble at the bottom right, part of the scene, not a thing for sale.
 */
export function ShopBackdrop() {
  const canvas = useRef<HTMLCanvasElement>(null);
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
  return (
    <div className="shop-backdrop" aria-hidden="true" data-testid="shop-backdrop">
      <canvas ref={canvas} className="shop-backdrop-paint" />
      <div className="shop-backdrop-fire" />
      <div className="shop-backdrop-shade" />
      {hasWebGL2() && (
        <div className="shop-pumpkin" data-testid="pumpkin">
          <PumpkinView />
        </div>
      )}
    </div>
  );
}
