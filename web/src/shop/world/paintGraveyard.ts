import { makeNoise, seeded, type Ctx } from './noise';

/** One gravestone's outline, standing on (x, y), `s` pixels tall. */
type Stone = { x: number; y: number; s: number; kind: 'round' | 'cross' | 'slab' | 'broken' | 'obelisk' | 'celtic'; tilt: number; depth: number };

function stonePath(g: Ctx, k: Stone['kind'], s: number) {
  const w = s * 0.58;
  g.beginPath();
  switch (k) {
    case 'round':
      g.moveTo(-w / 2, 0);
      g.lineTo(-w / 2, -s + w / 2);
      g.arc(0, -s + w / 2, w / 2, Math.PI, 0);
      g.lineTo(w / 2, 0);
      break;
    case 'slab':
      g.moveTo(-w / 2, 0);
      g.lineTo(-w / 2, -s * 0.82);
      g.quadraticCurveTo(0, -s * 1.02, w / 2, -s * 0.82);
      g.lineTo(w / 2, 0);
      break;
    case 'broken':
      // the top snapped off at an angle
      g.moveTo(-w / 2, 0);
      g.lineTo(-w / 2, -s * 0.78);
      g.lineTo(-w * 0.15, -s * 0.6);
      g.lineTo(w * 0.05, -s * 0.7);
      g.lineTo(w / 2, -s * 0.45);
      g.lineTo(w / 2, 0);
      break;
    case 'cross': {
      const t = s * 0.12;
      g.moveTo(-t, 0);
      g.lineTo(-t, -s * 0.62);
      g.lineTo(-s * 0.3, -s * 0.62);
      g.lineTo(-s * 0.3, -s * 0.62 - t * 2);
      g.lineTo(-t, -s * 0.62 - t * 2);
      g.lineTo(-t, -s);
      g.lineTo(t, -s);
      g.lineTo(t, -s * 0.62 - t * 2);
      g.lineTo(s * 0.3, -s * 0.62 - t * 2);
      g.lineTo(s * 0.3, -s * 0.62);
      g.lineTo(t, -s * 0.62);
      g.lineTo(t, 0);
      break;
    }
    case 'celtic': {
      const t = s * 0.1;
      g.moveTo(-t, 0);
      g.lineTo(-t, -s * 0.55);
      g.lineTo(-s * 0.32, -s * 0.55);
      g.lineTo(-s * 0.32, -s * 0.72);
      g.lineTo(-t, -s * 0.72);
      g.lineTo(-t, -s);
      g.lineTo(t, -s);
      g.lineTo(t, -s * 0.72);
      g.lineTo(s * 0.32, -s * 0.72);
      g.lineTo(s * 0.32, -s * 0.55);
      g.lineTo(t, -s * 0.55);
      g.lineTo(t, 0);
      break;
    }
    case 'obelisk':
      g.moveTo(-w * 0.42, 0);
      g.lineTo(-w * 0.42, -s * 0.12);
      g.lineTo(-w * 0.26, -s * 0.16);
      g.lineTo(-w * 0.18, -s * 0.9);
      g.lineTo(0, -s * 1.05);
      g.lineTo(w * 0.18, -s * 0.9);
      g.lineTo(w * 0.26, -s * 0.16);
      g.lineTo(w * 0.42, -s * 0.12);
      g.lineTo(w * 0.42, 0);
      break;
  }
  g.closePath();
}

/**
 * The graveyard behind the shop, along the bottom of the haunted backdrop: rows of tilted
 * stones and crosses going back into the mist, an iron fence, a dead tree, and, where the
 * jack-o'-lantern sits (`glowX`), its orange light on the nearest stones. Painted once in code.
 * `h` is the band's height; the ground line is near its bottom.
 */
