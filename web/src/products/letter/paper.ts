import { seeded } from '../../director/footprints';

/*
 * Procedural parchment and the things drawn on it, for the envelope and the letter inside
 * (round 11, after Tanvir's two references). All canvas 2D, no image files.
 */

type Tone = 'body' | 'flap' | 'letter';

/** Old parchment: a warm ground, fibres, wrinkles, stains, cracks, darkened edges and corners. */
export function drawParchment(g: CanvasRenderingContext2D, w: number, h: number, tone: Tone, haunted: boolean, seed: number) {
  const r = seeded(seed);
  const base =
    tone === 'flap'
      ? haunted
        ? ['#c9a05a', '#a87c3c']
        : ['#efdcae', '#d9bf88']
      : tone === 'letter'
        ? haunted
          ? ['#d1b07a', '#a9854c']
          : ['#f2e4c2', '#dcc79a']
        : haunted
          ? ['#bea47a', '#93774c']
          : ['#ecdfc2', '#d4c098'];
  const grd = g.createRadialGradient(w * 0.5, h * 0.45, w * 0.1, w * 0.5, h * 0.5, w * 0.7);
  grd.addColorStop(0, base[0]!);
  grd.addColorStop(1, base[1]!);
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  const age = haunted ? 1 : 0.35;
  // blotchy tone: big soft patches lighter and darker
  for (let i = 0; i < 40; i++) {
    const x = r() * w;
    const y = r() * h;
    const rad = (0.05 + r() * 0.18) * w;
    const dark = r() < 0.6;
    const p = g.createRadialGradient(x, y, 0, x, y, rad);
    p.addColorStop(0, dark ? `rgba(110,74,34,${0.1 * age + r() * 0.08 * age})` : `rgba(255,240,200,${0.08 + r() * 0.06})`);
    p.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = p;
    g.fillRect(0, 0, w, h);
  }
  // fibres: thousands of tiny short strokes, light and dark
  for (let i = 0; i < 2600; i++) {
    const x = r() * w;
    const y = r() * h;
    const a = r() * Math.PI;
    const l = 2 + r() * 6;
    g.strokeStyle = r() < 0.5 ? `rgba(90,60,30,${0.06 + r() * 0.08})` : `rgba(255,245,215,${0.06 + r() * 0.08})`;
    g.lineWidth = 0.6 + r() * 0.6;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  // wrinkles: long soft creases, a lit side and a shadow side
  for (let i = 0; i < 14; i++) {
    let x = r() * w;
    let y = r() * h;
    const a0 = r() * Math.PI;
    const n = 6 + Math.floor(r() * 6);
    const path: [number, number][] = [[x, y]];
    let a = a0;
    for (let k = 0; k < n; k++) {
      a += (r() - 0.5) * 0.6;
      x += Math.cos(a) * w * 0.035;
      y += Math.sin(a) * w * 0.035;
      path.push([x, y]);
    }
    for (const [col, off] of [
      [`rgba(80,52,24,${0.16 * age + 0.05})`, 1.2],
      [`rgba(255,244,214,${0.16})`, -1.2],
    ] as const) {
      g.strokeStyle = col;
      g.lineWidth = 1.6;
      g.beginPath();
      path.forEach(([px, py], k) => (k ? g.lineTo(px + off, py + off) : g.moveTo(px + off, py + off)));
      g.stroke();
    }
  }
  if (haunted) {
    // cracks in the old paper: thin dark broken lines
    g.strokeStyle = 'rgba(60,38,18,0.55)';
    g.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      let x = r() * w;
      let y = r() * h;
      let a = r() * Math.PI * 2;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 10; k++) {
        a += (r() - 0.5) * 1.2;
        x += Math.cos(a) * 9;
        y += Math.sin(a) * 9;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    // a coffee ring
    g.strokeStyle = 'rgba(120,80,36,0.35)';
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(w * (0.66 + r() * 0.1), h * (0.62 + r() * 0.1), w * 0.07, w * 0.05, 0.2, 0.3, Math.PI * 1.7);
    g.stroke();
  }
  // darker toward the edges and much darker in the corners
  const edge = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.56);
  edge.addColorStop(0, 'rgba(0,0,0,0)');
  edge.addColorStop(1, `rgba(70,42,16,${0.25 + 0.4 * age})`);
  g.fillStyle = edge;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = `rgba(80,50,20,${0.3 + 0.3 * age})`;
  g.lineWidth = 6;
  g.strokeRect(0, 0, w, h);
}

/** Blood: dark spatter dots and a few smears (haunted only). */
export function drawSpatter(g: CanvasRenderingContext2D, w: number, h: number, seed: number, spots: [number, number, number][]) {
  const r = seeded(seed);
  for (const [cx, cy, n] of spots) {
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = r() * 26 * (i === 0 ? 0 : 1);
      const rad = i === 0 ? 5 + r() * 3 : 0.8 + r() * 2.4;
      g.fillStyle = `rgba(${90 + r() * 30},10,12,${0.75 + r() * 0.2})`;
      g.beginPath();
      g.arc(cx * w + Math.cos(a) * d, cy * h + Math.sin(a) * d, rad, 0, Math.PI * 2);
      g.fill();
    }
  }
}

