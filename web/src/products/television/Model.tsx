import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { seeded } from '../../director/footprints';
import { reducedMotion } from '../../director/runtime';
import { useCanvasTexture } from '../../gl/canvasTex';
import { mat } from '../../gl/decay';
import { M } from '../../gl/materials';
import { useTaken } from '../../gl/useTaken';
import { useHaunted } from '../../store';

/*
 * A 1950s table-top television in walnut, seen from the front and a little from its right: a
 * deep cabinet with rounded front edges on four small feet; on the left two thirds of the front a
 * thick, deeply bevelled brown bakelite bezel round a bulging CRT; on the right third a brushed
 * bronze plate with two ribbed black knobs (CHANNEL, VOLUME) over a slatted speaker grille; on top
 * a round base with two chrome rabbit-ear aerials in a V.
 *
 * By day the screen shows a snowy night: a big pine hung with warm lights, and a log cottage with
 * a thick snow roof, a chimney and every window lit. After the Reveal it shows the same house,
 * cold and grey, under a little flickering static; the cabinet is dark, dusty and scratched,
 * cobwebs hang across its top and in the aerials, and dried blood has run from the bottom of the
 * screen down the front. Taken: a hard cut (no fade, no motion) at CUT seconds to one still
 * picture that stays: a woman right against the glass, her hand pressed flat on it from inside.
 */

type Ctx = CanvasRenderingContext2D;
const V3 = THREE.Vector3;

/** The cut to her picture, seconds after the Take (inside TAKE_MS.television = 2.5 s). */
const CUT = 0.1;

// ---------------------------------------------------------------------------------------------
// Layout (cabinet front face at z = F).

const F = 0.3;
const W = 1.62;
const H = 1.06;
const D = 0.9;
const BOT = -0.57;
const TOP = BOT + H;
const YC = (BOT + TOP) / 2;
/** Radius of the cabinet's rounded edges. */
const EDGE = 0.07;
/** The bezel: centre, half size, corner radius. */
const BX = -0.21;
const BY = 0;
const BHW = 0.5;
const BHH = 0.38;
const BR = 0.13;
/** The tube behind the bezel (a little bigger than the opening, which hides its edges). */
const SW = 0.76;
const SH = 0.58;
/** The control plate: centre and half size. */
const PX = 0.52;
const PY = -0.01;
const PHW = 0.17;
const PHH = 0.39;
const PLATE_FRONT = F + 0.01;
/** The knobs: height and how far each is turned. */
const KNOBS: [number, number][] = [
  [0.21, -0.55],
  [-0.03, 0.85],
];
const SLATS = [-0.175, -0.211, -0.247, -0.283, -0.319, -0.355];
/** The aerial base on top, and the ears. */
const ANT = new V3(-0.05, TOP, -0.12);
const ROD_LEAN = 0.55;
const ROD_BACK = -0.12;

// ---------------------------------------------------------------------------------------------
// Small helpers.

function canvas2d(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** Pictures painted once and shared by every view that shows the set. */
const paintedCache = new Map<string, HTMLCanvasElement>();
function painted(key: string, w: number, h: number, paint: (g: Ctx, w: number, h: number) => void): HTMLCanvasElement {
  let c = paintedCache.get(key);
  if (!c) {
    const [nc, g] = canvas2d(w, h);
    paint(g, w, h);
    c = nc;
    paintedCache.set(key, c);
  }
  return c;
}

const texCache = new Map<string, THREE.CanvasTexture>();
function paintedTexture(
  key: string,
  w: number,
  h: number,
  paint: (g: Ctx, w: number, h: number) => void,
  repeat: [number, number],
  offset: [number, number],
  wrap: boolean,
): THREE.CanvasTexture {
  let t = texCache.get(key);
  if (!t) {
    t = new THREE.CanvasTexture(painted(key, w, h, paint));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
    t.offset.set(offset[0], offset[1]);
    texCache.set(key, t);
  }
  return t;
}

/** Gives a shared material its painted map (once); the map doubles as a faint bump. */
function withMap(m: THREE.MeshPhysicalMaterial, t: THREE.Texture, bump: number): THREE.MeshPhysicalMaterial {
  if (m.map !== t) {
    m.map = t;
    m.bumpMap = t;
    m.bumpScale = bump;
    m.needsUpdate = true;
  }
  return m;
}

function poly(g: Ctx, pts: [number, number][]) {
  g.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
  g.closePath();
}

function glow(g: Ctx, x: number, y: number, r: number, color: string, op: GlobalCompositeOperation = 'lighter') {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color);
  gr.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
  g.save();
  g.globalCompositeOperation = op;
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.restore();
}

