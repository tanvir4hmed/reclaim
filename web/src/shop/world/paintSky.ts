import { makeNoise, type Ctx } from './noise';

/** Night sky, a huge blood-red moon, and heavy smoke lit red from the fires below. */
export function paintSky(g: Ctx, w: number, h: number, moon: { x: number; y: number; r: number }) {
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#07070a');
  sky.addColorStop(0.55, '#1a0d10');
  sky.addColorStop(0.8, '#3a1210');
  sky.addColorStop(1, '#120606');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);

  // Moon glow first, then the disc with its craters.
  const glow = g.createRadialGradient(moon.x, moon.y, moon.r * 0.8, moon.x, moon.y, moon.r * 4.5);
  glow.addColorStop(0, 'rgba(200,40,30,0.55)');
  glow.addColorStop(0.4, 'rgba(120,20,16,0.22)');
  glow.addColorStop(1, 'rgba(60,8,8,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);

  const n = makeNoise(3);
  const img = g.getImageData(Math.floor(moon.x - moon.r), Math.floor(moon.y - moon.r), Math.ceil(moon.r * 2), Math.ceil(moon.r * 2));
  const D = img.width;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < D; x++) {
      const dx = (x - moon.r) / moon.r;
      const dy = (y - moon.r) / moon.r;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      const limb = Math.sqrt(1 - d);
      const crater = n(x / (moon.r * 0.18), y / (moon.r * 0.18), 4);
      const maria = n(x / (moon.r * 0.6) + 9, y / (moon.r * 0.6), 3);
      const v = (0.55 + 0.45 * limb) * (0.7 + crater * 0.35) * (maria > 0.55 ? 0.78 : 1);
      const i = (y * D + x) * 4;
      const edge = Math.min(1, (1 - d) * 18);
      img.data[i] = img.data[i]! * (1 - edge) + 235 * v * edge;
      img.data[i + 1] = img.data[i + 1]! * (1 - edge) + 70 * v * edge;
      img.data[i + 2] = img.data[i + 2]! * (1 - edge) + 52 * v * edge;
    }
  }
  g.putImageData(img, Math.floor(moon.x - moon.r), Math.floor(moon.y - moon.r));

  // Smoke: rolling banks in front of the moon and over the city, under-lit red near the ground.
  paintSmoke(g, w, h, makeNoise(11));
}

function paintSmoke(g: Ctx, w: number, h: number, n: (x: number, y: number, o?: number) => number) {
  const step = 3;
  const img = g.getImageData(0, 0, w, h);
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const v = n(x / 260, y / 120, 5);
      const band = Math.max(0, v - 0.42) * 2.2;
      if (band <= 0) continue;
      const low = y / h;
      const a = Math.min(0.85, band * (0.55 + low * 0.4));
      const r = 26 + low * 70 + v * 30;
      const gg = 20 + low * 14;
      const b = 22 + low * 8;
      for (let yy = 0; yy < step && y + yy < h; yy++) {
        for (let xx = 0; xx < step && x + xx < w; xx++) {
          const i = ((y + yy) * w + x + xx) * 4;
          img.data[i] = img.data[i]! * (1 - a) + r * a;
          img.data[i + 1] = img.data[i + 1]! * (1 - a) + gg * a;
          img.data[i + 2] = img.data[i + 2]! * (1 - a) + b * a;
        }
      }
    }
  }
  g.putImageData(img, 0, 0);
}
