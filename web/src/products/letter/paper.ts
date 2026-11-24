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
 * The photograph pinned to the letter: an old black-and-white print with a yellowed white
 * border; a long dark corridor going away, a doorway lit at its end, and in the doorway a
 * woman in a pale dress, long black hair hanging over her face, standing still. Grain and a
 * heavy vignette.
 */
export function drawGhostPhoto(g: CanvasRenderingContext2D, w: number, h: number) {
  const r = seeded(77);
  // the border, yellowed and a little stained
  g.fillStyle = '#e2d8c2';
  g.fillRect(0, 0, w, h);
  const b = w * 0.06;
  const x0 = b;
  const y0 = b;
  const iw = w - 2 * b;
  const ih = h - 2 * b;
  g.save();
  g.beginPath();
  g.rect(x0, y0, iw, ih);
  g.clip();
  // the corridor: dark walls converging on a doorway
  g.fillStyle = '#1d1d1c';
  g.fillRect(x0, y0, iw, ih);
  const vx = x0 + iw * 0.5;
  const vy = y0 + ih * 0.46;
  const dw = iw * 0.2;
  const dh = ih * 0.42;
  const dx0 = vx - dw / 2;
  const dy0 = vy - dh * 0.55;
  // walls, floor and ceiling, each a little lighter toward the door
  const face = (pts: [number, number][], c0: string, c1: string) => {
    const gr = g.createLinearGradient(pts[0]![0], pts[0]![1], vx, vy);
    gr.addColorStop(0, c0);
    gr.addColorStop(1, c1);
    g.fillStyle = gr;
    g.beginPath();
    pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
    g.closePath();
    g.fill();
  };
  face([[x0, y0], [dx0, dy0], [dx0, dy0 + dh], [x0, y0 + ih]], '#0e0e0e', '#3a3a38');
  face([[x0 + iw, y0], [dx0 + dw, dy0], [dx0 + dw, dy0 + dh], [x0 + iw, y0 + ih]], '#0c0c0c', '#353533');
  face([[x0, y0 + ih], [dx0, dy0 + dh], [dx0 + dw, dy0 + dh], [x0 + iw, y0 + ih]], '#161615', '#4a4a47');
  face([[x0, y0], [dx0, dy0], [dx0 + dw, dy0], [x0 + iw, y0]], '#090909', '#2a2a29');
  // door frames down the corridor
  g.strokeStyle = 'rgba(120,120,116,0.35)';
  g.lineWidth = 1.5;
  for (const k of [0.35, 0.6]) {
    const lx = x0 + (dx0 - x0) * k;
    const ty = y0 + (dy0 - y0) * k;
    const by = y0 + ih + (dy0 + dh - y0 - ih) * k;
    g.strokeRect(lx, ty, x0 + iw - (x0 + iw - dx0 - dw) * k - lx, by - ty);
  }
  // the lit doorway
  const lit = g.createRadialGradient(vx, vy, 2, vx, vy, dh * 0.7);
  lit.addColorStop(0, '#d8d8d2');
  lit.addColorStop(1, '#6a6a66');
  g.fillStyle = lit;
  g.fillRect(dx0, dy0, dw, dh);
  // her, standing in it: a pale dress, black hair to the waist over her face, arms hanging
  const fx = vx;
  const top = dy0 + dh * 0.12;
  const tall = dh * 0.86;
  g.fillStyle = '#efefe8';
  g.beginPath();
  g.moveTo(fx - tall * 0.07, top + tall * 0.24);
  g.quadraticCurveTo(fx - tall * 0.12, top + tall * 0.7, fx - tall * 0.15, top + tall);
  g.lineTo(fx + tall * 0.15, top + tall);
  g.quadraticCurveTo(fx + tall * 0.12, top + tall * 0.7, fx + tall * 0.07, top + tall * 0.24);
  g.closePath();
  g.fill();
  g.fillStyle = '#b9b7ae';
  g.beginPath();
  g.ellipse(fx, top + tall * 0.1, tall * 0.055, tall * 0.075, 0, 0, Math.PI * 2);
  g.fill();
  // the hair: a black curtain over her face, past her shoulders
  g.fillStyle = '#050505';
  g.beginPath();
  g.moveTo(fx - tall * 0.065, top + tall * 0.04);
  g.quadraticCurveTo(fx - tall * 0.11, top + tall * 0.3, fx - tall * 0.085, top + tall * 0.52);
  g.lineTo(fx - tall * 0.03, top + tall * 0.5);
  g.lineTo(fx - tall * 0.015, top + tall * 0.18);
  g.lineTo(fx + tall * 0.02, top + tall * 0.48);
  g.lineTo(fx + tall * 0.085, top + tall * 0.52);
  g.quadraticCurveTo(fx + tall * 0.11, top + tall * 0.3, fx + tall * 0.065, top + tall * 0.04);
  g.quadraticCurveTo(fx, top - tall * 0.03, fx - tall * 0.065, top + tall * 0.04);
  g.fill();
  // one dark eye showing through the hair
  g.fillStyle = '#000';
  g.beginPath();
  g.ellipse(fx + tall * 0.02, top + tall * 0.1, tall * 0.012, tall * 0.008, 0, 0, Math.PI * 2);
  g.fill();
  // arms, hanging long at her sides
  g.strokeStyle = '#d2d0c8';
  g.lineWidth = tall * 0.025;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(fx + s * tall * 0.075, top + tall * 0.27);
    g.lineTo(fx + s * tall * 0.11, top + tall * 0.6);
    g.stroke();
  }
  // grain and a heavy vignette
  const img = g.getImageData(x0, y0, iw, ih);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * 38;
    img.data[i] = Math.max(0, Math.min(255, img.data[i]! + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1]! + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2]! + n));
  }
  g.putImageData(img, x0, y0);
  const vg = g.createRadialGradient(vx, vy, ih * 0.2, vx, vy, ih * 0.8);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.75)');
  g.fillStyle = vg;
  g.fillRect(x0, y0, iw, ih);
  g.restore();
  // a crease across a corner of the print, and stains on the border
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(w * 0.72, 0);
  g.lineTo(w, h * 0.3);
  g.stroke();
  g.fillStyle = 'rgba(140,100,50,0.25)';
  g.beginPath();
  g.ellipse(w * 0.85, h * 0.9, w * 0.12, h * 0.05, 0.3, 0, Math.PI * 2);
  g.fill();
}