function roundedRectShape(hw: number, hh: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh);
  s.absarc(hw - r, -hh + r, r, -Math.PI / 2, 0, false);
  s.lineTo(hw, hh - r);
  s.absarc(hw - r, hh - r, r, 0, Math.PI / 2, false);
  s.lineTo(-hw + r, hh);
  s.absarc(-hw + r, hh - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-hw, -hh + r);
  s.absarc(-hw + r, -hh + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

const NT = 10;
const NA = 10;
const NS = 12;
/** First and last index of the bottom side of a ring (with half of each bottom corner). */
const RING_BOTTOM: [number, number] = [NT + NA + NS + NA - 4, NT + NA + NS + NA + 2 * NT + 4];

/**
 * A rounded rectangle as a closed loop with a fixed number of points per side and corner, so
 * rings of different sizes line up point for point. Starts at the top centre, runs left.
 */
function ring(hw: number, hh: number, r: number): [number, number][] {
  const out: [number, number][] = [];
  const arc = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i < NA; i++) {
      const a = a0 + (Math.PI / 2) * (i / NA);
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  for (let i = 0; i < NT; i++) out.push([-(hw - r) * (i / NT), hh]);
  arc(-hw + r, hh - r, Math.PI / 2);
  for (let i = 0; i < NS; i++) out.push([-hw, hh - r - 2 * (hh - r) * (i / NS)]);
  arc(-hw + r, -hh + r, Math.PI);
  for (let i = 0; i < 2 * NT; i++) out.push([-hw + r + 2 * (hw - r) * (i / (2 * NT)), -hh]);
  arc(hw - r, -hh + r, Math.PI * 1.5);
  for (let i = 0; i < NS; i++) out.push([hw, -hh + r + 2 * (hh - r) * (i / NS)]);
  arc(hw - r, hh - r, 0);
  for (let i = 0; i < NT; i++) out.push([(hw - r) * (1 - i / NT), hh]);
  out.push(out[0]!);
  return out;
}

/** A surface through rows of points (all rows the same length). */
function strip(rows: THREE.Vector3[][], uv: (i: number, j: number, p: THREE.Vector3) => [number, number]): THREE.BufferGeometry {
  const nj = rows.length;
  const ni = rows[0]!.length;
  const pos = new Float32Array(nj * ni * 3);
  const uvs = new Float32Array(nj * ni * 2);
  rows.forEach((row, j) =>
    row.forEach((p, i) => {
      const k = j * ni + i;
      pos[k * 3] = p.x;
      pos[k * 3 + 1] = p.y;
      pos[k * 3 + 2] = p.z;
      const [u, v] = uv(i, j, p);
      uvs[k * 2] = u;
      uvs[k * 2 + 1] = v;
    }),
  );
  const idx: number[] = [];
  for (let j = 0; j < nj - 1; j++) {
    for (let i = 0; i < ni - 1; i++) {
      const a = j * ni + i;
      const c = a + ni;
      idx.push(a, c, a + 1, a + 1, c, c + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function lathe(pts: [number, number][], segs: number): THREE.LatheGeometry {
  return new THREE.LatheGeometry(
    pts.map(([x, y]) => new THREE.Vector2(x, y)),
    segs,
  );
}

// ---------------------------------------------------------------------------------------------
// Materials.

/** Brown bakelite for the bezel, feet and aerial base; after the Reveal dull and dusty. */
const BEZEL = () =>
  mat('tvBezel', {
    surface: 'ceramic',
    color: '#26120a',
    roughness: 0.24,
    clearcoat: 1,
    hauntedColor: '#1f140d',
    matte: 0.65,
    decay: { dust: 0.6, age: 0.25 },
    side: THREE.DoubleSide,
  });
/** Polished walnut, the grain painted across the front. */
const WALNUT = () =>
  withMap(
    mat('tvWalnut', { color: '#ffffff', roughness: 0.3, clearcoat: 1, decay: { age: 0, dust: 0 } }),
    paintedTexture('tvWalnut', 1024, 1024, (g, w, h) => paintWalnut(g, w, h, false), [0.62, 0.9], [0.5, 0.5], true),
    0.1,
  );
/** The same walnut after the Reveal: darker, the polish gone, scratched and dusty. */
const WALNUT_OLD = () =>
  withMap(
    mat('tvWalnutOld', { color: '#ffffff', roughness: 0.78, clearcoat: 0.1, matte: 0.8, decay: { age: 0.15, dust: 0.85 } }),
    paintedTexture('tvWalnutOld', 1024, 1024, (g, w, h) => paintWalnut(g, w, h, true), [0.62, 0.9], [0.5, 0.5], true),
    0.35,
  );
const PLATE = () =>
  withMap(
    mat('tvPlate', { color: '#ffffff', metalness: 0.85, roughness: 0.34, decay: { age: 0, dust: 0.15 } }),
    paintedTexture('tvPlate', 448, 1024, (g, w, h) => paintPlate(g, w, h, false), [1 / (2 * PHW), 1 / (2 * PHH)], [0.5, 0.5], false),
    0.02,
  );
const PLATE_OLD = () =>
  withMap(
    mat('tvPlateOld', { color: '#ffffff', metalness: 0.7, roughness: 0.62, matte: 0.6, decay: { age: 0, dust: 0.6 } }),
    paintedTexture('tvPlateOld', 448, 1024, (g, w, h) => paintPlate(g, w, h, true), [1 / (2 * PHW), 1 / (2 * PHH)], [0.5, 0.5], false),
    0.05,
  );
/** The speaker cloth behind the slats; moth-eaten after the Reveal. */
const CLOTH = () =>
  mat('tvGrilleCloth', { surface: 'fabric', color: '#2b1d12', roughness: 1, hauntedColor: '#17110c', decay: { dust: 0.3, tear: 0.18 } });

// ---------------------------------------------------------------------------------------------
// Painted surfaces.

function paintWalnut(g: Ctx, w: number, h: number, old: boolean) {
  const r = seeded(old ? 913 : 177);
  g.fillStyle = old ? '#3b1d11' : '#5a2112';
  g.fillRect(0, 0, w, h);
  // broad soft bands of lighter and darker heartwood
  for (let i = 0; i < 16; i++) {
    const y = r() * h;
    const bh = 40 + r() * 140;
    const c = r() > 0.5 ? (old ? '96,52,30' : '128,54,28') : old ? '18,8,4' : '50,16,7';
    const gr = g.createLinearGradient(0, y - bh / 2, 0, y + bh / 2);
    gr.addColorStop(0, `rgba(${c},0)`);
    gr.addColorStop(0.5, `rgba(${c},${0.12 + r() * 0.18})`);
    gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr;
    g.fillRect(0, y - bh / 2, w, bh);
  }
  // grain lines running across the front, wavy; drawn three times so it tiles top to bottom
  for (let i = 0; i < 320; i++) {
    const y0 = r() * h;
    const a1 = 3 + r() * 16;
    const f1 = 1 + Math.floor(r() * 3);
    const p1 = r() * 6.283;
    const a2 = r() * 5;
    const f2 = 4 + Math.floor(r() * 6);
    const p2 = r() * 6.283;
    const dark = r() < 0.72;
    const a = dark ? 0.1 + r() * 0.3 : 0.06 + r() * 0.14;
    g.strokeStyle = dark ? (old ? `rgba(12,5,2,${a})` : `rgba(48,14,5,${a})`) : old ? `rgba(120,72,44,${a})` : `rgba(150,72,38,${a})`;
    g.lineWidth = 0.6 + r() * r() * 3;
    for (const dy of [0, -h, h]) {
      g.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const y = y0 + dy + a1 * Math.sin((x / w) * 6.283 * f1 + p1) + a2 * Math.sin((x / w) * 6.283 * f2 + p2);
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
  }
  // flat-sawn figure: nested arches in the middle of the front
  for (let k = 0; k < 11; k++) {
    const cx = w * 0.5;
    const cy = h * 0.52 + k * 11;
    const sw = w * (0.12 + k * 0.03);
    const peak = 70 + k * 6;
    g.strokeStyle = old ? 'rgba(10,4,2,0.22)' : 'rgba(52,16,6,0.26)';
    g.lineWidth = 1.2 + (k % 3) * 0.6;
    g.beginPath();
    for (let x = 0; x <= w; x += 6) {
      const u = (x - cx) / sw;
      const y = cy - peak * Math.exp(-u * u) + 5 * Math.sin(x * 0.01 + k);
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  // pores: short dark dashes along the grain
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = `rgba(20,6,2,${0.08 + r() * 0.16})`;
    g.fillRect(r() * w, r() * h, 2 + r() * 6, 1);
  }
  if (old) paintWear(g, w, h, r);
}

/** Years of neglect: scratches with a pale bottom, a few gouges, worn patches, settled dust. */
function paintWear(g: Ctx, w: number, h: number, r: () => number) {
  g.lineCap = 'round';
  for (let i = 0; i < 230; i++) {
    let x = r() * w;
    let y = r() * h;
    let a = r() * Math.PI;
    const len = 10 + r() * r() * 170;
    const bend = (r() - 0.5) * 0.012;
    g.strokeStyle = `rgba(214,176,136,${0.16 + r() * 0.34})`;
    g.lineWidth = 0.5 + r() * 1.1;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < len; k += 4) {
      a += bend * 4;
      x += Math.cos(a) * 4;
      y += Math.sin(a) * 4;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < 14; i++) {
    const x = r() * w;
    const y = r() * h;
    const a = (r() - 0.5) * 1.2;
    const len = 30 + r() * 90;
    g.strokeStyle = 'rgba(200,160,120,0.45)';
    g.lineWidth = 3.2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
    g.strokeStyle = 'rgba(14,6,3,0.7)';
    g.lineWidth = 1.4;
    g.stroke();
  }
  for (let i = 0; i < 46; i++) {
    const x = r() * w;
    const y = r() * h;
    const rad = 30 + r() * 150;
    const grey = r() < 0.7;
    glow(g, x, y, rad, grey ? `rgba(150,138,120,${0.06 + r() * 0.12})` : `rgba(110,66,40,${0.08 + r() * 0.1})`, 'source-over');
  }
  for (let i = 0; i < 1600; i++) {
    g.fillStyle = `rgba(175,165,145,${0.2 + r() * 0.35})`;
    g.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r() * 1.5);
  }
}

/** Where a point of the plate (relative to its centre, world units) falls on its painted map. */
function platePx(x: number, y: number, w: number, h: number): [number, number] {
  return [(x / (2 * PHW) + 0.5) * w, (0.5 - y / (2 * PHH)) * h];
}

/** Brushed bronze with the two dials engraved round the knobs. */
function paintPlate(g: Ctx, w: number, h: number, old: boolean) {
  const r = seeded(old ? 77 : 55);
  const base = g.createLinearGradient(0, 0, w, h);
  const stops = old ? ['#6e5530', '#4e3b20', '#64502e', '#3f301b'] : ['#caa05a', '#a87d3c', '#d4ae68', '#9c7234'];
  stops.forEach((c, i) => base.addColorStop(i / 3, c));
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  // brushed: fine strokes running up and down
  for (let i = 0; i < 1900; i++) {
    const light = r() < 0.5;
    g.fillStyle = light ? `rgba(255,240,200,${0.03 + r() * 0.07})` : `rgba(60,40,10,${0.03 + r() * 0.07})`;
    const y0 = r() * h;
    g.fillRect(r() * w, y0 - 200, 0.6 + r(), 200 + r() * h);
  }
  const ink = old ? '#1e150a' : '#3a2912';
  g.fillStyle = ink;
  g.strokeStyle = ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  KNOBS.forEach(([ky], n) => {
    const [cx, cy] = platePx(0, ky - PY, w, h);
    const u = h / (2 * PHH);
    // ticks on a 270 degree arc, the open quarter at the bottom
    const ticks = n === 0 ? 12 : 11;
    for (let i = 0; i < ticks; i++) {
      const th = -2.36 + (4.72 * i) / (ticks - 1);
      const r0 = 0.101 * u;
      const r1 = (n === 0 ? 0.112 : 0.106 + 0.008 * (i / (ticks - 1))) * u;
      g.lineWidth = n === 0 ? 3 : 2 + 3 * (i / (ticks - 1));
      g.beginPath();
      g.moveTo(cx + Math.sin(th) * r0, cy - Math.cos(th) * r0);
      g.lineTo(cx + Math.sin(th) * r1, cy - Math.cos(th) * r1);
      g.stroke();
      if (n === 0) {
        g.font = 'bold 19px sans-serif';
        const rt = 0.124 * u;
        g.fillText(String(i + 2), cx + Math.sin(th) * rt, cy - Math.cos(th) * rt);
      }
    }
    g.font = 'bold 21px sans-serif';
    g.fillText(n === 0 ? 'C H A N N E L' : 'V O L U M E', cx, cy + 0.113 * u);
  });
  // dark behind the speaker cloth, so its holes show nothing
  const [gx0, gy0] = platePx(-0.135, -0.265 + 0.1025 - PY, w, h);
  const [gx1, gy1] = platePx(0.135, -0.265 - 0.1025 - PY, w, h);
  g.fillStyle = '#0c0805';
  g.fillRect(gx0, gy0, gx1 - gx0, gy1 - gy0);
  g.fillStyle = ink;
  // a fine engraved border
  g.lineWidth = 2;
  g.strokeRect(16, 16, w - 32, h - 32);
  if (old) {
    for (let i = 0; i < 60; i++) {
      glow(g, r() * w, r() * h, 20 + r() * 90, `rgba(25,16,6,${0.2 + r() * 0.3})`, 'source-over');
    }
    for (let i = 0; i < 70; i++) {
      glow(g, r() * w, r() * h, 3 + r() * 12, `rgba(80,112,92,${0.2 + r() * 0.25})`, 'source-over');
    }
    g.strokeStyle = 'rgba(220,200,160,0.35)';
    for (let i = 0; i < 90; i++) {
      const x = r() * w;
      const y = r() * h;
      const a = r() * Math.PI;
      const l = 8 + r() * 60;
      g.lineWidth = 0.6 + r();
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
  }
}

// ---------------------------------------------------------------------------------------------
// The pictures on the screen.

/** A snowy pine: tiers of drooping boughs, snow lying on each, string lights if given. */
function paintPine(g: Ctx, x: number, base: number, halfW: number, height: number, tiers: number, fill: string, snow: string, shade: string, r: () => number, lights = false) {
  const th = height / (tiers * 0.62 + 0.38);
  for (let k = 0; k < tiers; k++) {
    const yb = base - k * th * 0.62;
    const yt = yb - th;
    const wk = halfW * (1 - (k / tiers) * 0.82);
    const tips = Math.max(4, Math.round(wk / 14));
    const bough = new Path2D();
    bough.moveTo(x, yt);
    bough.quadraticCurveTo(x - wk * 0.35, yb - th * 0.45, x - wk, yb);
    for (let j = 1; j <= tips; j++) {
      const px = x - wk + (2 * wk * j) / tips;
      bough.lineTo(px - wk / tips, yb - th * (0.08 + 0.06 * r()));
      bough.lineTo(px, yb + th * 0.04 * r());
    }
    bough.quadraticCurveTo(x + wk * 0.35, yb - th * 0.45, x, yt);
    g.fillStyle = fill;
    g.fill(bough);
    // snow lying on the upper side of the tier, with a lumpy hanging edge and a blue shadow
    g.save();
    g.clip(bough);
    const sl = yb - th * 0.44;
    const lumps = tips * 2;
    const ys: number[] = [];
    for (let j = 0; j <= lumps; j++) ys.push(th * (0.08 + 0.12 * r()));
    for (const [col, dy] of [
      [shade, th * 0.06],
      [snow, 0],
    ] as const) {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(x - wk * 1.1, yt - 6);
      g.lineTo(x + wk * 1.1, yt - 6);
      g.lineTo(x + wk * 1.1, sl + dy);
      for (let j = lumps; j > 0; j--) {
        const p0 = x - wk * 1.1 + (2.2 * wk * j) / lumps;
        const p1 = x - wk * 1.1 + (2.2 * wk * (j - 1)) / lumps;
        g.quadraticCurveTo((p0 + p1) / 2, sl + dy + (ys[j] ?? 0), p1, sl + dy);
      }
      g.closePath();
      g.fill();
    }
    g.restore();
    if (lights && k < tiers - 1) paintGarland(g, x, yb, wk, th, r);
  }
}

const BULBS = ['#ffd27a', '#ffb85c', '#ffe6a8', '#ff9d5c', '#ffc96b'];

/** A drooping string of warm bulbs across one tier of the big pine. */
function paintGarland(g: Ctx, x: number, yb: number, wk: number, th: number, r: () => number) {
  const x0 = x - wk * 0.82;
  const x1 = x + wk * 0.82;
  const y0 = yb - th * 0.34;
  const y1 = yb - th * 0.22;
  const at = (t: number): [number, number] => [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + th * 0.2 * 4 * t * (1 - t)];
  g.strokeStyle = 'rgba(10,22,14,0.8)';
  g.lineWidth = 1.2;
  g.beginPath();
  for (let i = 0; i <= 24; i++) {
    const [px, py] = at(i / 24);
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.stroke();
  const n = Math.max(4, Math.round(wk / 15));
  for (let i = 0; i <= n; i++) {
    const [px, py] = at((i + 0.3 * r()) / (n + 0.3));
    const c = BULBS[Math.floor(r() * BULBS.length)] ?? '#ffd27a';
    glow(g, px, py, 11, 'rgba(255,196,110,0.5)');
    g.fillStyle = c;
    g.beginPath();
    g.arc(px, py + 1.5, 2.8, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff6d8';
    g.beginPath();
    g.arc(px - 0.6, py + 0.8, 1.1, 0, Math.PI * 2);
    g.fill();
  }
}

/** A lit window: warm pane, cross bars, white trim, snow on the sill. Corners tl, tr, br, bl. */
function paintWindow(g: Ctx, q: [number, number][]) {
  const [tl, tr, br, bl] = q as [[number, number], [number, number], [number, number], [number, number]];
  const cx = (tl[0] + tr[0] + br[0] + bl[0]) / 4;
  const cy = (tl[1] + tr[1] + br[1] + bl[1]) / 4;
  const size = Math.max(Math.abs(tr[0] - tl[0]), Math.abs(bl[1] - tl[1]));
  const pane = g.createRadialGradient(cx, cy, 1, cx, cy, size * 0.8);
  pane.addColorStop(0, '#fff3c4');
  pane.addColorStop(0.55, '#ffc65a');
  pane.addColorStop(1, '#d9842a');
  g.fillStyle = pane;
  poly(g, q);
  g.fill();
  g.strokeStyle = '#3a2110';
  g.lineWidth = 2.4;
  g.beginPath();
  g.moveTo((tl[0] + tr[0]) / 2, (tl[1] + tr[1]) / 2);
  g.lineTo((bl[0] + br[0]) / 2, (bl[1] + br[1]) / 2);
  g.moveTo((tl[0] + bl[0]) / 2, (tl[1] + bl[1]) / 2);
  g.lineTo((tr[0] + br[0]) / 2, (tr[1] + br[1]) / 2);
  g.stroke();
  g.strokeStyle = '#d8d2c4';
  g.lineWidth = 2;
  poly(g, q);
  g.stroke();
  g.strokeStyle = '#f2f6fc';
  g.lineWidth = 4;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(bl[0] - 2, bl[1] + 2);
  g.lineTo(br[0] + 2, br[1] + 2);
  g.stroke();
}

/** The log cottage, its gable toward us and its long side going away to the right. */
function paintCottage(g: Ctx, w: number, h: number, r: () => number) {
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const gy = h * 0.8;
  const fx0 = w * 0.5;
  const fx1 = w * 0.648;
  const wt = gy - h * 0.12;
  const px = (fx0 + fx1) / 2;
  const py = wt - h * 0.1;
  const sx = w * 0.86;
  const farBot = gy - h * 0.02;
  const farTop = wt + h * 0.01;
  // the long side, in shadow, with its logs
  g.fillStyle = '#4a2a16';
  poly(g, [
    [fx1, wt],
    [sx, farTop],
    [sx, farBot],
    [fx1, gy],
  ]);
  g.fill();
  for (let k = 1; k < 9; k++) {
    const t = k / 9;
    g.strokeStyle = '#26140a';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(fx1, lerp(wt, gy, t));
    g.lineTo(sx, lerp(farTop, farBot, t));
    g.stroke();
    g.strokeStyle = 'rgba(120,76,44,0.6)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(fx1, lerp(wt, gy, t) + 2);
    g.lineTo(sx, lerp(farTop, farBot, t) + 2);
    g.stroke();
  }
  // the gable end
  const front: [number, number][] = [
    [fx0, gy],
    [fx0, wt],
    [px, py],
    [fx1, wt],
    [fx1, gy],
  ];
  g.fillStyle = '#6e4123';
  poly(g, front);
  g.fill();
  g.save();
  poly(g, front);
  g.clip();
  for (let y = py + 10; y < gy; y += (gy - wt) / 9) {
    g.strokeStyle = '#2e180b';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(fx0, y);
    g.lineTo(fx1, y);
    g.stroke();
    g.strokeStyle = 'rgba(150,96,56,0.55)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(fx0, y + 2);
    g.lineTo(fx1, y + 2);
    g.stroke();
  }
  g.restore();
  g.strokeStyle = '#26140a';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(fx1, wt);
  g.lineTo(fx1, gy);
  g.stroke();
  // the door with a wreath
  const dw = w * 0.034;
  const dh = h * 0.078;
  g.fillStyle = '#2b170b';
  g.beginPath();
  g.moveTo(px - dw / 2, gy);
  g.lineTo(px - dw / 2, gy - dh + dw / 2);
  g.arc(px, gy - dh + dw / 2, dw / 2, Math.PI, 0);
  g.lineTo(px + dw / 2, gy);
  g.closePath();
  g.fill();
  g.strokeStyle = '#4a2c16';
  g.lineWidth = 1;
  for (const dx of [-dw / 6, dw / 6]) {
    g.beginPath();
    g.moveTo(px + dx, gy);
    g.lineTo(px + dx, gy - dh + 6);
    g.stroke();
  }
  g.strokeStyle = '#1f4a26';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(px, gy - dh * 0.66, w * 0.009, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#b3242a';
  g.beginPath();
  g.arc(px, gy - dh * 0.66 - w * 0.009, 3, 0, Math.PI * 2);
  g.fill();
  // windows: two by the door, one up in the gable, two along the side
  const ww = w * 0.026;
  const wh = h * 0.042;
  for (const cx of [px - w * 0.048, px + w * 0.048]) {
    const y0 = wt + h * 0.036;
    paintWindow(g, [
      [cx - ww / 2, y0],
      [cx + ww / 2, y0],
      [cx + ww / 2, y0 + wh],
      [cx - ww / 2, y0 + wh],
    ]);
  }
  const ay = wt - h * 0.035;
  paintWindow(g, [
    [px - 9, ay - 9],
    [px + 9, ay - 9],
    [px + 9, ay + 9],
    [px - 9, ay + 9],
  ]);
  const sideWins: [number, number][] = [];
  for (const t of [0.24, 0.62]) {
    const t1 = t + 0.17 * (1 - t * 0.3);
    const xa = lerp(fx1, sx, t);
    const xb = lerp(fx1, sx, t1);
    const top = (u: number) => lerp(lerp(wt, gy, 0.24), lerp(farTop, farBot, 0.24), u);
    const bot = (u: number) => lerp(lerp(wt, gy, 0.6), lerp(farTop, farBot, 0.6), u);
    paintWindow(g, [
      [xa, top(t)],
      [xb, top(t1)],
      [xb, bot(t1)],
      [xa, bot(t)],
    ]);
    sideWins.push([(xa + xb) / 2, (top(t) + bot(t)) / 2]);
  }
  // the roof: the near slope seen from the side, under a thick lip of snow
  const dx = sx - fx1;
  const dy = farTop - wt;
  const ridgeF: [number, number] = [px, py];
  const ridgeB: [number, number] = [px + dx, py + dy * 0.6];
  const eaveF: [number, number] = [fx1 + 12, wt + 4];
  const eaveB: [number, number] = [sx + 12, farTop + 3];
  g.fillStyle = '#2a1a12';
  poly(g, [ridgeF, ridgeB, eaveB, eaveF]);
  g.fill();
  // the chimney, stone, on the far half of the roof, with smoke
  const cx = lerp(ridgeF[0], ridgeB[0], 0.72) + 18;
  const cyTop = lerp(ridgeF[1], ridgeB[1], 0.72) - 34;
  g.fillStyle = '#5b4034';
  g.fillRect(cx - 12, cyTop, 24, 62);
  g.strokeStyle = 'rgba(30,18,12,0.7)';
  g.lineWidth = 1;
  for (let y = cyTop + 8; y < cyTop + 60; y += 8) {
    g.beginPath();
    g.moveTo(cx - 12, y);
    g.lineTo(cx + 12, y);
    g.stroke();
  }
  g.save();
  g.filter = 'blur(5px)';
  g.strokeStyle = 'rgba(205,214,230,0.2)';
  g.lineWidth = 12;
  g.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.moveTo(cx, cyTop - 4);
    g.bezierCurveTo(cx - 10 - i * 8, cyTop - 40, cx + 16, cyTop - 70 - i * 10, cx - 30 - i * 14, cyTop - 120 - i * 16);
    g.stroke();
  }
  g.restore();
  g.fillStyle = '#eef3fb';
  g.beginPath();
  g.ellipse(cx, cyTop, 16, 6, 0, 0, Math.PI * 2);
  g.fill();
  // the snow on the roof: lumpy along the ridge, a thick rounded lip hanging over the eave
  const snow = g.createLinearGradient(0, py - 14, 0, wt + 14);
  snow.addColorStop(0, '#f6f9fe');
  snow.addColorStop(0.7, '#e3eaf6');
  snow.addColorStop(1, '#b7c6df');
  g.fillStyle = snow;
  g.beginPath();
  g.moveTo(ridgeF[0] - 4, ridgeF[1] - 14);
  const bumps = 9;
  for (let i = 1; i <= bumps; i++) {
    const t = i / bumps;
    const bx = lerp(ridgeF[0], ridgeB[0] + 6, t);
    const by = lerp(ridgeF[1] - 14, ridgeB[1] - 10, t);
    g.quadraticCurveTo(bx - 10, by - 6 - r() * 4, bx, by);
  }
  g.lineTo(eaveB[0] + 6, eaveB[1] + 4);
  for (let i = bumps; i >= 0; i--) {
    const t = i / bumps;
    const ex = lerp(eaveF[0] + 4, eaveB[0] + 6, t);
    const ey = lerp(eaveF[1] + 8, eaveB[1] + 4, t);
    g.quadraticCurveTo(ex + 14, ey + 9 + r() * 4, ex, ey);
  }
  g.closePath();
  g.fill();
  // the snow on the gable's edges
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeStyle = '#9fb0cf';
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(fx0 - 10, wt + 9);
  g.lineTo(px, py - 6);
  g.stroke();
  g.strokeStyle = '#f2f6fc';
  g.lineWidth = 15;
  g.beginPath();
  g.moveTo(fx0 - 12, wt + 4);
  g.lineTo(px, py - 12);
  g.lineTo(fx1 + 12, wt + 4);
  g.stroke();
  // icicles under the eaves
  g.fillStyle = '#dce8f7';
  for (let i = 0; i < 16; i++) {
    const t = (i + 0.5) / 16;
    const ix = lerp(eaveF[0] + 4, eaveB[0], t);
    const iy = lerp(eaveF[1] + 12, eaveB[1] + 8, t);
    const len = 5 + r() * 12;
    g.beginPath();
    g.moveTo(ix - 2.5, iy);
    g.lineTo(ix + 2.5, iy);
    g.lineTo(ix, iy + len);
    g.closePath();
    g.fill();
  }
  // snow banked against the walls
  g.fillStyle = '#e9eff9';
  for (let i = 0; i < 12; i++) {
    const bx = lerp(fx0 - 10, sx + 10, i / 11);
    const by = lerp(gy, farBot, Math.max(0, (bx - fx1) / (sx - fx1)));
    g.beginPath();
    g.ellipse(bx, by + 2, 26 + r() * 10, 9 + r() * 4, 0, 0, Math.PI * 2);
    g.fill();
  }
  // warm light from every window, on the snow and in the air
  for (const [wx, wy] of [[px - w * 0.048, wt + h * 0.057], [px + w * 0.048, wt + h * 0.057], [px, ay], ...sideWins] as [number, number][]) {
    glow(g, wx, wy, 70, 'rgba(255,176,84,0.3)');
    glow(g, wx, gy + 24, 60, 'rgba(255,170,80,0.16)');
  }
  // a trodden path from the door
  g.strokeStyle = 'rgba(112,130,172,0.3)';
  g.lineWidth = 24;
  g.beginPath();
  g.moveTo(px, gy + 6);
  g.quadraticCurveTo(px - 30, h * 0.9, px - 90, h + 20);
  g.stroke();
}

/** Tonight on the set: a snowy house with every window lit, by a big pine hung with lights. */
function paintChristmas(g: Ctx, w: number, h: number) {
  const r = seeded(1225);
  const sky = g.createLinearGradient(0, 0, 0, h * 0.74);
  sky.addColorStop(0, '#050a1e');
  sky.addColorStop(0.5, '#0d1c44');
  sky.addColorStop(1, '#2a4473');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  glow(g, w * 0.62, h * 0.62, w * 0.45, 'rgba(110,140,190,0.26)');
  // stars, more of them high up; a few bright ones with a glint
  for (let i = 0; i < 260; i++) {
    const x = r() * w;
    const y = Math.pow(r(), 1.3) * h * 0.6;
    const s = 0.5 + Math.pow(r(), 4) * 2.2;
    g.fillStyle = `rgba(230,236,255,${0.35 + 0.65 * r()})`;
    g.beginPath();
    g.arc(x, y, s, 0, Math.PI * 2);
    g.fill();
  }
  g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const x = r() * w;
    const y = r() * h * 0.4;
    const l = 5 + r() * 6;
    glow(g, x, y, l * 1.6, 'rgba(220,230,255,0.45)');
    g.strokeStyle = 'rgba(235,240,255,0.7)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x - l, y);
    g.lineTo(x + l, y);
    g.moveTo(x, y - l);
    g.lineTo(x, y + l);
    g.stroke();
  }
  // far snowy hills with a line of small dark pines
  const hill = (x: number) => h * 0.64 - 18 * Math.sin((x / w) * 8.2 + 0.6) - 10 * Math.sin((x / w) * 19.5 + 1.2);
  const hg = g.createLinearGradient(0, h * 0.58, 0, h * 0.76);
  hg.addColorStop(0, '#6f86ad');
  hg.addColorStop(1, '#4a5f86');
  g.fillStyle = hg;
  g.beginPath();
  g.moveTo(0, h);
  for (let x = 0; x <= w; x += 16) g.lineTo(x, hill(x));
  g.lineTo(w, h);
  g.closePath();
  g.fill();
  for (let i = 0; i < 48; i++) {
    const x = r() * w;
    const s = 18 + r() * 26;
    paintPine(g, x, hill(x) + 6, s * 0.32, s, 3, '#13243a', '#7d93b9', '#5a6f96', r);
  }
  // darker pines behind the house
  for (const [x, t] of [
    [0.44, 0.3],
    [0.48, 0.22],
    [0.79, 0.25],
    [0.87, 0.34],
    [0.94, 0.27],
    [0.995, 0.31],
  ] as const) {
    paintPine(g, x * w, h * 0.79, t * h * 0.36, t * h, 5, '#0c1b25', '#c9d6ea', '#8496b8', r);
  }
  // the snow-covered ground
  const ground = g.createLinearGradient(0, h * 0.72, 0, h);
  ground.addColorStop(0, '#8ea2c4');
  ground.addColorStop(0.45, '#d6e0f0');
  ground.addColorStop(1, '#f1f5fc');
  g.fillStyle = ground;
  g.beginPath();
  g.moveTo(0, h);
  for (let x = 0; x <= w; x += 16) g.lineTo(x, h * 0.75 + 7 * Math.sin((x / w) * 9.1 + 2) + 4 * Math.sin((x / w) * 23));
  g.lineTo(w, h);
  g.closePath();
  g.fill();
  for (let i = 0; i < 14; i++) {
    g.fillStyle = `rgba(118,138,186,${0.1 + r() * 0.12})`;
    g.beginPath();
    g.ellipse(r() * w, h * (0.8 + r() * 0.18), 60 + r() * 120, 8 + r() * 10, 0, 0, Math.PI * 2);
    g.fill();
  }
  paintCottage(g, w, h, r);
  // the big pine on the left, laden with snow and hung with warm lights, on its own drift
  g.fillStyle = '#3a2414';
  g.fillRect(w * 0.2 - 9, h * 0.8, 18, h * 0.08);
  paintPine(g, w * 0.2, h * 0.86, w * 0.17, h * 0.8, 7, '#0f2b1c', '#eef4fe', '#9fb3d4', r, true);
  glow(g, w * 0.2, h * 0.5, w * 0.2, 'rgba(255,170,80,0.08)');
  g.fillStyle = '#eef3fb';
  g.beginPath();
  g.ellipse(w * 0.2, h * 0.88, w * 0.2, h * 0.04, 0, 0, Math.PI * 2);
  g.fill();
  // falling snow: small and sharp far off, big and soft close by
  for (let i = 0; i < 340; i++) {
    const x = r() * w;
    const y = r() * h;
    const s = 0.6 + Math.pow(r(), 3) * 3.8;
    const a = 0.45 + 0.5 * r();
    if (s > 2.6) glow(g, x, y, s * 1.8, `rgba(240,245,255,${a * 0.8})`, 'source-over');
    else {
      g.fillStyle = `rgba(240,245,255,${a})`;
      g.beginPath();
      g.arc(x, y, s, 0, Math.PI * 2);
      g.fill();
    }
  }
  // an old tube's softness: the bright parts bloom a little; the corners fall off
  const [bc, b] = canvas2d(w, h);
  b.filter = 'blur(10px)';
  b.drawImage(g.canvas, 0, 0);
  g.save();
  g.globalCompositeOperation = 'screen';
  g.globalAlpha = 0.32;
  g.drawImage(bc, 0, 0);
  g.restore();
}

/** The hand colours: the lit skin, the shadow at its edges, and where it presses on the glass. */
export interface HandTone {
  skin: string;
  shade: string;
  press: string;
}

/** Long slender fingers, spread: base x, base y, lean (toward the thumb), length, width at base and tip. */
const FINGERS: [number, number, number, number, number, number][] = [
  [-0.175, -0.05, -0.34, 0.3, 0.074, 0.06],
  [-0.08, -0.095, -0.13, 0.39, 0.08, 0.064],
  [0.022, -0.105, 0.03, 0.43, 0.083, 0.066],
  [0.12, -0.08, 0.2, 0.38, 0.08, 0.064],
];
const THUMB: [number, number, number, number, number, number] = [0.17, 0.15, 0.95, 0.31, 0.105, 0.078];

/** A finger as a tapered outline with a round tip (hand units, fingers up, thumb toward +x). */
function fingerOutline(f: [number, number, number, number, number, number]): [number, number][] {
  const [bx, by, lean, len, w0, w1] = f;
  const dx = Math.sin(lean);
  const dy = -Math.cos(lean);
  const qx = Math.cos(lean);
  const qy = Math.sin(lean);
  const sx = bx - dx * 0.06;
  const sy = by - dy * 0.06;
  const tx = bx + dx * (len - w1 / 2);
  const ty = by + dy * (len - w1 / 2);
  const out: [number, number][] = [[sx - (qx * w0) / 2, sy - (qy * w0) / 2]];
  for (let k = 0; k <= 10; k++) {
    const a = (Math.PI * k) / 10;
    out.push([tx + (w1 / 2) * (-qx * Math.cos(a) + dx * Math.sin(a)), ty + (w1 / 2) * (-qy * Math.cos(a) + dy * Math.sin(a))]);
  }
  out.push([sx + (qx * w0) / 2, sy + (qy * w0) / 2]);
  return out;
}

/**
 * Her hand, pressed flat from the other side of the glass: palm toward us, the long fingers
 * spread, the pads where it presses whiter and flattened, the edges falling into shadow, the
 * wrist fading out to nothing. The television's ghost has it on the screen; the snow globe's
 * hands are the same hand. `size` is about the height from the palm's centre to the wrist's end
 * plus the fingers (pixels); the thumb points toward +x unless mirrored.
 */
export function paintGhostHand(g: Ctx, cx: number, cy: number, size: number, tone: HandTone, opts: { mirror?: boolean; wrist?: number; halo?: boolean } = {}) {
  const { mirror = false, wrist = 0.45, halo = false } = opts;
  const pad = Math.ceil(size * 0.08);
  const left = 0.34;
  const right = 0.48;
  const top = 0.6;
  const bottom = 0.3 + wrist;
  const bw = Math.ceil((left + right) * size) + pad * 2;
  const bh = Math.ceil((top + bottom) * size) + pad * 2;
  const ox = pad + (mirror ? right : left) * size;
  const oy = pad + top * size;
  const sx = mirror ? -size : size;
  const P = (x: number, y: number): [number, number] => [ox + x * sx, oy + y * size];
  const shapes: Path2D[] = [];
  const palm = new Path2D();
  const m = (x: number, y: number) => palm.moveTo(...P(x, y));
  const l = (x: number, y: number) => palm.lineTo(...P(x, y));
  const b = (a: number, c: number, d: number, e: number, f: number, h: number) => palm.bezierCurveTo(...P(a, c), ...P(d, e), ...P(f, h));
  m(-0.205, -0.07);
  b(-0.245, 0.03, -0.235, 0.17, -0.17, 0.28);
  l(-0.13, 0.3 + wrist);
  l(0.1, 0.3 + wrist);
  l(0.11, 0.3);
  b(0.2, 0.26, 0.24, 0.16, 0.22, 0.07);
  b(0.205, 0, 0.19, -0.06, 0.165, -0.09);
  b(0.08, -0.125, -0.08, -0.12, -0.205, -0.07);
  palm.closePath();
  shapes.push(palm);
  for (const f of [...FINGERS, THUMB]) {
    const p = new Path2D();
    fingerOutline(f).forEach(([x, y], i) => (i === 0 ? p.moveTo(...P(x, y)) : p.lineTo(...P(x, y))));
    p.closePath();
    shapes.push(p);
  }
  // the silhouette, filled shape by shape (so overlaps join instead of cancelling)
  const [mc, mk] = canvas2d(bw, bh);
  mk.fillStyle = '#fff';
  shapes.forEach((s) => mk.fill(s));
  const [hc, hk] = canvas2d(bw, bh);
  const skin = hk.createLinearGradient(0, oy - 0.6 * size, 0, oy + bottom * size);
  skin.addColorStop(0, tone.skin);
  skin.addColorStop(0.6, tone.skin);
  skin.addColorStop(1, tone.shade);
  hk.fillStyle = skin;
  shapes.forEach((s) => hk.fill(s));
  // shadow creeping in from every edge, so it reads round and not cut out
  const [sc, sk] = canvas2d(bw, bh);
  sk.fillStyle = tone.shade;
  sk.fillRect(0, 0, bw, bh);
  sk.globalCompositeOperation = 'destination-out';
  sk.filter = `blur(${Math.max(1, size * 0.03)}px)`;
  sk.drawImage(mc, 0, 0);
  sk.filter = 'none';
  sk.globalCompositeOperation = 'destination-in';
  sk.drawImage(mc, 0, 0);
  hk.globalAlpha = 0.9;
  hk.drawImage(sc, 0, 0);
  hk.globalAlpha = 1;
  // creases at the finger joints and across the palm, and the pads squashed white on the glass
  hk.globalCompositeOperation = 'source-atop';
  hk.strokeStyle = tone.shade;
  hk.lineCap = 'round';
  hk.lineWidth = Math.max(1, size * 0.006);
  hk.globalAlpha = 0.45;
  for (const [bx, by, lean, len, w0] of FINGERS) {
    const dx = Math.sin(lean);
    const dy = -Math.cos(lean);
    for (const t of [0.36, 0.64]) {
      const cxf = bx + dx * len * t;
      const cyf = by + dy * len * t;
      const half = w0 * 0.36;
      hk.beginPath();
      hk.moveTo(...P(cxf - Math.cos(lean) * half, cyf - Math.sin(lean) * half));
      hk.lineTo(...P(cxf + Math.cos(lean) * half, cyf + Math.sin(lean) * half));
      hk.stroke();
    }
  }
  hk.globalAlpha = 0.32;
  for (const [a, c, d, e, f, h] of [
    [-0.2, 0.0, -0.05, -0.05, 0.13, -0.045],
    [-0.21, 0.07, -0.05, 0.03, 0.14, 0.045],
    [0.15, -0.03, 0.04, 0.08, 0.02, 0.27],
  ] as const) {
    hk.beginPath();
    hk.moveTo(...P(a, c));
    hk.quadraticCurveTo(...P(d, e), ...P(f, h));
    hk.stroke();
  }
  hk.globalAlpha = 1;
  const pressAt = (x: number, y: number, rad: number, a: number) => {
    const [qx, qy] = P(x, y);
    const gr = hk.createRadialGradient(qx, qy, 0, qx, qy, rad * size);
    gr.addColorStop(0, tone.press);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    hk.globalAlpha = a;
    hk.fillStyle = gr;
    hk.fillRect(qx - rad * size, qy - rad * size, rad * size * 2, rad * size * 2);
  };
  for (const [bx, by, lean, len, , w1] of [...FINGERS, THUMB]) {
    const k = len - w1 * 0.75;
    pressAt(bx + Math.sin(lean) * k, by - Math.cos(lean) * k, w1 * 0.75, 0.85);
  }
  for (const [x, y] of [
    [-0.15, -0.02],
    [-0.05, -0.06],
    [0.06, -0.07],
    [0.14, -0.04],
  ] as const)
    pressAt(x, y, 0.06, 0.6);
  pressAt(-0.13, 0.2, 0.1, 0.55);
  pressAt(0.13, 0.15, 0.1, 0.55);
  hk.globalAlpha = 1;
  // the wrist fades out: there is no arm to see
  for (const k of [hk, mk]) {
    k.globalCompositeOperation = 'destination-in';
    const fade = k.createLinearGradient(0, oy + 0.24 * size, 0, oy + bottom * size);
    fade.addColorStop(0, 'rgba(0,0,0,1)');
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    k.fillStyle = fade;
    k.fillRect(0, 0, bw, bh);
  }
  if (halo) {
    // the breath of cold round a hand held against glass
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.2;
    g.filter = `blur(${Math.max(2, size * 0.045)}px)`;
    g.drawImage(mc, cx - ox, cy - oy);
    g.restore();
  }
  g.drawImage(hc, cx - ox, cy - oy);
}

const TV_HAND: HandTone = { skin: '#c3c9cf', shade: '#454d55', press: '#f2f4f6' };

/**
 * Her picture, the one that stays on after the Take: black and white, a woman right against the
 * glass on the right, long wet black hair round a white face, dark sunken eyes, the mouth open
 * in a scream; her hand, on our left, pressed flat on the inside of the screen. Behind her,
 * very faint, the same house. Painted grey; the screen tints it blue-grey.
 */
function paintGhost(g: Ctx, w: number, h: number) {
  const r = seeded(1031);
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#2a3138');
  bg.addColorStop(0.5, '#14181c');
  bg.addColorStop(1, '#090b0d');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.save();
  g.globalAlpha = 0.12;
  g.filter = 'grayscale(1) blur(3px) brightness(0.6)';
  g.drawImage(painted('tvXmas', w, h, paintChristmas), 0, 0, w, h);
  g.restore();
  const fx = w * 0.69;
  const fy = h * 0.43;
  // she is right against the glass: her head fills the right half, the crown cut off by the top
  g.save();
  g.translate(fx, fy);
  g.scale(1.45, 1.45);
  g.translate(-fx, -fy);
  const rx = w * 0.115;
  const ry = h * 0.23;
  glow(g, fx, fy - h * 0.08, w * 0.32, 'rgba(150,160,170,0.22)', 'source-over');
  // the hair behind: a long dark mass falling past the bottom of the picture
  g.fillStyle = '#06080a';
  g.beginPath();
  g.moveTo(fx - w * 0.06, h * 0.12);
  g.bezierCurveTo(fx - w * 0.17, h * 0.13, fx - w * 0.21, h * 0.35, fx - w * 0.24, h);
  g.lineTo(fx + w * 0.25, h);
  g.bezierCurveTo(fx + w * 0.22, h * 0.35, fx + w * 0.17, h * 0.12, fx + w * 0.05, h * 0.11);
  g.closePath();
  g.fill();
  g.lineCap = 'round';
  for (let i = 0; i < 170; i++) {
    const side = r() < 0.5 ? -1 : 1;
    const x0 = fx + (r() - 0.5) * w * 0.12;
    const y0 = h * (0.11 + r() * 0.04);
    const wet = r() < 0.22;
    g.strokeStyle = wet ? `rgba(120,132,142,${0.15 + r() * 0.2})` : '#0b0e11';
    g.lineWidth = wet ? 1 : 1 + r() * 2.5;
    g.beginPath();
    g.moveTo(x0, y0);
    g.bezierCurveTo(
      fx + side * (w * 0.12 + r() * w * 0.08),
      h * 0.22,
      fx + side * (w * 0.14 + r() * w * 0.1),
      h * 0.55,
      fx + side * (w * 0.12 + r() * w * 0.14),
      h * (0.8 + r() * 0.3),
    );
    g.stroke();
  }
  // the neck, mostly lost in the hair
  const neck = g.createLinearGradient(0, fy + ry * 0.7, 0, h);
  neck.addColorStop(0, '#6b737a');
  neck.addColorStop(1, '#15191c');
  g.fillStyle = neck;
  g.fillRect(fx - w * 0.045, fy + ry * 0.7, w * 0.09, h);
  // the face: long, white, the jaw narrowing
  const face = g.createRadialGradient(fx - w * 0.01, fy - h * 0.04, 4, fx, fy, ry * 1.05);
  face.addColorStop(0, '#e2e6e9');
  face.addColorStop(0.5, '#bfc6cc');
  face.addColorStop(0.82, '#7f888f');
  face.addColorStop(1, '#3f474e');
  g.fillStyle = face;
  g.beginPath();
  g.moveTo(fx, fy - ry);
  g.bezierCurveTo(fx + rx * 1.1, fy - ry, fx + rx * 1.05, fy + ry * 0.2, fx + rx * 0.62, fy + ry * 0.72);
  g.quadraticCurveTo(fx, fy + ry * 1.12, fx - rx * 0.62, fy + ry * 0.72);
  g.bezierCurveTo(fx - rx * 1.05, fy + ry * 0.2, fx - rx * 1.1, fy - ry, fx, fy - ry);
  g.fill();
  // hollow cheeks
  for (const s of [-1, 1]) glow(g, fx + s * rx * 0.62, fy + ry * 0.28, rx * 0.4, 'rgba(40,46,52,0.45)', 'source-over');
  // dark sunken eyes
  for (const s of [-1, 1]) {
    const ex = fx + s * w * 0.048;
    const ey = fy - h * 0.045;
    glow(g, ex, ey, w * 0.062, 'rgba(26,30,36,0.85)', 'source-over');
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.9)';
    g.shadowBlur = 10;
    g.fillStyle = '#020304';
    g.beginPath();
    g.ellipse(ex, ey, w * 0.03, h * 0.026, s * 0.12, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.fillStyle = 'rgba(200,210,220,0.45)';
    g.beginPath();
    g.arc(ex - s * 3, ey - 2, 1.6, 0, Math.PI * 2);
    g.fill();
  }
  // the nose, a shadow and two nostrils
  g.save();
  g.filter = 'blur(2px)';
  g.strokeStyle = 'rgba(70,78,86,0.4)';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(fx - 2, fy - h * 0.01);
  g.quadraticCurveTo(fx + 6, fy + h * 0.035, fx + 3, fy + h * 0.062);
  g.stroke();
  g.restore();
  g.fillStyle = 'rgba(20,24,28,0.8)';
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(fx + s * w * 0.012, fy + h * 0.068, 4, 2.5, 0, 0, Math.PI * 2);
    g.fill();
  }
  // the scream: the mouth stretched open, long and black, lines pulled down from the nose
  g.strokeStyle = 'rgba(50,56,62,0.5)';
  g.lineWidth = 2;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(fx + s * w * 0.022, fy + h * 0.07);
    g.quadraticCurveTo(fx + s * w * 0.05, fy + h * 0.12, fx + s * w * 0.042, fy + h * 0.17);
    g.stroke();
  }
  const my = fy + h * 0.125;
  const mouth = g.createRadialGradient(fx, my, 2, fx, my, h * 0.07);
  mouth.addColorStop(0, '#000000');
  mouth.addColorStop(0.8, '#050607');
  mouth.addColorStop(1, '#2a3036');
  g.fillStyle = mouth;
  g.beginPath();
  g.ellipse(fx, my, w * 0.031, h * 0.064, 0.03, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(110,118,126,0.8)';
  g.lineWidth = 4;
  g.stroke();
  g.strokeStyle = 'rgba(176,182,188,0.45)';
  g.lineWidth = 3;
  g.beginPath();
  g.ellipse(fx, my - 2, w * 0.024, h * 0.052, 0.03, Math.PI * 1.15, Math.PI * 1.85);
  g.stroke();
  // wet strands in front, over the brow and down past the cheeks
  for (let i = 0; i < 46; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    g.strokeStyle = r() < 0.2 ? 'rgba(90,100,110,0.35)' : '#07090b';
    g.lineWidth = 1.5 + r() * 3.5;
    g.beginPath();
    g.moveTo(fx + (r() - 0.5) * w * 0.07, h * 0.15);
    g.bezierCurveTo(
      fx + side * (w * 0.04 + r() * w * 0.05),
      h * 0.22,
      fx + side * (w * 0.08 + r() * w * 0.05),
      h * 0.4,
      fx + side * (w * 0.085 + r() * w * 0.07),
      h * (0.6 + r() * 0.4),
    );
    g.stroke();
  }
  g.restore();
  // her hand on the glass, on our left
  paintGhostHand(g, w * 0.27, h * 0.52, h * 0.74, TV_HAND, { wrist: 0.6, halo: true });
  // grain, and everything to grey
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (d[i] ?? 0) * 0.3 + (d[i + 1] ?? 0) * 0.59 + (d[i + 2] ?? 0) * 0.11 + (r() - 0.5) * 22;
    d[i] = lum;
    d[i + 1] = lum;
    d[i + 2] = lum;
  }
  g.putImageData(img, 0, 0);
}

/** The curved glass catching the room: a soft sheen, a long streak, a far window. */
function paintGlare(g: Ctx, w: number, h: number) {
  g.save();
  g.translate(w * 0.3, h * 0.22);
  g.rotate(-0.35);
  g.scale(1, 0.42);
  const s = g.createRadialGradient(0, 0, 0, 0, 0, w * 0.36);
  s.addColorStop(0, 'rgba(255,255,255,0.42)');
  s.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  s.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = s;
  g.fillRect(-w, -w, w * 2, w * 2);
  g.restore();
  g.save();
  g.filter = 'blur(6px)';
  g.fillStyle = 'rgba(255,255,255,0.08)';
  poly(g, [
    [w * 0.56, 0],
    [w * 0.66, 0],
    [w * 0.36, h],
    [w * 0.29, h],
  ]);
  g.fill();
  g.filter = 'blur(3px)';
  g.fillStyle = 'rgba(255,255,255,0.13)';
  g.fillRect(w * 0.7, h * 0.08, w * 0.065, h * 0.06);
  g.fillRect(w * 0.775, h * 0.08, w * 0.065, h * 0.06);
  g.fillRect(w * 0.7, h * 0.15, w * 0.065, h * 0.06);
  g.fillRect(w * 0.775, h * 0.15, w * 0.065, h * 0.06);
  g.restore();
  g.save();
  g.filter = 'blur(4px)';
  g.strokeStyle = 'rgba(255,255,255,0.16)';
  g.lineWidth = 6;
  g.beginPath();
  g.ellipse(w * 0.5, h * 0.5, w * 0.46, h * 0.44, 0, 0.15, 1.1);
  g.stroke();
  g.restore();
}

/** Years of dust on the glass, after the Reveal. */
function paintDust(g: Ctx, w: number, h: number) {
  const r = seeded(404);
  g.fillStyle = 'rgba(170,160,145,0.1)';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) glow(g, r() * w, r() * h, 20 + r() * 90, `rgba(185,175,160,${0.08 + r() * 0.16})`, 'source-over');
  glow(g, w * 0.5, h * 1.05, w * 0.6, 'rgba(175,165,150,0.22)', 'source-over');
  for (let i = 0; i < 1300; i++) {
    g.fillStyle = `rgba(215,205,190,${0.2 + r() * 0.45})`;
    g.fillRect(r() * w, r() * h, 1 + r() * 1.4, 1 + r() * 1.4);
  }
}

// Blood: dried, dark, run from the bottom of the screen down the bezel and the cabinet front.

/** Each run: x (from the bezel's centre), width, and how far it ran down the cabinet. */
const DRIPS: [number, number, number][] = [
  [-0.24, 0.015, 0.075],
  [-0.165, 0.009, 0.04],
  [-0.09, 0.019, 0.112],
  [-0.02, 0.008, 0.028],
  [0.06, 0.013, 0.064],
  [0.14, 0.007, 0.022],
];

function bloodTone(g: Ctx, w: number, h: number, r: () => number) {
  g.save();
  g.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 60; i++) {
    const dark = r() < 0.6;
    glow(g, r() * w, r() * h, 6 + r() * 30, dark ? `rgba(26,3,2,${0.3 + r() * 0.4})` : `rgba(96,20,14,${0.25 + r() * 0.3})`, 'source-atop');
  }
  g.restore();
}

/** On the bezel's bottom side (x across, top of the map = the screen's edge, bottom = the cabinet). */
function paintBezelBlood(g: Ctx, w: number, h: number) {
  const r = seeded(666);
  const X = (x: number) => (x + 0.5) * w;
  g.fillStyle = '#420a08';
  // the smear along the bottom of the screen, wiped across, ragged above and below
  for (let i = 0; i < 90; i++) {
    const t = r();
    const x = X(-0.3 + t * 0.5);
    const y = 40 + Math.sin(t * 9) * 8 + (r() - 0.5) * 22;
    const thick = (1 - Math.abs(t - 0.35) * 1.6) * 18 + 4;
    g.beginPath();
    g.ellipse(x, y, 10 + r() * 26, Math.max(2, thick * (0.4 + r() * 0.6)), (r() - 0.5) * 0.2, 0, Math.PI * 2);
    g.fill();
  }
  g.fillRect(X(-0.27), 0, X(0.17) - X(-0.27), 34);
  // the runs, down over the lip
  for (const [x, wd] of DRIPS) {
    const px = X(x);
    const pw = wd * w;
    g.beginPath();
    g.moveTo(px - pw / 2, 40);
    for (let y = 40; y <= h; y += 12) g.lineTo(px - pw / 2 + Math.sin(y * 0.05 + x * 30) * 2, y);
    for (let y = h; y >= 40; y -= 12) g.lineTo(px + pw / 2 + Math.sin(y * 0.05 + x * 30) * 2, y);
    g.closePath();
    g.fill();
  }
  bloodTone(g, w, h, r);
}

/** On the cabinet front below the bezel: the runs going on down, each ending in a bead. */
function paintCabinetBlood(g: Ctx, w: number, h: number) {
  const r = seeded(667);
  const X = (x: number) => (x + 0.5) * w;
  const U = h / 0.126;
  g.fillStyle = '#420a08';
  g.fillRect(X(-0.26), 0, X(0.16) - X(-0.26), 4);
  for (const [x, wd, len] of DRIPS) {
    const px = X(x);
    const pw = wd * w;
    const end = len * U;
    g.beginPath();
    g.moveTo(px - pw / 2, 0);
    for (let y = 0; y <= end; y += 8) g.lineTo(px - pw / 2 + Math.sin(y * 0.07 + x * 30) * 1.5 + (y / end) * pw * 0.06, y);
    for (let y = end; y >= 0; y -= 8) g.lineTo(px + pw / 2 + Math.sin(y * 0.07 + x * 30) * 1.5 - (y / end) * pw * 0.06, y);
    g.closePath();
    g.fill();
    g.beginPath();
    g.ellipse(px, end, pw * 0.62, pw * 0.75, 0, 0, Math.PI * 2);
    g.fill();
  }
  bloodTone(g, w, h, r);
}

// ---------------------------------------------------------------------------------------------
// Geometry.

function cabinetGeometry(): THREE.ExtrudeGeometry {
  const depth = D - 2 * EDGE;
  const g = new THREE.ExtrudeGeometry(roundedRectShape(W / 2 - EDGE, H / 2 - EDGE, 0.05), {
    depth,
    bevelEnabled: true,
    bevelThickness: EDGE,
    bevelSize: EDGE,
    bevelSegments: 8,
    curveSegments: 10,
  });
  g.translate(0, YC, F - EDGE - depth);
  return g;
}

/** The bezel's cross-section: inset from its outer edge and height off the cabinet front. */
// The cabinet is solid, so the funnel ends just in front of its face, where the tube sits.
const BEZEL_PROFILE: [number, number][] = [
  [-0.003, -0.008],
  [0, 0.008],
  [0.004, 0.034],
  [0.012, 0.052],
  [0.026, 0.064],
  [0.044, 0.068],
  [0.06, 0.064],
  [0.075, 0.055],
  [0.092, 0.043],
  [0.108, 0.033],
  [0.122, 0.026],
  [0.132, 0.022],
  [0.138, 0.016],
  [0.141, 0.004],
];

/** The bezel (a deep rounded funnel to the screen), and a skin over its bottom side for the blood. */
function bezelGeometry(): { frame: THREE.BufferGeometry; blood: THREE.BufferGeometry } {
  const curve = new THREE.CatmullRomCurve3(
    BEZEL_PROFILE.map(([a, b]) => new V3(a, b, 0)),
    false,
    'centripetal',
  );
  const prof = curve.getPoints(36);
  const rows = prof.map((p) =>
    ring(BHW - p.x, BHH - p.x, Math.max(0.062, BR - p.x * 0.5)).map(([x, y]) => new V3(BX + x, BY + y, F + p.y)),
  );
  const nj = rows.length - 1;
  const ni = (rows[0]?.length ?? 1) - 1;
  const frame = strip(rows, (i, j) => [i / ni, j / nj]);
  const [b0, b1] = RING_BOTTOM;
  const blood = strip(
    rows.map((row) => row.slice(b0, b1 + 1)),
    (_i, j, p) => [(p.x - BX + BHW) / (2 * BHW), j / nj],
  );
  liftOff(blood, 0.0012);
  return { frame, blood };
}

/** Moves a skin a hair off the surface it was made from, along its own normals (outward). */
function liftOff(g: THREE.BufferGeometry, d: number) {
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const n = g.getAttribute('normal') as THREE.BufferAttribute;
  const mid = Math.floor(n.count / 2);
  const sign = n.getZ(mid) < 0 ? -1 : 1;
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(i, p.getX(i) + n.getX(i) * d * sign, p.getY(i) + n.getY(i) * d * sign, p.getZ(i) + n.getZ(i) * d * sign);
  }
  p.needsUpdate = true;
}

/** The tube's face, bowed out toward us. */
function dome(w: number, h: number, bulge: number): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(w, h, 40, 30);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const nx = p.getX(i) / (w / 2);
    const ny = p.getY(i) / (h / 2);
    p.setZ(i, bulge * Math.cos(nx * 1.3) * Math.cos(ny * 1.3));
  }
  g.computeVertexNormals();
  return g;
}

function plateGeometry(): THREE.ExtrudeGeometry {
  const g = new THREE.ExtrudeGeometry(roundedRectShape(PHW - 0.006, PHH - 0.006, 0.03), {
    depth: 0.006,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 3,
    curveSegments: 8,
  });
  g.translate(PX, PY, F - 0.002);
  return g;
}

/** A big ribbed knob with a flared skirt and a domed cap, facing +z. */
function knobGeometry(): THREE.BufferGeometry {
  const g = lathe(
    [
      [0, 0],
      [0.094, 0],
      [0.0955, 0.006],
      [0.093, 0.012],
      [0.08, 0.015],
      [0.078, 0.02],
      [0.076, 0.054],
      [0.072, 0.062],
      [0.064, 0.069],
      [0.05, 0.0725],
      [0.025, 0.074],
      [0, 0.0745],
    ],
    120,
  );
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y > 0.019 && y < 0.058) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const k = Math.pow(0.5 + 0.5 * Math.cos(Math.atan2(z, x) * 30), 2);
      p.setX(i, x * (1 - 0.055 * k));
      p.setZ(i, z * (1 - 0.055 * k));
    }
  }
  g.computeVertexNormals();
  g.rotateX(Math.PI / 2);
  return g;
}

