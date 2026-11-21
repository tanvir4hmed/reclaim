import { makeNoise, seeded, type Ctx } from './noise';

/** Scorched, wet ground with dirty snow, rubble, puddles reflecting the fire, and dead trees. */
export function paintGround(g: Ctx, w: number, h: number, horizon: number) {
  const ground = g.createLinearGradient(0, horizon, 0, h);
  ground.addColorStop(0, '#1a0b09');
  ground.addColorStop(0.5, '#0e0706');
  ground.addColorStop(1, '#060303');
  g.fillStyle = ground;
  g.fillRect(0, horizon, w, h - horizon);

  // Dirty snow and ash patches.
  const n = makeNoise(21);
  const img = g.getImageData(0, Math.floor(horizon), w, Math.ceil(h - horizon));
  for (let y = 0; y < img.height; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const v = n(x / 70, (y + horizon) / 30, 4);
      if (v < 0.6) continue;
      const a = Math.min(0.5, (v - 0.6) * 2.5);
      for (let k = 0; k < 4; k++) {
        const xx = x + (k & 1);
        const yy = y + (k >> 1);
        if (yy >= img.height) continue;
        const i = (yy * w + xx) * 4;
        img.data[i] = img.data[i]! * (1 - a) + 120 * a;
        img.data[i + 1] = img.data[i + 1]! * (1 - a) + 108 * a;
        img.data[i + 2] = img.data[i + 2]! * (1 - a) + 104 * a;
      }
    }
  }
  g.putImageData(img, 0, Math.floor(horizon));

  const r = seeded(5);
  // Rubble: broken blocks and beams.
  for (let i = 0; i < 70; i++) {
    const x = w * 0.3 + r() * w * 0.7;
    const y = horizon + 6 + r() * (h - horizon) * 0.5;
    const s = 3 + r() * 14 * ((y - horizon) / (h - horizon) + 0.3);
    g.fillStyle = r() < 0.5 ? '#140a08' : '#21110d';
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + s, y - s * 0.3);
    g.lineTo(x + s * 1.3, y + s * 0.2);
    g.lineTo(x + s * 0.2, y + s * 0.4);
    g.fill();
  }
  // Puddles catching the red sky and the fires.
  for (let i = 0; i < 8; i++) {
    const x = w * 0.35 + r() * w * 0.6;
    const y = horizon + 20 + r() * (h - horizon) * 0.6;
    const pw = 30 + r() * 90;
    const pg = g.createRadialGradient(x, y, 0, x, y, pw);
    pg.addColorStop(0, 'rgba(170,40,24,0.35)');
    pg.addColorStop(1, 'rgba(170,40,24,0)');
    g.fillStyle = pg;
    g.beginPath();
    g.ellipse(x, y, pw, pw * 0.16, 0, 0, Math.PI * 2);
    g.fill();
  }
  deadTree(g, w * 0.12, h * 1.02, h * 0.95, r);
  deadTree(g, w * 0.97, h * 1.02, h * 0.7, r);
}

/** A bare, black tree with crooked branches, at the frame's edge. */
function deadTree(g: Ctx, x: number, y: number, size: number, r: () => number) {
  g.strokeStyle = '#050303';
  g.lineCap = 'round';
  const branch = (x0: number, y0: number, len: number, a: number, wdt: number, depth: number) => {
    if (depth === 0 || len < 4) return;
    const x1 = x0 + Math.cos(a) * len;
    const y1 = y0 + Math.sin(a) * len;
    g.lineWidth = wdt;
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo(x0 + Math.cos(a + 0.4) * len * 0.5, y0 + Math.sin(a + 0.4) * len * 0.5, x1, y1);
    g.stroke();
    const kids = 2 + Math.floor(r() * 2);
    for (let i = 0; i < kids; i++) branch(x1, y1, len * (0.55 + r() * 0.2), a + (r() - 0.5) * 1.3, wdt * 0.62, depth - 1);
  };
  branch(x, y, size * 0.32, -Math.PI / 2 + (r() - 0.5) * 0.2, size * 0.04, 7);
}