/** A smear of dried blood along an edge (corner stains, as on the reference). */
export function drawSmear(g: CanvasRenderingContext2D, x: number, y: number, len: number, angle: number, seed: number) {
  const r = seeded(seed);
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  for (let i = 0; i < 26; i++) {
    g.fillStyle = `rgba(${100 + r() * 30},14,14,${0.12 + r() * 0.3})`;
    g.beginPath();
    g.ellipse(r() * len, (r() - 0.5) * 12, 3 + r() * 10, 1 + r() * 3, (r() - 0.5) * 0.6, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/**
 * The message, written in blood with a finger: thick and uneven strokes, darker at their
 * edges, scratches through them, spatter round them, and drips running down from the bottom
 * of several letters. Only the one line.
 */
export function drawBloodWords(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  maxW: number,
  seed: number,
  face = 'Creepster',
  /** run: how far the drips have run (0..1); spatter: dots and scratches round the words; center: x is the middle. */
  opts: { run?: number; spatter?: boolean; center?: boolean } = {},
) {
  const runK = opts.run ?? 1;
  const r = seeded(seed);
  g.save();
  g.font = `${size}px "${face}", "Brush Script MT", "Segoe Script", cursive`;
  // a little air between the letters, so they never run into one another
  const gap = size * 0.07;
  g.textBaseline = 'alphabetic';
  let scale = 1;
  const width = g.measureText(text).width + gap * (text.length - 1);
  if (width > maxW) scale = maxW / width;
  g.translate(opts.center ? x - (width * scale) / 2 : x, y);
  g.scale(scale, 1);
  // a wet halo soaked into the paper under the words
  // (each letter's own soak is drawn with it, below)
  // the strokes, each letter its own small tilt and height, darker rim then the red
  let adv = 0;
  const parts = text.split('');
  const pos: number[] = [];
  for (const c of parts) {
    pos.push(adv);
    adv += g.measureText(c).width + gap;
  }
  parts.forEach((c, i) => {
    const px = pos[i]!;
    const py = Math.sin(i * 1.9) * size * 0.03;
    const rot = (r() - 0.5) * 0.08;
    g.save();
    g.translate(px, py);
    g.rotate(rot);
    // a faint wet soak round the letter, a thin dark rim, then the red
    g.filter = 'blur(2px)';
    g.fillStyle = 'rgba(110,14,14,0.35)';
    g.fillText(c, 1.5, 1.5);
    g.filter = 'none';
    g.lineJoin = 'round';
    g.strokeStyle = '#3a0406';
    g.lineWidth = size * 0.025;
    g.strokeText(c, 0, 0);
    g.fillStyle = '#8a0d12';
    g.fillText(c, 0, 0);
    g.restore();
  });
  // drips from the bottoms of some of the letters
  g.fillStyle = '#6e0a0d';
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === ' ' || r() < 0.35) continue;
    const dx = pos[i]! + (g.measureText(parts[i]!).width * (0.3 + r() * 0.4));
    const len = size * (0.25 + r() * 0.9) * runK;
    const wd = size * (0.035 + r() * 0.03);
    g.beginPath();
    g.moveTo(dx - wd / 2, -size * 0.05);
    g.lineTo(dx - wd * 0.35, len);
    g.quadraticCurveTo(dx, len + wd * 1.6, dx + wd * 0.35, len);
    g.lineTo(dx + wd / 2, -size * 0.05);
    g.closePath();
    g.fill();
    g.beginPath();
    g.arc(dx, len, wd * 0.75, 0, Math.PI * 2);
    g.fill();
  }
  // spatter round the words, and a few scratches through them
  if (opts.spatter === false) {
    g.restore();
    return;
  }
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(${100 + r() * 30},10,12,${0.6 + r() * 0.35})`;
    g.beginPath();
    g.arc(r() * adv, -size * 0.9 + r() * size * 1.4, 0.8 + r() * 2.6, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = 'rgba(210,170,120,0.55)';
  g.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) {
    const sx = r() * adv;
    const sy = -size * 0.6 + r() * size * 0.5;
    g.beginPath();
    g.moveTo(sx, sy);
    g.lineTo(sx + size * (0.3 + r() * 0.4), sy + size * (0.1 + r() * 0.2));
    g.stroke();
  }
  g.restore();
}

/** The crack lines across the top of the wax seal. */
export function drawSealTop(g: CanvasRenderingContext2D, w: number, h: number, haunted: boolean) {
  const c = w / 2;
  const grd = g.createRadialGradient(c * 0.85, c * 0.8, 4, c, c, c);
  grd.addColorStop(0, haunted ? '#8a1c20' : '#b02a30');
  grd.addColorStop(1, haunted ? '#4a0a0e' : '#6e1218');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(20,2,4,0.8)';
  g.lineWidth = 2;
  const r = seeded(13);
  for (let i = 0; i < 5; i++) {
    let x = c + (r() - 0.5) * w * 0.3;
    let y = c + (r() - 0.5) * h * 0.3;
    let a = r() * Math.PI * 2;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      a += (r() - 0.5) * 0.9;
      x += Math.cos(a) * w * 0.07;
      y += Math.sin(a) * w * 0.07;
      g.lineTo(x, y);
    }
    g.stroke();
  }
}