function grilleFrameGeometry(): THREE.TubeGeometry {
  const pts = ring(0.14, 0.105, 0.02).slice(0, -1).map(([x, y]) => new V3(x, y, 0));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 160, 0.005, 8, true);
}

function rodPivot(side: -1 | 1): THREE.Vector3 {
  return ANT.clone().add(new V3(side * 0.012, 0.065, 0));
}
function rodEuler(side: -1 | 1): THREE.Euler {
  return new THREE.Euler(ROD_BACK, 0, -side * ROD_LEAN);
}
function rodPoint(side: -1 | 1, s: number): THREE.Vector3 {
  return rodPivot(side).add(new V3(0, s, 0).applyEuler(rodEuler(side)));
}

// Cobwebs: thin threads kept just off every surface they cross.

type Solid = [THREE.Vector3, THREE.Vector3, number];
const SOLIDS: Solid[] = [
  [new V3(0, YC, F - D / 2), new V3(W / 2, H / 2, D / 2), EDGE],
  [new V3(BX, BY, F + 0.034), new V3(BHW, BHH, 0.034), 0.02],
  [new V3(PX, PY, F + 0.005), new V3(PHW, PHH, 0.007), 0.005],
  [new V3(ANT.x, TOP + 0.025, ANT.z), new V3(0.086, 0.025, 0.086), 0.025],
];

