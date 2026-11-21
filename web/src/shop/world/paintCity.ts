import { seeded, type Ctx } from './noise';

/** A gothic ruin: a wall with pointed-arch windows, broken off at a jagged top. */
function ruin(g: Ctx, r: () => number, x: number, base: number, w: number, h: number, tone: string, fire: number) {
  g.fillStyle = tone;
  g.beginPath();
  g.moveTo(x, base);
  g.lineTo(x, base - h * (0.7 + r() * 0.3));
  const teeth = 4 + Math.floor(r() * 4);
  for (let i = 1; i <= teeth; i++) {
    const tx = x + (w * i) / teeth;
    g.lineTo(tx - w / teeth / 2, base - h * (0.55 + r() * 0.45));
    g.lineTo(tx, base - h * (0.7 + r() * 0.3) * (r() < 0.3 ? 0.6 : 1));
  }
  g.lineTo(x + w, base);
  g.closePath();
  g.fill();
  // Arched windows; some glow with fire inside, the rest show the red sky through them.
  const cols = Math.max(1, Math.floor(w / 26));
  const rows = Math.max(1, Math.floor((h * 0.55) / 40));
  for (let row = 0; row < rows; row++) {
    for (let c = 0; c < cols; c++) {
      if (r() < 0.25) continue;
      const wx = x + 8 + c * (w / cols);
      const wy = base - 26 - row * 40;
      const ww = Math.min(12, w / cols - 8);
      const lit = r() < fire;
      g.fillStyle = lit ? `rgba(255,${110 + Math.floor(r() * 70)},40,${0.6 + r() * 0.4})` : 'rgba(120,24,18,0.55)';
      g.beginPath();
      g.moveTo(wx, wy);
      g.lineTo(wx, wy - 16);
      g.quadraticCurveTo(wx + ww / 2, wy - 30, wx + ww, wy - 16);
      g.lineTo(wx + ww, wy);
      g.closePath();
      g.fill();
    }
  }
}

/** A broken Ferris wheel: rim, spokes, a few hanging cars, part of the rim missing. */
function ferris(g: Ctx, cx: number, cy: number, R: number, tone: string) {
  g.strokeStyle = tone;
  g.lineWidth = Math.max(1.5, R * 0.03);
  g.beginPath();
  g.arc(cx, cy, R, Math.PI * 0.15, Math.PI * 1.75);
  g.stroke();
  g.lineWidth = Math.max(1, R * 0.012);
  for (let i = 0; i < 16; i++) {
    if (i === 3 || i === 4) continue;
    const a = (i / 16) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    g.stroke();
    if (i % 2 === 0) {
      g.fillStyle = tone;
      g.fillRect(cx + Math.cos(a) * R - R * 0.05, cy + Math.sin(a) * R + 2, R * 0.1, R * 0.09);
    }
  }
  // the A-frame legs
  g.lineWidth = Math.max(2, R * 0.035);
  g.beginPath();
  g.moveTo(cx, cy);
  g.lineTo(cx - R * 0.6, cy + R * 1.35);
  g.moveTo(cx, cy);
  g.lineTo(cx + R * 0.55, cy + R * 1.35);
  g.stroke();
}

/** Two rows of ruins (far, hazy; near, black) with a Ferris wheel between them. */
export function paintCity(g: Ctx, w: number, h: number, horizon: number) {
  const r = seeded(77);
  // Far row: hazy red-brown, many burning.
  for (let x = w * 0.32; x < w; ) {
    const bw = 40 + r() * 90;
    ruin(g, r, x, horizon, bw, 60 + r() * 120, '#2a1212', 0.35);
    x += bw * (0.7 + r() * 0.4);
  }
  ferris(g, w * 0.66, horizon - h * 0.3, h * 0.17, '#1c0c0c');
  // Near row: tall cathedral fragments, near black, a few windows burning.
  for (let x = w * 0.42; x < w + 40; ) {
    const bw = 60 + r() * 120;
    ruin(g, r, x, horizon + h * 0.04, bw, 110 + r() * 180, '#0d0707', 0.18);
    x += bw * (0.9 + r() * 0.6);
  }
  // A spire that still stands, to the right of the moon.
  g.fillStyle = '#0b0606';
  const sx = w * 0.9;
  g.beginPath();
  g.moveTo(sx - 18, horizon);
  g.lineTo(sx - 14, horizon - h * 0.42);
  g.lineTo(sx, horizon - h * 0.6);
  g.lineTo(sx + 14, horizon - h * 0.42);
  g.lineTo(sx + 18, horizon);
  g.fill();
}