export function paintGraveyard(g: Ctx, w: number, h: number, glowX: number) {
  const r = seeded(1031);
  const n = makeNoise(77);
  g.clearRect(0, 0, w, h);

  // The rise of the burial ground: a dark mound, highest around the lantern.
  const ground = (x: number) => h * 0.62 - Math.exp(-(((x - glowX) / (w * 0.28)) ** 2)) * h * 0.1 + (n(x / 160, 3, 3) - 0.5) * h * 0.06;
  const earth = g.createLinearGradient(0, h * 0.45, 0, h);
  earth.addColorStop(0, '#120a0a');
  earth.addColorStop(1, '#050303');

  // The iron fence along the back, half lost in the mist.
  g.save();
  g.strokeStyle = 'rgba(14,10,12,0.85)';
  g.lineWidth = 2;
  const fenceY = (x: number) => ground(x) - h * 0.1;
  g.beginPath();
  for (let x = 0; x <= w; x += 8) g.lineTo(x, fenceY(x) - h * 0.16);
  g.stroke();
  g.beginPath();
  for (let x = 0; x <= w; x += 8) g.lineTo(x, fenceY(x) - h * 0.05);
  g.stroke();
  g.fillStyle = 'rgba(14,10,12,0.85)';
  for (let x = 6; x < w; x += 14 + r() * 2) {
    const top = fenceY(x) - h * 0.2 - (r() < 0.08 ? -h * 0.06 : 0);
    const lean = (r() - 0.5) * 4;
    g.beginPath();
    g.moveTo(x, fenceY(x) + 2);
    g.lineTo(x + lean, top);
    g.stroke();
    // spear tip
    g.beginPath();
    g.moveTo(x + lean - 3, top + 2);
    g.lineTo(x + lean, top - 7);
    g.lineTo(x + lean + 3, top + 2);
    g.fill();
  }
  g.restore();

  // Stones, from the back row to the front: smaller, paler and mistier further back.
  const stones: Stone[] = [];
  const kinds: Stone['kind'][] = ['round', 'cross', 'slab', 'broken', 'round', 'cross', 'celtic', 'slab', 'obelisk'];
  for (let row = 0; row < 3; row++) {
    const depth = 1 - row / 2; // 1 = far, 0 = near
    const count = [26, 18, 11][row]!;
    for (let i = 0; i < count; i++) {
      // Crowd around the lantern; thinner toward the middle of the page.
      const u = r();
      const x = r() < 0.55 ? glowX + (u - 0.5) * w * (0.45 + row * 0.05) : u * w;
      const base = ground(x) + (1 - depth) * h * 0.22 + r() * h * 0.04;
      const s = h * (0.1 + (1 - depth) * 0.2) * (0.8 + r() * 0.5);
      stones.push({ x, y: base, s, kind: kinds[Math.floor(r() * kinds.length)]!, tilt: (r() - 0.5) * 0.35, depth });
    }
  }

  // Ground behind the front row, then stones row by row, each row's earth in front of it.
  g.fillStyle = earth;
  g.beginPath();
  g.moveTo(0, h);
  for (let x = 0; x <= w; x += 10) g.lineTo(x, ground(x));
  g.lineTo(w, h);
  g.fill();

  stones.sort((a, b) => a.y - b.y);
  for (const st of stones) {
    const near = 1 - st.depth;
    g.save();
    g.translate(st.x, st.y);
    g.rotate(st.tilt);
    stonePath(g, st.kind, st.s);
    // Weathered stone: grey-brown, darker near, lit by the lantern from the side facing it.
    const lit = Math.exp(-(((st.x - glowX) / (w * 0.12)) ** 2)) * (0.4 + near * 0.6);
    const face = g.createLinearGradient(st.x < glowX ? -st.s * 0.3 : st.s * 0.3, 0, st.x < glowX ? st.s * 0.3 : -st.s * 0.3, 0);
    const base = Math.round(34 + st.depth * 26);
    face.addColorStop(0, `rgb(${base} ${base - 4} ${base - 2})`);
    face.addColorStop(1, `rgb(${Math.round(base + 90 * lit)} ${Math.round(base - 4 + 40 * lit)} ${Math.round(base - 2 + 8 * lit)})`);
    g.fillStyle = face;
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 1;
    g.stroke();
    if (st.kind === 'celtic') {
      // the ring through the arms
      g.save();
      g.strokeStyle = face;
      g.lineWidth = st.s * 0.06;
      g.beginPath();
      g.arc(0, -st.s * 0.635, st.s * 0.19, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
    stonePath(g, st.kind, st.s);
    // Moss and grime creeping up from the ground.
    g.save();
    g.clip();
    const grime = g.createLinearGradient(0, 0, 0, -st.s);
    grime.addColorStop(0, 'rgba(8,10,6,0.85)');
    grime.addColorStop(0.45, 'rgba(8,10,6,0)');
    g.fillStyle = grime;
    g.fillRect(-st.s, -st.s * 1.1, st.s * 2, st.s * 1.2);
    // Cut letters on the bigger, nearer stones: a few worn lines, no words to read.
    if (near > 0.4 && (st.kind === 'round' || st.kind === 'slab')) {
      g.fillStyle = 'rgba(0,0,0,0.45)';
      for (let l = 0; l < 3; l++) g.fillRect(-st.s * 0.17, -st.s * (0.66 - l * 0.12), st.s * (0.34 - l * 0.06), Math.max(1, st.s * 0.025));
      g.fillRect(-st.s * 0.02, -st.s * 0.86, st.s * 0.04, st.s * 0.12);
      g.fillRect(-st.s * 0.08, -st.s * 0.82, st.s * 0.16, st.s * 0.035);
    }
    g.restore();
    g.restore();
    // A fresh, open grave in front of a near stone now and then: a black slot of turned earth.
    if (near > 0.9 && r() < 0.3) {
      g.fillStyle = '#020101';
      g.beginPath();
      g.ellipse(st.x, st.y + st.s * 0.18, st.s * 0.5, st.s * 0.1, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#1a0f0b';
      g.beginPath();
      g.ellipse(st.x + st.s * 0.55, st.y + st.s * 0.12, st.s * 0.3, st.s * 0.08, -0.2, 0, Math.PI * 2);
      g.fill();
    }
  }

  // A dead tree leaning over the graves, beyond the lantern.
  g.strokeStyle = '#040203';
  g.lineCap = 'round';
  const branch = (x0: number, y0: number, len: number, a: number, wd: number, depth: number) => {
    if (depth === 0) return;
    const x1 = x0 + Math.cos(a) * len;
    const y1 = y0 + Math.sin(a) * len;
    g.lineWidth = wd;
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo(x0 + Math.cos(a - 0.3) * len * 0.6, y0 + Math.sin(a - 0.3) * len * 0.6, x1, y1);
    g.stroke();
    for (let i = 0; i < 2 + Math.floor(r() * 2); i++) branch(x1, y1, len * (0.55 + r() * 0.2), a + (r() - 0.5) * 1.4, wd * 0.6, depth - 1);
  };
  const tx = Math.min(w - 40, glowX + w * 0.11);
  branch(tx, ground(tx) + h * 0.05, h * 0.3, -Math.PI / 2 - 0.25, h * 0.035, 6);

  // Low mist through the stones: thicker at the back, torn by noise.
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y += 2) {
    const band = Math.exp(-(((y - h * 0.62) / (h * 0.16)) ** 2));
    if (band < 0.03) continue;
    for (let x = 0; x < w; x += 2) {
      const m = Math.max(0, n(x / 120, y / 40, 4) - 0.42) * 1.8 * band;
      if (m <= 0) continue;
      const a = Math.min(0.42, m * 0.8);
      for (let k = 0; k < 4; k++) {
        const i = ((y + (k >> 1)) * w + x + (k & 1)) * 4;
        if (i >= d.length) continue;
        // Mist laid over whatever is there (or over nothing): "over" compositing.
        const alpha = d[i + 3]! / 255;
        const out = a + alpha * (1 - a);
        const mix = (c: number, mist: number) => (mist * a + c * alpha * (1 - a)) / out;
        d[i] = mix(d[i]!, 120);
        d[i + 1] = mix(d[i + 1]!, 118);
        d[i + 2] = mix(d[i + 2]!, 128);
        d[i + 3] = Math.round(255 * out);
      }
    }
  }
  g.putImageData(img, 0, 0);

  // The lantern's light pooling on the ground around it.
  const glowY = ground(glowX) + h * 0.2;
  const glow = g.createRadialGradient(glowX, glowY, 0, glowX, glowY, w * 0.16);
  glow.addColorStop(0, 'rgba(255,120,40,0.32)');
  glow.addColorStop(0.5, 'rgba(255,90,20,0.1)');
  glow.addColorStop(1, 'rgba(255,90,20,0)');
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
}