function sdRoundBox(p: THREE.Vector3, [c, hs, r]: Solid): number {
  const qx = Math.abs(p.x - c.x) - (hs.x - r);
  const qy = Math.abs(p.y - c.y) - (hs.y - r);
  const qz = Math.abs(p.z - c.z) - (hs.z - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
}
const solidAt = (p: THREE.Vector3) => Math.min(...SOLIDS.map((s) => sdRoundBox(p, s)));
const probe = new V3();

function keepOut(p: THREE.Vector3, gap = 0.004): THREE.Vector3 {
  for (let k = 0; k < 4; k++) {
    const d = solidAt(p);
    if (d >= gap) break;
    const e = 0.001;
    const n = new V3(
      solidAt(probe.set(p.x + e, p.y, p.z)) - solidAt(probe.set(p.x - e, p.y, p.z)),
      solidAt(probe.set(p.x, p.y + e, p.z)) - solidAt(probe.set(p.x, p.y - e, p.z)),
      solidAt(probe.set(p.x, p.y, p.z + e)) - solidAt(probe.set(p.x, p.y, p.z - e)),
    ).normalize();
    p.addScaledVector(n, gap - d);
  }
  return p;
}

function thread(a: THREE.Vector3, b: THREE.Vector3, sag: number, radius: number, out: THREE.BufferGeometry[]) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const p = a.clone().lerp(b, t);
    p.y -= sag * 4 * t * (1 - t);
    pts.push(keepOut(p));
  }
  out.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, radius, 3, false));
}