/**
 * The message, written in blood with a finger: thick and uneven strokes, darker at their
 * edges, scratches through them, spatter round them, and drips running down from the bottom
 * of several letters. Only the one line.
 */
export function drawBloodWords(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, maxW: number, seed: number) {
  const r = seeded(seed);
  g.save();
  g.font = `bold ${size}px "Brush Script MT", "Segoe Script", "Comic Sans MS", cursive`;
  g.textBaseline = 'alphabetic';
  let scale = 1;
  const width = g.measureText(text).width;
  if (width > maxW) scale = maxW / width;
  g.translate(x, y);
  g.scale(scale, 1);
  // a wet halo soaked into the paper under the words
  g.filter = 'blur(3px)';
  g.fillStyle = 'rgba(110,14,14,0.45)';
  g.fillText(text, 2, 2);
  g.filter = 'none';
  // the strokes, each letter its own small tilt and height, darker rim then the red
  let adv = 0;
  const parts = text.split('');
  const pos: number[] = [];
  for (const c of parts) {
    pos.push(adv);
    adv += g.measureText(c).width;
  }
  parts.forEach((c, i) => {
    const px = pos[i]!;
    const py = Math.sin(i * 1.9) * size * 0.03;
    const rot = (r() - 0.5) * 0.08;
    g.save();
    g.translate(px, py);
    g.rotate(rot);
    g.lineJoin = 'round';
    g.strokeStyle = '#3a0406';
    g.lineWidth = size * 0.07;
    g.strokeText(c, 0, 0);
    g.fillStyle = '#7d0c10';
    g.fillText(c, 0, 0);
    // a little shine where it is still wet
    g.fillStyle = 'rgba(200,60,60,0.35)';
    g.fillText(c, -size * 0.02, -size * 0.02);
    g.fillStyle = '#7d0c10';
    g.globalAlpha = 0.85;
    g.fillText(c, size * 0.01, size * 0.01);
    g.globalAlpha = 1;
    g.restore();
  });
  // drips from the bottoms of some of the letters
  g.fillStyle = '#6e0a0d';
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === ' ' || r() < 0.35) continue;
    const dx = pos[i]! + (g.measureText(parts[i]!).width * (0.3 + r() * 0.4));
    const len = size * (0.25 + r() * 0.9);
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