/** An orb web: radial threads from a hub to anchors, and sagging rings between them, some broken. */
function orbWeb(hub: THREE.Vector3, anchors: THREE.Vector3[], closed: boolean, r: () => number, out: THREE.BufferGeometry[]) {
  anchors.forEach((a) => thread(hub, a, 0.004, 0.0015, out));
  const count = closed ? anchors.length : anchors.length - 1;
  for (const f0 of [0.2, 0.34, 0.48, 0.62, 0.76, 0.9]) {
    for (let i = 0; i < count; i++) {
      if (r() < 0.14) continue;
      const a = anchors[i];
      const b = anchors[(i + 1) % anchors.length];
      if (!a || !b) continue;
      const fa = f0 + (r() - 0.5) * 0.06;
      const fb = f0 + (r() - 0.5) * 0.06;
      thread(hub.clone().lerp(a, fa), hub.clone().lerp(b, fb), 0.003 + 0.012 * f0 * r(), 0.001, out);
    }
  }
}

function webGeometry(): THREE.BufferGeometry {
  const r = seeded(31);
  const out: THREE.BufferGeometry[] = [];
  // across the two top front corners, from the top over the edge to the bezel and the plate
  for (const s of [-1, 1] as const) {
    const hub = new V3(s * 0.735, TOP + 0.012, F + 0.012);
    const near = s < 0 ? [new V3(-0.47, 0.345, F + 0.052), new V3(-0.645, 0.317, F + 0.052)] : [new V3(0.45, 0.37, F + 0.018), new V3(0.62, 0.345, F + 0.018)];
    orbWeb(
      hub,
      [
        new V3(s * 0.37, TOP + 0.008, F + 0.008),
        ...near,
        new V3(s * 0.73, 0.13, F + 0.006),
        new V3(s * 0.815, 0.25, F - 0.12),
        new V3(s * 0.8, TOP + 0.004, F - 0.32),
        new V3(s * 0.55, TOP + 0.004, F - 0.25),
      ],
      false,
      r,
      out,
    );
  }
  // in the V of the aerials, down to the base
  orbWeb(
    rodPivot(-1).lerp(rodPivot(1), 0.5).add(new V3(0, 0.15, -0.02)),
    [rodPoint(-1, 0.33), rodPoint(-1, 0.2), rodPoint(-1, 0.08), ANT.clone().add(new V3(0, 0.052, 0)), rodPoint(1, 0.08), rodPoint(1, 0.2), rodPoint(1, 0.33)],
    true,
    r,
    out,
  );
  // draped from the base and the ears down onto the top
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    const from = ANT.clone().add(new V3(Math.cos(a) * 0.06, 0.035, Math.sin(a) * 0.06));
    const to = new V3(ANT.x + Math.cos(a) * (0.18 + r() * 0.08), TOP + 0.003, ANT.z + Math.sin(a) * (0.18 + r() * 0.08));
    thread(from, to, 0.01, 0.0013, out);
  }
  thread(rodPoint(-1, 0.25), new V3(-0.45, TOP + 0.003, -0.02), 0.05, 0.0013, out);
  thread(rodPoint(-1, 0.14), new V3(-0.3, TOP + 0.003, 0.12), 0.03, 0.0012, out);
  thread(rodPoint(1, 0.22), new V3(0.36, TOP + 0.003, F - 0.1), 0.05, 0.0013, out);
  thread(rodPoint(1, 0.12), new V3(0.22, TOP + 0.003, -0.32), 0.03, 0.0012, out);
  // loose threads hanging off the top front edge, over the bezel and the plate
  for (const [x0, x1, sag] of [
    [-0.56, -0.32, 0.09],
    [-0.25, 0.02, 0.06],
    [0.1, 0.3, 0.08],
    [0.42, 0.6, 0.05],
  ] as const) {
    thread(new V3(x0, TOP + 0.006, F + 0.006), new V3(x1, TOP + 0.006, F + 0.006), sag, 0.0012, out);
  }
  const merged = mergeGeometries(out) ?? new THREE.BufferGeometry();
  out.forEach((g) => g.dispose());
  return merged;
}

// ---------------------------------------------------------------------------------------------
// The screen: a little shader over the painted pictures.

const SCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SCREEN_FRAG = /* glsl */ `
uniform sampler2D uPic;
uniform sampler2D uGhost;
uniform float uMode;
uniform float uTime;
uniform float uBright;
uniform vec2 uSize;
uniform vec2 uHalf;
varying vec2 vUv;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(float x) { float i = floor(x); float f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(hash(vec2(i, 1.7)), hash(vec2(i + 1.0, 1.7)), f); }
float flakes(vec2 uv, float scale, float speed, float t) {
  vec2 p = vec2(uv.x * 1.3, uv.y) * scale;
  p.y += t * speed;
  p.x += sin(p.y * 0.9 + t * 0.6) * 0.25;
  vec2 id = floor(p);
  vec2 f = fract(p) - 0.5;
  vec2 o = vec2(hash(id + 3.1), hash(id + 7.3)) - 0.5;
  return step(0.6, hash(id)) * smoothstep(0.12, 0.02, length(f - o * 0.6));
}
float roundRect(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  vec2 c = vUv - 0.5;
  // the tube's curve: the picture bows a little toward the edges
  vec2 uv = 0.5 + c * (0.94 + 0.1 * dot(c, c));
  float t = uTime;
  float row = floor(vUv.y * 150.0);
  // scanlines fade out where they would be finer than the pixels
  float lines = 1.0 - smoothstep(0.15, 0.35, fwidth(vUv.y) * 110.0);
  float scan = sin(vUv.y * 691.0);
  vec3 col;
  if (uMode < 0.5) {
    vec3 pic = texture2D(uPic, uv).rgb;
    vec3 soft = texture2D(uPic, uv, 3.0).rgb;
    col = pic * 0.92 + soft * 0.22;
    col += vec3(0.9, 0.93, 1.0) * (flakes(uv, 26.0, 1.6, t) * 0.5 + flakes(uv, 14.0, 1.1, t + 9.0) * 0.7);
    col *= 1.0 - lines * 0.05 * (0.5 + 0.5 * scan);
  } else if (uMode < 1.5) {
    // the same picture gone cold, under a little static: grain, a thin line here and there,
    // a faint bar rolling up, a noise band where the rows slip a hair
    float band = 1.0 - smoothstep(0.0, 0.05, abs(fract(vUv.y * 0.7 + t * 0.045) - 0.5) - 0.02);
    float slip = (hash(vec2(row, floor(t * 14.0))) - 0.5) * 0.006 * band;
    vec3 pic = texture2D(uPic, uv + vec2(slip, 0.0)).rgb;
    float g = dot(pic, vec3(0.3, 0.59, 0.11));
    col = mix(pic, vec3(g) * vec3(0.8, 0.9, 1.06), 0.85);
    // colder and dimmer: the snow goes grey, the night darker
    col = pow(col, vec3(1.25)) * 0.66;
    float grain = hash(floor(vUv * vec2(520.0, 400.0)) + floor(t * 18.0) * 1.37);
    col += (grain - 0.5) * (0.06 + 0.1 * band);
    float line = step(0.975, hash(vec2(row, floor(t * 7.0))));
    float seg = smoothstep(0.3, 0.9, hash(vec2(floor(vUv.x * 40.0), row + floor(t * 7.0))));
    col = mix(col, vec3(0.78, 0.82, 0.88), line * seg * 0.28);
    float roll = fract(vUv.y - t * 0.06);
    col *= 1.0 - 0.09 * smoothstep(0.0, 0.12, roll) * smoothstep(0.3, 0.12, roll);
    col *= 1.0 - lines * 0.12 * (0.5 + 0.5 * scan);
    col *= 0.975 + 0.025 * vnoise(t * 9.0);
  } else {
    // her picture, still; only the static over it moves
    float slip = (hash(vec2(row, floor(t * 10.0))) - 0.5) * 0.004 * step(0.9, hash(vec2(row * 0.37, floor(t * 10.0))));
    float g = texture2D(uGhost, uv + vec2(slip, 0.0)).r;
    col = vec3(g) * vec3(0.78, 0.87, 0.97);
    float grain = hash(floor(vUv * vec2(520.0, 400.0)) + floor(t * 16.0) * 1.91);
    col += (grain - 0.5) * 0.14;
    float line = step(0.9, hash(vec2(row, floor(t * 6.0))));
    float seg = smoothstep(0.2, 0.8, hash(vec2(floor(vUv.x * 30.0), row + floor(t * 6.0))));
    col = mix(col, vec3(0.8, 0.86, 0.92), line * seg * 0.32);
    col *= 1.0 - 0.3 * step(0.94, hash(vec2(row + 11.0, floor(t * 6.0))));
    col *= 1.0 - (0.12 + 0.2 * lines) * (0.5 + 0.5 * scan);
    col *= 0.985 + 0.015 * vnoise(t * 7.0);
  }
  col *= mix(0.55, 1.0, smoothstep(0.85, 0.3, length(c * vec2(1.0, 1.15))));
  col *= smoothstep(0.004, -0.004, roundRect(c * uSize, uHalf, 0.07));
  gl_FragColor = vec4(max(col, 0.0) * uBright, 1.0);
  #include <colorspace_fragment>
}
`;

interface ScreenMat {
  m: THREE.ShaderMaterial;
  u: {
    uPic: { value: THREE.Texture };
    uGhost: { value: THREE.Texture };
    uMode: { value: number };
    uTime: { value: number };
    uBright: { value: number };
    uSize: { value: THREE.Vector2 };
    uHalf: { value: THREE.Vector2 };
  };
}

function screenMaterial(pic: THREE.Texture, ghost: THREE.Texture): ScreenMat {
  const u = {
    uPic: { value: pic },
    uGhost: { value: ghost },
    uMode: { value: 0 },
    uTime: { value: 0 },
    uBright: { value: 1 },
    uSize: { value: new THREE.Vector2(SW, SH) },
    uHalf: { value: new THREE.Vector2(0.376, 0.256) },
  };
  return { m: new THREE.ShaderMaterial({ uniforms: u, vertexShader: SCREEN_VERT, fragmentShader: SCREEN_FRAG, toneMapped: false }), u };
}

/** Day, haunted, and her picture: brightness, glare on the glass, and the glow it casts. */
const LOOK = [
  { bright: 1, glare: 0.55, light: 0.12, color: '#ffc78a' },
  { bright: 0.86, glare: 0.22, light: 0.08, color: '#9fb2cc' },
  { bright: 0.92, glare: 0.22, light: 0.14, color: '#c9d6e4' },
] as const;

/** Outside the component, so the React compiler rules see no mutation of hook values. */
function tickScreen(s: ScreenMat, glare: THREE.MeshBasicMaterial, lamp: THREE.PointLight | null, mode: 0 | 1 | 2, t: number) {
  const look = LOOK[mode];
  s.u.uMode.value = mode;
  s.u.uTime.value = t;
  s.u.uBright.value = look.bright;
  glare.opacity = look.glare;
  if (lamp) {
    lamp.intensity = look.light;
    lamp.color.set(look.color);
  }
}

function glassMaterials(glare: THREE.Texture, dust: THREE.Texture) {
  return {
    glare: new THREE.MeshBasicMaterial({ map: glare, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.55 }),
    dust: new THREE.MeshStandardMaterial({ map: dust, transparent: true, opacity: 0.6, depthWrite: false, roughness: 1 }),
  };
}

const drawXmas = (g: Ctx, w: number, h: number) => g.drawImage(painted('tvXmas', w, h, paintChristmas), 0, 0);
const drawGhost = (g: Ctx, w: number, h: number) => g.drawImage(painted('tvGhost', w, h, paintGhost), 0, 0);
const drawGlare = (g: Ctx, w: number, h: number) => g.drawImage(painted('tvGlare', w, h, paintGlare), 0, 0);
const drawDust = (g: Ctx, w: number, h: number) => g.drawImage(painted('tvDust', w, h, paintDust), 0, 0);

/**
 * The picture tube and the glass over it. By day the snowy house, snow still falling; after the
 * Reveal the same house, cold, under a little static; once taken, from CUT on, her picture,
 * which stays (one step in brightness at the cut, nothing else changes but the static).
 */
function Screen({ haunted, taken, since }: { haunted: boolean; taken: boolean; since: () => number }) {
  const pic = useCanvasTexture(1024, 800, drawXmas, []);
  const ghost = useCanvasTexture(1024, 800, drawGhost, []);
  const glare = useCanvasTexture(512, 400, drawGlare, []);
  const dust = useCanvasTexture(512, 400, drawDust, []);
  const scr = useMemo(() => screenMaterial(pic, ghost), [pic, ghost]);
  const glass = useMemo(() => glassMaterials(glare, dust), [glare, dust]);
  const geo = useMemo(() => ({ tube: dome(SW, SH, 0.035), glass: dome(SW, SH, 0.042) }), []);
  useEffect(() => () => scr.m.dispose(), [scr]);
  useEffect(
    () => () => {
      glass.glare.dispose();
      glass.dust.dispose();
    },
    [glass],
  );
  useEffect(
    () => () => {
      geo.tube.dispose();
      geo.glass.dispose();
    },
    [geo],
  );
  const lamp = useRef<THREE.PointLight>(null);
  useFrame((st) => {
    const mode = !haunted ? 0 : taken && since() >= CUT ? 2 : 1;
    // under reduced motion the static holds still (its look stays, its flicker goes)
    tickScreen(scr, glass.glare, lamp.current, mode, reducedMotion() ? 4.2 : st.clock.elapsedTime);
  });
  return (
    <group position={[BX, BY, 0]}>
      <mesh geometry={geo.tube} material={scr.m} position-z={F + 0.001} />
      <mesh geometry={geo.glass} material={glass.glare} position-z={F + 0.002} renderOrder={2} />
      <mesh geometry={geo.glass} material={glass.dust} position-z={F + 0.0025} renderOrder={1} visible={haunted} />
      <pointLight ref={lamp} position={[0, 0, F + 0.32]} intensity={0.12} distance={1.2} decay={2} color="#ffc78a" />
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// Parts.

function Cabinet({ haunted }: { haunted: boolean }) {
  const geo = useMemo(() => cabinetGeometry(), []);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} material={haunted ? WALNUT_OLD() : WALNUT()} />;
}

/** The bezel; after the Reveal, the blood smeared along the bottom of the screen and run over its lip. */
function Bezel({ haunted }: { haunted: boolean }) {
  const geo = useMemo(() => bezelGeometry(), []);
  useEffect(
    () => () => {
      geo.frame.dispose();
      geo.blood.dispose();
    },
    [geo],
  );
  return (
    <>
      <mesh geometry={geo.frame} material={BEZEL()} />
      {haunted && <BezelBlood geometry={geo.blood} />}
    </>
  );
}

function bloodMaterial(map: THREE.Texture, side: THREE.Side): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    map,
    bumpMap: map,
    bumpScale: 0.6,
    alphaTest: 0.4,
    roughness: 0.5,
    clearcoat: 0.35,
    clearcoatRoughness: 0.35,
    side,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

function BezelBlood({ geometry }: { geometry: THREE.BufferGeometry }) {
  const tex = useCanvasTexture(1024, 256, paintBezelBlood, []);
  const m = useMemo(() => bloodMaterial(tex, THREE.DoubleSide), [tex]);
  useEffect(() => () => m.dispose(), [m]);
  return <mesh geometry={geometry} material={m} />;
}

/** The runs going on down the cabinet front, with glossy beads where they stopped. */
function CabinetBlood() {
  const tex = useCanvasTexture(1024, 128, paintCabinetBlood, []);
  const m = useMemo(() => bloodMaterial(tex, THREE.FrontSide), [tex]);
  useEffect(() => () => m.dispose(), [m]);
  const bead = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#3d0605', roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.2 }), []);
  useEffect(() => () => bead.dispose(), [bead]);
  return (
    <group>
      <mesh material={m} position={[BX, -0.379 - 0.063, F + 0.0015]}>
        <planeGeometry args={[1, 0.126]} />
      </mesh>
      {DRIPS.filter(([, , len]) => len >= 0.06).map(([x, wd, len]) => (
        <mesh key={x} material={bead} position={[BX + x, -0.379 - len, F + 0.002]} scale={[wd * 0.6, wd * 0.75, wd * 0.32]}>
          <sphereGeometry args={[1, 14, 10]} />
        </mesh>
      ))}
      {/* the longest run reached the bottom edge: a drop hangs there */}
      <mesh material={bead} position={[BX - 0.09, BOT + EDGE - 0.016, F - 0.006]} scale={[0.008, 0.012, 0.007]}>
        <sphereGeometry args={[1, 14, 10]} />
      </mesh>
    </group>
  );
}

function ControlPanel({ haunted }: { haunted: boolean }) {
  const geo = useMemo(
    () => ({
      plate: plateGeometry(),
      knob: knobGeometry(),
      slat: new THREE.CapsuleGeometry(0.0075, 0.25, 4, 10).rotateZ(Math.PI / 2),
      frame: grilleFrameGeometry(),
    }),
    [],
  );
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  return (
    <group>
      <mesh geometry={geo.plate} material={haunted ? PLATE_OLD() : PLATE()} />
      {KNOBS.map(([y, turn]) => (
        <group key={y} position={[PX, y, PLATE_FRONT]}>
          <group rotation-z={turn}>
            <mesh geometry={geo.knob} material={M.bakelite()} />
            {/* the pointer line */}
            <mesh material={M.enamel()} position={[0, 0.032, 0.0742]}>
              <boxGeometry args={[0.007, 0.042, 0.004]} />
            </mesh>
          </group>
          <mesh material={M.brass()} position-z={0.001}>
            <torusGeometry args={[0.1, 0.0035, 8, 64]} />
          </mesh>
        </group>
      ))}
      <mesh material={CLOTH()} position={[PX, -0.265, PLATE_FRONT + 0.0008]}>
        <planeGeometry args={[0.27, 0.205]} />
      </mesh>
      {SLATS.map((y) => (
        <mesh key={y} geometry={geo.slat} material={M.darkBrass()} position={[PX, y, PLATE_FRONT + 0.009]} />
      ))}
      <mesh geometry={geo.frame} material={M.brass()} position={[PX, -0.265, PLATE_FRONT + 0.004]} />
    </group>
  );
}

/** Rabbit ears: a round base with a chrome hinge, and two telescoping chrome rods in a V. */
function Antenna() {
  const geo = useMemo(
    () => ({
      base: lathe(
        [
          [0, 0],
          [0.086, 0],
          [0.086, 0.006],
          [0.081, 0.016],
          [0.07, 0.03],
          [0.05, 0.042],
          [0.026, 0.049],
          [0, 0.051],
        ],
        48,
      ),
    }),
    [],
  );
  useEffect(() => () => geo.base.dispose(), [geo]);
  return (
    <group>
      <mesh geometry={geo.base} material={BEZEL()} position={ANT} />
      <mesh material={M.silver()} position={[ANT.x, ANT.y + 0.055, ANT.z]}>
        <cylinderGeometry args={[0.025, 0.028, 0.014, 24]} />
      </mesh>
      <mesh material={M.silver()} position={[ANT.x, ANT.y + 0.065, ANT.z]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.012, 0.012, 0.06, 16]} />
      </mesh>
      {([-1, 1] as const).map((side) => (
        <group key={side} position={rodPivot(side)} rotation={rodEuler(side)}>
          <mesh material={M.silver()} position-y={0.1}>
            <cylinderGeometry args={[0.0075, 0.0075, 0.2, 10]} />
          </mesh>
          <mesh material={M.silver()} position-y={0.2}>
            <cylinderGeometry args={[0.0095, 0.0095, 0.012, 12]} />
          </mesh>
          <mesh material={M.silver()} position-y={0.29}>
            <cylinderGeometry args={[0.006, 0.006, 0.18, 10]} />
          </mesh>
          <mesh material={M.silver()} position-y={0.38}>
            <cylinderGeometry args={[0.0078, 0.0078, 0.01, 12]} />
          </mesh>
          <mesh material={M.silver()} position-y={0.455}>
            <cylinderGeometry args={[0.0045, 0.0045, 0.15, 8]} />
          </mesh>
          <mesh material={M.silver()} position-y={0.53}>
            <sphereGeometry args={[0.009, 12, 10]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Feet() {
  const geo = useMemo(
    () =>
      lathe(
        [
          [0, 0],
          [0.03, 0],
          [0.038, 0.006],
          [0.042, 0.02],
          [0.045, 0.035],
          [0.05, 0.045],
          [0.05, 0.05],
          [0, 0.05],
        ],
        32,
      ),
    [],
  );
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <group>
      {[-1, 1].flatMap((sx) =>
        [F - 0.12, F - D + 0.12].map((z) => <mesh key={`${sx}${z}`} geometry={geo} material={BEZEL()} position={[sx * 0.66, BOT - 0.05, z]} />),
      )}
    </group>
  );
}

/** After the Reveal: cobwebs across the top corners, in the aerials, draped over their base. */
function Cobwebs() {
  const geo = useMemo(() => webGeometry(), []);
  const m = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ddd6c8', roughness: 0.45, transparent: true, opacity: 0.45, depthWrite: false }), []);
  useEffect(
    () => () => {
      geo.dispose();
      m.dispose();
    },
    [geo, m],
  );
  return <mesh geometry={geo} material={m} />;
}

/**
 * Walnut television set (Requirement 31). Christmas by day; after the Reveal "The Set That Stays
 * On". Taken: at CUT (0.1 s) the picture cuts hard to her, pressed against the glass, and stays.
 */
export default function Television() {
  const haunted = useHaunted();
  const { taken, since } = useTaken('television');
  return (
    <group rotation-y={-0.2}>
      <Cabinet haunted={haunted} />
      <Bezel haunted={haunted} />
      <Screen haunted={haunted} taken={taken} since={since} />
      <ControlPanel haunted={haunted} />
      <Antenna />
      <Feet />
      {haunted && (
        <group userData={{ extra: true }}>
          <Cobwebs />
          <CabinetBlood />
        </group>
      )}
    </group>
  );
}
