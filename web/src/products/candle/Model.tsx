import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { seeded } from '../../director/footprints';
import { useFx } from '../../fx/fxStore';
import { mat } from '../../gl/decay';
import { M } from '../../gl/materials';
import { progress, useTaken } from '../../gl/useTaken';
import { useHaunted } from '../../store';

/*
 * The candle for the window. By day a new cinnamon pillar candle, cream wax with a crisp rim and
 * a few small drips, burning in a polished brass dish with two cinnamon sticks and a sprig of
 * holly. After the Reveal it is the same candle burnt down for eighty hours of waiting: the rim
 * slumped and uneven round a crater, drips all down its sides, wax pooled in an old dark dish
 * and spilling over its rim, the holly dead in the wax. It is still lit.
 *
 * Taken, it goes out. The flame shrinks into the wick and dies (0-0.3 s), the wick glows, and a
 * thin thread of smoke rises from it (0.3-1.5 s). The thread grows into one straight column of
 * fine filaments twisting round each other (1.3-3.0 s), and partway up, where the column
 * thickens, a small face condenses in it (2.4-3.8 s): a pale oval, two hollow eyes, an open
 * mouth. It hangs there in the swaying smoke (3.8-5.0 s), then the smoke rises on and thins out
 * (5.0-6.5 s). A last thin wisp leaves the dying ember (6.0-7.0 s), and then nothing.
 *
 * All in the candle's own space: the table at y = -0.62, the dish floor at -0.6, +z toward you.
 */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => {
  const k = clamp01(v);
  return k * k * (3 - 2 * k);
};
const TAU = Math.PI * 2;
/** The signed difference between two angles, -π..π. */
const angDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/** The Take, seconds after it. Everything is over at `end`. */
const TAKE = { out: 0.3, end: 7.0 };

type Prof = [number, number][];
type V3 = [number, number, number];

/* ------------------------------------------------------------------------------------------ */
/* Geometry helpers                                                                           */
/* ------------------------------------------------------------------------------------------ */

/**
 * A surface of revolution whose profile (radius, height) may change with the angle round it:
 * `profile(θ)` must give the same number of points for every θ. x = r·sinθ, z = r·cosθ (θ = 0
 * faces you). Normals are smoothed across the seam and at the poles, and the winding is set so
 * the outside faces out.
 */
function revolve(profile: (th: number) => Prof, nTh: number): THREE.BufferGeometry {
  const cols: Prof[] = [];
  for (let i = 0; i <= nTh; i++) cols.push(profile(i === nTh ? 0 : (i / nTh) * TAU));
  const np = cols[0]!.length;
  const pos = new Float32Array((nTh + 1) * np * 3);
  const uv = new Float32Array((nTh + 1) * np * 2);
  for (let i = 0; i <= nTh; i++) {
    const th = (i / nTh) * TAU;
    const col = cols[i]!;
    for (let j = 0; j < np; j++) {
      const [r, y] = col[j]!;
      const o = i * np + j;
      pos.set([r * Math.sin(th), y, r * Math.cos(th)], o * 3);
      uv.set([i / nTh, j / (np - 1)], o * 2);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < nTh; i++)
    for (let j = 0; j < np - 1; j++) {
      const a = i * np + j;
      const b = a + np;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // the widest point of the first column must face out (+z); if not, turn every face over
  let jMax = 0;
  cols[0]!.forEach(([r], j) => {
    if (r > cols[0]![jMax]![0]) jMax = j;
  });
  const nor = g.attributes.normal as THREE.BufferAttribute;
  if (nor.getZ(jMax) < 0) {
    for (let k = 0; k < idx.length; k += 3) {
      const t = idx[k + 1]!;
      idx[k + 1] = idx[k + 2]!;
      idx[k + 2] = t;
    }
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  const n = g.attributes.normal as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let j = 0; j < np; j++) {
    // the seam: the first and last columns are the same points
    const a = j;
    const b = nTh * np + j;
    v.set(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize();
    n.setXYZ(a, v.x, v.y, v.z);
    n.setXYZ(b, v.x, v.y, v.z);
    // the poles: every column meets at the axis, so they share one normal
    if (cols[0]![j]![0] < 1e-5) {
      v.set(0, 0, 0);
      for (let i = 0; i <= nTh; i++) v.add(new THREE.Vector3(n.getX(i * np + j), n.getY(i * np + j), n.getZ(i * np + j)));
      v.normalize();
      for (let i = 0; i <= nTh; i++) n.setXYZ(i * np + j, v.x, v.y, v.z);
    }
  }
  return g;
}

/**
 * A tube along a curve whose cross-section changes along it: `rad(t)` gives the radii in the
 * curve's normal and binormal directions, so it can taper or be a flat tongue. `side` fixes the
 * binormal for a curve drawn in a plane. uv runs along it from v0.
 */
function tube(
  pts: THREE.Vector3[],
  segs: number,
  radial: number,
  rad: (t: number) => [number, number],
  side?: THREE.Vector3,
  v0 = 0.4,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const T = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  const P = new THREE.Vector3();
  const V = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPoint(t, P);
    curve.getTangent(t, T).normalize();
    if (side) N.crossVectors(side, T).normalize();
    else if (i === 0) N.crossVectors(T, Math.abs(T.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
    else N.addScaledVector(T, -T.dot(N)).normalize();
    B.crossVectors(T, N).normalize();
    const [rn, rb] = rad(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * TAU;
      const c = Math.cos(a);
      const s = Math.sin(a);
      V.copy(N).multiplyScalar(c * rn).addScaledVector(B, s * rb);
      pos.push(P.x + V.x, P.y + V.y, P.z + V.z);
      V.copy(N).multiplyScalar(c / Math.max(rn, 1e-4)).addScaledVector(B, s / Math.max(rb, 1e-4)).normalize();
      nor.push(V.x, V.y, V.z);
      uv.push((j / radial) * 0.06, v0 + t * 0.12);
    }
  }
  for (let i = 0; i < segs; i++)
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** A ball of wax at the end of a drip. */
function bulb(at: THREE.Vector3, r: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, 14, 10);
  g.scale(1, 1.15, 1);
  g.translate(at.x, at.y, at.z);
  return g;
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts) ?? new THREE.BufferGeometry();
  parts.forEach((p) => p.dispose());
  return g;
}

/** A smooth, seeded wobble round a circle: a few sines with fixed phases, -1..1. */
function ring(seed: number, n = 6): (th: number) => number {
  const r = seeded(seed);
  const terms = Array.from({ length: n }, (_, k) => ({ k: k + 1, ph: r() * TAU, a: (0.5 + r()) / (k + 1) }));
  const norm = terms.reduce((s, t) => s + t.a, 0);
  return (th) => terms.reduce((s, t) => s + t.a * Math.sin(t.k * th + t.ph), 0) / norm;
}

/** Seeded 3D value noise, 0..1 (for the patina on the old dish). */
function hash3(x: number, y: number, z: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1440662683)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const fx = x - xi;
  const fy = y - yi;
  const fz = z - zi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const w = fz * fz * (3 - 2 * fz);
  const l = (a: number, b: number, k: number) => a + (b - a) * k;
  const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}

/* ------------------------------------------------------------------------------------------ */
/* The dish                                                                                   */
/* ------------------------------------------------------------------------------------------ */

/** A shallow round tray on a low foot, the wall flaring out to a rolled rim. Floor at -0.6. */
const DISH: Prof = [
  [0, -0.612],
  [0.25, -0.612],
  [0.28, -0.615],
  [0.29, -0.62],
  [0.312, -0.62],
  [0.322, -0.614],
  [0.34, -0.604],
  [0.372, -0.594],
  [0.4, -0.58],
  [0.42, -0.566],
  [0.433, -0.556],
  [0.439, -0.549],
  [0.437, -0.543],
  [0.428, -0.5395],
  [0.416, -0.5405],
  [0.404, -0.547],
  [0.39, -0.56],
  [0.37, -0.578],
  [0.352, -0.592],
  [0.338, -0.5985],
  [0.32, -0.6],
  [0.16, -0.6],
  [0, -0.6],
];

/** The old dish: dark bronze, green patina in blotches, grime in the corners, worn on the rim. */
function patina(g: THREE.BufferGeometry) {
  const p = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const r = Math.hypot(x, z);
    const n1 = vnoise(x * 16 + 3, y * 16, z * 16);
    const n2 = vnoise(x * 46, y * 46 + 9, z * 46);
    const c = new THREE.Color(0.25, 0.19, 0.12);
    c.lerp(new THREE.Color(0.22, 0.28, 0.22), smooth((n1 - 0.52) / 0.2) * 0.85);
    // grime gathered in the corner between floor and wall
    const corner = smooth(1 - Math.abs(r - 0.34) / 0.03) * (y < -0.585 ? 1 : 0);
    c.lerp(new THREE.Color(0.07, 0.06, 0.05), Math.max(corner * 0.6, smooth((n2 - 0.62) / 0.15) * 0.5));
    // the rim worn back to brass where hands held it
    if (y > -0.545 && r > 0.41) c.lerp(new THREE.Color(0.48, 0.36, 0.19), 0.55 + 0.3 * n2);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

/* ------------------------------------------------------------------------------------------ */
/* The candles                                                                                */
/* ------------------------------------------------------------------------------------------ */

const Y0 = -0.6;
/** The new candle: its radius and the height of its rim. */
const NEW_R = 0.26;
const NEW_TOP = 0.245;
/** The old candle: radius, the mean height of its rim, the floor of the crater round the wick. */
const OLD_R = 0.255;
const OLD_TOP = 0.12;
const FLOOR = -0.01;
/** Where the rim slumped and the wax ran over: front left. */
const SLUMP = -0.55;
const slump = (th: number) => Math.exp(-(angDiff(th, SLUMP) ** 2) / (2 * 0.5 * 0.5));
const ringA = ring(11);
const ringB = ring(23, 5);
const ringC = ring(37, 7);

/** The old candle's lip: how thick it is, and the height its round top reaches. */
const lipL = (th: number) => 0.026 + 0.012 * slump(th) + 0.004 * ringB(th);
const rimTop = (th: number) => OLD_TOP + 0.022 * ringA(th) - 0.045 * slump(th);
/** The height where the side turns over into the lip. */
const lipY = (th: number) => rimTop(th) - 1.15 * lipL(th);
/** The old candle's side: uneven, built up thick at the foot, bulging where the wax overflowed. */
function oldR(th: number, y: number): number {
  const hs = lipY(th);
  return (
    OLD_R +
    0.005 * ringC(th) +
    0.003 * Math.sin(y * 31 + th * 2) +
    0.014 * (1 - smooth((y - Y0) / 0.14)) +
    0.012 * slump(th) * smooth((y - (hs - 0.2)) / 0.2)
  );
}

/** The new candle: a crisp, slightly rounded rim and a shallow dish of wax round the wick. */
const NEW_PROFILE: Prof = [
  [0, Y0],
  [0.13, Y0],
  [0.245, Y0],
  [0.256, Y0 + 0.003],
  [NEW_R, Y0 + 0.012],
  ...Array.from({ length: 10 }, (_, k): [number, number] => [NEW_R, Y0 + 0.03 + (k / 9) * (NEW_TOP - 0.018 - Y0 - 0.03)]),
  [0.2595, NEW_TOP - 0.008],
  [0.257, NEW_TOP - 0.002],
  [0.25, NEW_TOP],
  [0.235, NEW_TOP - 0.002],
  [0.18, NEW_TOP - 0.006],
  [0.1, NEW_TOP - 0.012],
  [0.04, NEW_TOP - 0.018],
  [0.015, NEW_TOP - 0.021],
  [0, NEW_TOP - 0.022],
];

/** The old candle's profile at an angle: foot, side, the round overflowed lip, the crater. */
function oldProfile(th: number): Prof {
  const out: Prof = [
    [0, Y0],
    [0.13, Y0],
    [OLD_R - 0.004, Y0],
    [OLD_R + 0.006, Y0 + 0.004],
    [oldR(th, Y0 + 0.014), Y0 + 0.014],
  ];
  const hs = lipY(th);
  const L = lipL(th);
  for (let k = 0; k < 18; k++) {
    const y = Y0 + 0.03 + (k / 17) * (hs - 0.008 - Y0 - 0.03);
    out.push([oldR(th, y), y]);
  }
  // the lip: thick and round, a little proud of the side
  const cx = oldR(th, hs) + 0.006 - L;
  for (let k = 0; k <= 8; k++) {
    const a = (k / 8) * Math.PI;
    out.push([cx + L * Math.cos(a), hs + 1.15 * L * Math.sin(a)]);
  }
  // the crater: down from the inside of the lip to the floor round the wick
  const rIn = cx - L;
  for (let k = 1; k <= 10; k++) {
    const f = 1 - k / 10;
    out.push([rIn * f, FLOOR + Math.max(0.008, hs - FLOOR) * f ** 2.4]);
  }
  return out;
}

/** The pool of wax round the old candle's foot, out over the dish floor to a rounded edge. */
const ringP = ring(53, 6);
function poolProfile(th: number): Prof {
  const rb = oldR(th, Y0 + 0.04);
  const P = Math.min(0.356, 0.315 + 0.025 * ringP(th) + 0.05 * slump(th) + 0.03 * slump(th - 1.5));
  const top = -0.5875;
  return [
    [rb - 0.004, -0.562],
    [rb + 0.006, -0.576],
    [rb + 0.02, -0.584],
    [rb + 0.045, -0.5868],
    [(rb + P) / 2, top],
    [P - 0.016, top - 0.0004],
    [P - 0.006, top - 0.0018],
    [P - 0.001, -0.5935],
    [P - 0.002, -0.5985],
    [P - 0.012, -0.6008],
  ];
}

interface Drip {
  th: number;
  /** Where it leaves the rim, and where it ends. */
  y0: number;
  y1: number;
  r: number;
}

/** A drip down the side, a little proud of it, from the rim down to a bulb at its end. */
function dripGeo(d: Drip, radius: (th: number, y: number) => number, capY: number): THREE.BufferGeometry[] {
  const pts: THREE.Vector3[] = [];
  const n = 10;
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const y = d.y0 + 0.006 - (d.y0 + 0.006 - d.y1) * f;
    const th = d.th + 0.022 * Math.sin(f * 4.5 + d.th * 3) * f;
    const rr = radius(th, Math.min(y, capY)) + d.r * (i === 0 ? -0.3 : 0.32);
    pts.push(new THREE.Vector3(rr * Math.sin(th), y, rr * Math.cos(th)));
  }
  const end = pts[n]!.clone();
  const out = new THREE.Vector3(Math.sin(d.th), 0, Math.cos(d.th));
  return [
    tube(
      pts,
      28,
      12,
      (t) => {
        const w = d.r * (0.62 + 0.6 * (1 - t) ** 3 + 0.1 * Math.sin(t * 9 + d.th));
        return [w * 0.75, w];
      },
      undefined,
      0.3,
    ),
    bulb(end.addScaledVector(out, d.r * 0.15).setY(end.y - d.r * 0.2), d.r * 1.3),
  ];
}

/** The old candle's drips: many round the slumped side, a few long ones down to the pool. */
function oldDrips(): Drip[] {
  const r = seeded(808);
  const out: Drip[] = [];
  for (const th of [-1.05, -0.38, 0.32, 1.0, 2.7]) {
    const y0 = lipY(th);
    out.push({ th, y0, y1: Y0 + 0.045 + r() * 0.02, r: 0.013 + r() * 0.004 });
  }
  for (let k = 0; k < 17; k++) {
    const near = k < 9;
    const th = near ? SLUMP + (r() - 0.5) * 2.0 : r() * TAU;
    const y0 = lipY(th);
    const len = k % 3 === 0 ? 0.2 + r() * 0.3 : 0.04 + r() * 0.14;
    out.push({ th, y0, y1: Math.max(Y0 + 0.06, y0 - len), r: 0.007 + r() * 0.006 });
  }
  return out;
}

/** Wax that has run over the dish's rim: a flat tongue over the lip, hanging in a drop. */
function spill(th: number, long: boolean): THREE.BufferGeometry[] {
  const path: [number, number][] = long
    ? [
        [0.33, -0.589],
        [0.352, -0.5865],
        [0.372, -0.573],
        [0.392, -0.555],
        [0.41, -0.5415],
        [0.428, -0.5365],
        [0.441, -0.543],
        [0.4455, -0.556],
        [0.4448, -0.572],
        [0.4432, -0.585],
      ]
    : [
        [0.41, -0.5415],
        [0.428, -0.5365],
        [0.4415, -0.5435],
        [0.4455, -0.5555],
        [0.4445, -0.5655],
      ];
  const s = Math.sin(th);
  const c = Math.cos(th);
  const pts = path.map(([r, y]) => new THREE.Vector3(r * s, y, r * c));
  const side = new THREE.Vector3(c, 0, -s);
  const w0 = long ? 0.026 : 0.013;
  const end = pts[pts.length - 1]!;
  return [
    tube(pts, 30, 12, (t) => [0.0055 + 0.003 * t, w0 * (1 - t) + 0.0075], side, 0.35),
    bulb(new THREE.Vector3(end.x, end.y - 0.004, end.z), long ? 0.0095 : 0.0075),
  ];
}

function buildNew() {
  const drips: Drip[] = [
    { th: -0.45, y0: NEW_TOP - 0.008, y1: NEW_TOP - 0.075, r: 0.0075 },
    { th: 0.62, y0: NEW_TOP - 0.008, y1: NEW_TOP - 0.045, r: 0.0065 },
    { th: 2.5, y0: NEW_TOP - 0.008, y1: NEW_TOP - 0.1, r: 0.007 },
  ];
  const wax = merge([
    revolve(() => NEW_PROFILE, 128),
    ...drips.flatMap((d) => dripGeo(d, () => NEW_R, NEW_TOP)),
  ]);
  const wickPts = [
    [0, NEW_TOP - 0.03, 0],
    [0, NEW_TOP + 0.005, 0],
    [0.001, NEW_TOP + 0.028, 0],
    [0.006, NEW_TOP + 0.043, 0.002],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  return {
    wax,
    // white cotton below, burnt black at the tip
    wick: tube(wickPts.slice(0, 3), 8, 8, () => [0.0055, 0.0055]),
    wickTip: tube(wickPts.slice(1), 8, 8, (t) => [0.0056 - 0.0014 * t, 0.0056 - 0.0014 * t]),
  };
}

function buildOld() {
  const wax = merge([
    revolve(oldProfile, 128),
    revolve(poolProfile, 128),
    ...oldDrips().flatMap((d) => dripGeo(d, oldR, Infinity)),
    ...spill(SLUMP + 0.05, true),
    ...spill(0.95, true),
    ...spill(-1.3, false),
    ...spill(0.3, false),
    ...spill(2.4, true),
  ]);
  const wick = tube(
    [
      [0, FLOOR - 0.006, 0],
      [0.001, FLOOR + 0.025, 0],
      [0.006, FLOOR + 0.05, 0.002],
      [0.016, FLOOR + 0.067, 0.006],
      [OLD_TIP[0], OLD_TIP[1], OLD_TIP[2]],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    16,
    8,
    (t) => [0.0062 - 0.0018 * t, 0.0062 - 0.0018 * t],
  );
  const dish = revolve(() => DISH, 128);
  patina(dish);
  return { wax, wick, dish };
}

/** The tip of the old wick (the ember, where the smoke comes from) and of the new one. */
const OLD_TIP: V3 = [0.026, FLOOR + 0.074, 0.01];
const NEW_FLAME: V3 = [0.002, NEW_TOP + 0.024, 0];
const OLD_FLAME: V3 = [0.013, FLOOR + 0.06, 0.004];

let newGeo: ReturnType<typeof buildNew> | null = null;
let oldGeo: ReturnType<typeof buildOld> | null = null;
let dishGeo: THREE.BufferGeometry | null = null;
const newParts = () => (newGeo ??= buildNew());
const oldParts = () => (oldGeo ??= buildOld());
const dishNew = () => (dishGeo ??= revolve(() => DISH, 128));

/* ------------------------------------------------------------------------------------------ */
/* Materials                                                                                  */
/* ------------------------------------------------------------------------------------------ */

/** The new candle's wax: fresh cream, a soft sheen; ages with everything else in the Reveal. */
const newWax = () =>
  mat('candleNewWax', {
    surface: 'wax',
    color: '#f6ead2',
    roughness: 0.42,
    sheen: 0.4,
    sheenColor: '#fff3dc',
    emissive: '#3b2714',
    emissiveIntensity: 0.35,
    hauntedColor: '#e2cfa8',
    decay: { age: 0.25, dust: 0.3 },
  });

/** How brightly the flame lights the old wax from within (set every frame). */
const waxGlow = { value: 0.3 };

/** Old ivory wax, mottled and yellowed, specked with grime, soot in the crater. */
function paintWax(g: CanvasRenderingContext2D, w: number, h: number) {
  const r = seeded(31);
  g.fillStyle = '#efe2c7';
  g.fillRect(0, 0, w, h);
  const dot = (x: number, y: number, rad: number, c: string) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, c);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  };
  // older, yellower wax in blotches, and paler fresh runs
  for (let i = 0; i < 170; i++) dot(r() * w, r() * h, 8 + r() * 40, `rgba(190,162,110,${0.05 + r() * 0.1})`);
  for (let i = 0; i < 90; i++) dot(r() * w, r() * h, 6 + r() * 26, `rgba(255,250,236,${0.08 + r() * 0.12})`);
  // runs down the side (the side is the middle of the texture, v 0.12..0.55)
  g.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const x = r() * w;
    const y = h * (0.45 + r() * 0.35);
    g.strokeStyle = `rgba(176,150,104,${0.05 + r() * 0.07})`;
    g.lineWidth = 1 + r() * 3;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 6, y + 20 + r() * 70);
    g.stroke();
  }
  // soot and old dark wax in the crater, the top of the texture (v 0.78..1)
  const soot = g.createLinearGradient(0, 0, 0, h * 0.24);
  soot.addColorStop(0, 'rgba(92,74,52,0.55)');
  soot.addColorStop(0.7, 'rgba(120,98,66,0.25)');
  soot.addColorStop(1, 'rgba(120,98,66,0)');
  g.fillStyle = soot;
  g.fillRect(0, 0, w, h * 0.24);
  // grime: fine dark specks, more of them low down, and a few grey smudges
  for (let i = 0; i < 260; i++) {
    const y = h * (0.2 + Math.sqrt(r()) * 0.8);
    g.fillStyle = `rgba(48,36,26,${0.35 + r() * 0.55})`;
    g.beginPath();
    g.arc(r() * w, y, 0.5 + r() * 1.6, 0, TAU);
    g.fill();
  }
  for (let i = 0; i < 24; i++) dot(r() * w, h * (0.3 + r() * 0.65), 4 + r() * 9, `rgba(110,96,78,${0.12 + r() * 0.12})`);
}

let oldWaxMat: THREE.MeshPhysicalMaterial | null = null;
/**
 * The old wax: a soft sheen, and light coming through it the way it does through wax, the top
 * lighter and warmer than the foot and glowing round the crater while the flame burns.
 */
function oldWax(): THREE.MeshPhysicalMaterial {
  if (oldWaxMat) return oldWaxMat;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d');
  if (g) paintWax(g, 512, 512);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.anisotropy = 4;
  const m = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    map,
    roughness: 0.5,
    sheen: 0.6,
    sheenColor: new THREE.Color('#fff0d4'),
    sheenRoughness: 0.5,
    clearcoat: 0.28,
    clearcoatRoughness: 0.45,
  });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uGlow = waxGlow;
    sh.uniforms.uTop = { value: OLD_TOP };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWaxP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWaxP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWaxP;\nuniform float uGlow;\nuniform float uTop;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float wTop = smoothstep(uTop - 0.36, uTop + 0.01, vWaxP.y);
        float wEdge = 1.0 - abs(dot(normal, normalize(vViewPosition)));
        totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.66, 0.36) * (0.06 + 0.05 * wTop + uGlow * wTop * (0.5 + 0.8 * wEdge));`,
      );
  };
  m.customProgramCacheKey = () => 'candle-old-wax';
  oldWaxMat = m;
  return m;
}

let dishOldMat: THREE.MeshStandardMaterial | null = null;
const dishOld = () =>
  (dishOldMat ??= new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, metalness: 0.7, roughness: 0.52 }));

const cinnamon = () =>
  mat('cinnamon', {
    surface: 'wood',
    color: '#8b4a24',
    roughness: 0.78,
    hauntedColor: '#3b2619',
    side: THREE.DoubleSide,
    decay: { age: 0.5, dust: 0.5 },
  });
const twine = () => mat('twine', { surface: 'fabric', color: '#c9a877', roughness: 1, hauntedColor: '#54473a', decay: { dust: 0.4, tear: 0.1 } });

/* ------------------------------------------------------------------------------------------ */
/* Flame and ember                                                                            */
/* ------------------------------------------------------------------------------------------ */

const BILL_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * A candle flame: a teardrop, blue at its root, a white-gold core, orange at the edges, swaying
 * more toward its tip. Drawn additively.
 */
const FLAME_FRAG = /* glsl */ `
uniform float uSway;
uniform float uBright;
varying vec2 vUv;
void main() {
  vec2 p = vUv - vec2(0.5, 0.2);
  float h = p.y / 0.75;
  p.x -= uSway * max(h, 0.0) * max(h, 0.0) * 0.07;
  float w = 0.19 * sqrt(clamp((h + 0.2) / 0.32, 0.0, 1.0)) * pow(clamp(1.0 - h, 0.0, 1.0), 0.75);
  float d = abs(p.x) / max(w, 1e-3);
  float body = smoothstep(1.0, 0.4, d) * step(-0.2, h) * smoothstep(1.0, 0.78, h);
  float core = smoothstep(0.8, 0.0, d) * smoothstep(-0.1, 0.1, h) * smoothstep(0.72, 0.2, h);
  float blue = smoothstep(0.1, -0.14, h);
  vec3 col = mix(vec3(1.0, 0.42, 0.08), vec3(1.0, 0.76, 0.36), smoothstep(0.95, 0.3, d));
  col = mix(col, vec3(1.0, 0.97, 0.86), core * 0.85);
  col = mix(col, vec3(0.3, 0.42, 1.0), blue * 0.75);
  float a = body * (1.0 - 0.55 * blue) * uBright;
  gl_FragColor = vec4(col, a);
}
`;

/** A soft round glow round a light (the flame, the ember). */
const GLOW_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uBright;
varying vec2 vUv;
void main() {
  vec2 p = vUv - 0.5;
  float r2 = dot(p, p);
  float a = (exp(-r2 * 20.0) * 0.32 + exp(-r2 * 150.0) * 0.45) * uBright;
  gl_FragColor = vec4(uColor, a);
}
`;

function additive(frag: string, uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: BILL_VERT,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

function buildLights() {
  const flameGeo = new THREE.PlaneGeometry(0.085, 0.21);
  flameGeo.translate(0, 0.063, 0);
  const flameU = { uSway: { value: 0 }, uBright: { value: 1 } };
  const haloU = { uColor: { value: new THREE.Color('#ffae55') }, uBright: { value: 1 } };
  const emberU = { uColor: { value: new THREE.Color('#ff6420') }, uBright: { value: 0 } };
  const halo = new THREE.PlaneGeometry(0.6, 0.6);
  halo.translate(0, 0.05, 0);
  return {
    flameGeo,
    flameU,
    flameMat: additive(FLAME_FRAG, flameU),
    haloGeo: halo,
    haloU,
    haloMat: additive(GLOW_FRAG, haloU),
    emberHaloGeo: new THREE.PlaneGeometry(0.11, 0.11),
    emberU,
    emberHaloMat: additive(GLOW_FRAG, emberU),
    emberMat: new THREE.MeshBasicMaterial({ color: '#ff6a24', transparent: true, opacity: 0, toneMapped: false }),
  };
}
let lightParts: ReturnType<typeof buildLights> | null = null;
const lights = () => (lightParts ??= buildLights());

/** How bright the ember on the wick is, s after the Take: it glows, dims slowly, goes dark. */
function emberAt(s: number): number {
  if (s < 0 || s === Infinity) return 0;
  const on = smooth((s - 0.08) / 0.25);
  const dim = 1 - 0.4 * smooth((s - 0.8) / 4.0);
  const off = 1 - smooth((s - 5.0) / 2.0);
  return on * dim * off * (0.88 + 0.12 * Math.sin(s * 2.3));
}

/* ------------------------------------------------------------------------------------------ */
/* The smoke ghost                                                                            */
/* ------------------------------------------------------------------------------------------ */

/*
 * The smoke is painted once into a 704x1536 texture (the shape of its picture), one channel per
 * part: red is the smoke (one column of fine twisting filaments), green the pale oval of the
 * face in it, blue the dark of its eyes and mouth and the shadow under its jaw. The shader
 * warps, reveals and composites them.
 */
const GW = 704;
const GH = 1536;
/** The smoke's picture in the candle's space: width and height, its foot on the ember. */
const SMOKE_W = 0.46;
const SMOKE_H = 1.0;
/** How far up the column the face is (0 at the wick, 1 at the top), and its size in pixels. */
const FACE_V = 0.53;
const FACE_RX = GW / 24;
const FACE_TOP = 32;
const FACE_BOT = 42;

type Ch = 'r' | 'g' | 'b';
const ink = (ch: Ch, a: number) =>
  `rgba(${ch === 'r' ? 255 : 0},${ch === 'g' ? 255 : 0},${ch === 'b' ? 255 : 0},${clamp01(a).toFixed(4)})`;

/**
 * The middle of the column, x in pixels, at height v (0 at the wick, 1 at the top): straight up
 * off the wick, then a slight, slow S.
 */
function colX(v: number): number {
  return GW / 2 + GW * smooth(v / 0.35) * (0.022 * Math.sin(v * 4.4 - 0.5) + 0.009) + GW * 0.006 * v * Math.sin(v * 11 + 1.1);
}

/** Half the column's width at height v: a few px at the wick, about a fifth of the picture at the top, thicker round the face. */
function colHW(v: number): number {
  return 1.2 + GW * 0.1 * v ** 1.3 + 15 * Math.exp(-(((v - FACE_V) / 0.075) ** 2));
}

/** Where the face is, in texture pixels. */
const FX = colX(FACE_V);
const FY = GH * (1 - FACE_V);

interface Strand {
  /** Its angle round the column at the wick, and how many times it winds round as it rises. */
  ph: number;
  turns: number;
  /** How far out from the middle it winds (share of the column's half-width). */
  amp: number;
  /** Where it starts and stops (0..1 up the column), and how quickly it fades in. */
  v0: number;
  v1: number;
  fin: number;
  alpha: number;
  width: number;
  /** A slow wobble in its winding. */
  wob: number;
  wph: number;
  /** Which side of the face it passes; 0 for the few that run straight over it. */
  side: number;
}

const strandAngle = (s: Strand, v: number) => s.ph + TAU * s.turns * v + s.wob * Math.sin(v * 7 + s.wph);

/** The filaments: most rise from the wick itself, others come into sight a little way up. */
function makeStrands(): Strand[] {
  const r = seeded(1225);
  const out: Strand[] = [];
  const n = 11;
  for (let k = 0; k < n; k++) {
    const s: Strand = {
      ph: (k / n) * TAU + (r() - 0.5) * 0.4,
      turns: 2.0 + r() * 0.8,
      amp: 0.55 + r() * 0.45,
      v0: k < 5 ? 0 : 0.04 + r() * 0.22,
      v1: 0.84 + r() * 0.16,
      fin: k < 5 ? 0.02 : 0.12,
      alpha: 0.55 + r() * 0.45,
      width: 0.8 + r() * 0.6,
      wob: 0.15 + r() * 0.25,
      wph: r() * TAU,
      side: 1,
    };
    s.side = Math.sin(strandAngle(s, FACE_V)) >= 0 ? 1 : -1;
    out.push(s);
  }
  // two faint ones that run on over the face: it is made of the same smoke
  for (let k = 0; k < 2; k++)
    out.push({
      ph: r() * TAU,
      turns: 1.6 + r() * 0.5,
      amp: 0.45,
      v0: 0.3 + r() * 0.08,
      v1: 0.78 + r() * 0.1,
      fin: 0.2,
      alpha: 0.3,
      width: 0.8,
      wob: 0.2,
      wph: r() * TAU,
      side: 0,
    });
  return out;
}

/** A point on a filament at height v, and whether it is in front of the column (depth 1) or behind (-1). */
function strandAt(s: Strand, v: number): { x: number; y: number; depth: number } {
  const a = strandAngle(s, v);
  let d = colHW(v) * s.amp * Math.sin(a);
  if (s.side !== 0) {
    // the filaments part round the face, hug its sides and close in again above it
    const w = Math.exp(-((((v - FACE_V) * GH) / (FACE_BOT * 1.5)) ** 2));
    d = d * (1 - 0.55 * w) + s.side * FACE_RX * 1.1 * w;
  }
  return { x: colX(v) + d, y: GH * (1 - v), depth: Math.cos(a) };
}

/**
 * Strokes one filament, a short segment at a time so it can thicken and fade as it rises: fine
 * at the wick, softer higher up, brighter where it winds round the front, gone at the top.
 */
function drawStrand(g: CanvasRenderingContext2D, s: Strand, widthMul: number, alphaMul: number, ch: Ch) {
  const n = 260;
  g.save();
  // butt ends, so the added segments do not pile up into beads where they meet
  g.lineCap = 'butt';
  let prev = strandAt(s, s.v0);
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const v = s.v0 + (s.v1 - s.v0) * t;
    const p = strandAt(s, v);
    const a =
      s.alpha *
      alphaMul *
      smooth(t / s.fin) *
      (1 - smooth((t - 0.75) / 0.25)) *
      (1 - smooth((v - 0.62) / 0.38)) *
      (0.45 + 0.55 * (0.5 + 0.5 * p.depth));
    if (a > 0.002) {
      g.strokeStyle = ink(ch, a);
      g.lineWidth = s.width * widthMul * (0.7 + 2.3 * v);
      g.beginPath();
      g.moveTo(prev.x, prev.y);
      g.lineTo(p.x, p.y);
      g.stroke();
    }
    prev = p;
  }
  g.restore();
}

/** A soft round blob (an ellipse fading out from its middle). `hard` keeps it dense further out. */
function blob(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a: number, ch: Ch, rot = 0, hard = 0.55) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(rx, ry);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
  gr.addColorStop(0, ink(ch, a));
  gr.addColorStop(hard, ink(ch, a * (hard > 0.6 ? 0.9 : 0.55)));
  gr.addColorStop(1, ink(ch, 0));
  g.fillStyle = gr;
  g.beginPath();
  g.arc(0, 0, 1, 0, TAU);
  g.fill();
  g.restore();
}

/** The face's outline: an oval, a little narrower and longer to the chin. `k` scales it. */
function eggPath(g: CanvasRenderingContext2D, k = 1) {
  g.beginPath();
  for (let i = 0; i <= 64; i++) {
    const p = (i / 64) * TAU;
    const c = Math.cos(p);
    const narrow = 1 - 0.28 * Math.max(0, -c) ** 1.4;
    const x = FX + k * FACE_RX * Math.sin(p) * narrow;
    const y = FY - k * (c > 0 ? FACE_TOP : FACE_BOT) * c;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
}

/** Haze: the volume of the smoke round the filaments, very soft (blurred most). */
function paintHaze(g: CanvasRenderingContext2D) {
  for (let v = 0.02; v < 1; v += 0.02) {
    const hw = colHW(v);
    blob(g, colX(v), GH * (1 - v), hw * 1.15, hw * 0.9 + 14, 0.035 * smooth(v / 0.12) * (1 - smooth((v - 0.6) / 0.4)), 'r');
  }
  // the column is a little denser where it thickens round the face
  blob(g, FX, FY, FACE_RX * 1.9, FACE_BOT * 1.6, 0.07, 'r');
  blob(g, FX, FY + 2, FACE_RX * 1.25, FACE_BOT * 1.15, 0.12, 'g');
  for (const sd of [-1, 1]) blob(g, FX + sd * 10, FY - 4, 12, 11, 0.2, 'b');
  blob(g, FX, FY + 21, 10, 15, 0.18, 'b');
}

/** Soft: the filaments' glow, the pale oval of the face, its eyes and mouth. */
function paintSoft(g: CanvasRenderingContext2D, strands: Strand[]) {
  for (const s of strands) drawStrand(g, s, 3.6, 0.16, 'r');
  // the face: palest on the brow and the cheekbones, thinning out to its edge
  eggPath(g);
  const face = g.createRadialGradient(FX, FY - 8, 3, FX, FY + 2, FACE_BOT * 1.1);
  face.addColorStop(0, ink('g', 0.42));
  face.addColorStop(0.5, ink('g', 0.32));
  face.addColorStop(0.85, ink('g', 0.14));
  face.addColorStop(1, ink('g', 0.02));
  g.fillStyle = face;
  g.fill();
  blob(g, FX, FY - 19, 15, 8, 0.12, 'g');
  blob(g, FX, FY + 36, 9, 5, 0.1, 'g');
  for (const sd of [-1, 1]) {
    blob(g, FX + sd * 14, FY + 6, 8, 6, 0.1, 'g');
    // the hollow eyes, drooping a little at the outer corners
    blob(g, FX + sd * 10, FY - 4, 6.5, 8.5, 0.85, 'b', -sd * 0.22, 0.7);
    // hollow cheeks above the jaw, which give the chin its shape
    blob(g, FX + sd * 19, FY + 22, 4.5, 12, 0.16, 'b', sd * 0.3);
  }
  blob(g, FX, FY + 9, 2.2, 3.5, 0.3, 'b');
  // the mouth: a dark oval hanging open
  blob(g, FX, FY + 21, 5.5, 9, 0.85, 'b', 0, 0.7);
  // the shadow under the jaw, where the smoke below shows darker
  blob(g, FX, FY + FACE_BOT + 6, 15, 5, 0.14, 'b');
}

/** Fine: the filaments themselves, smoke strands round the face's edge, the cores of the holes. */
function paintFine(g: CanvasRenderingContext2D, strands: Strand[]) {
  for (const s of strands) drawStrand(g, s, 1, 0.55, 'r');
  // the face is smoke too: faint strands follow its outline
  g.save();
  g.lineWidth = 1;
  for (const k of [0.82, 0.92, 1.0]) {
    eggPath(g, k);
    g.strokeStyle = ink('g', 0.08);
    g.stroke();
    g.strokeStyle = ink('r', 0.05);
    g.stroke();
  }
  g.restore();
  for (const sd of [-1, 1]) blob(g, FX + sd * 10, FY - 3, 3.5, 4.5, 0.6, 'b');
  blob(g, FX, FY + 21, 3, 6, 0.6, 'b');
}

/** Draws a layer onto the picture, added, blurred by about `px` (by filter, or by scaling). */
function blurOnto(dst: CanvasRenderingContext2D, src: HTMLCanvasElement, px: number) {
  dst.save();
  dst.globalCompositeOperation = 'lighter';
  // canvas filters are missing in older Safari: there the layer is blurred by scaling it down and up
  const canFilter = typeof (dst as { filter?: unknown }).filter === 'string';
  if (px > 0 && canFilter) {
    dst.filter = `blur(${px}px)`;
    dst.drawImage(src, 0, 0);
  } else if (px > 1.5) {
    const k = Math.max(2, Math.round(px / 1.5));
    const small = document.createElement('canvas');
    small.width = Math.ceil(GW / k);
    small.height = Math.ceil(GH / k);
    const sg = small.getContext('2d');
    if (sg) {
      sg.drawImage(src, 0, 0, small.width, small.height);
      dst.imageSmoothingEnabled = true;
      dst.drawImage(small, 0, 0, GW, GH);
    }
  } else {
    dst.drawImage(src, 0, 0);
  }
  dst.restore();
}

function paintGhost(): HTMLCanvasElement {
  const main = document.createElement('canvas');
  main.width = GW;
  main.height = GH;
  const g = main.getContext('2d');
  if (!g) return main;
  g.fillStyle = '#000';
  g.fillRect(0, 0, GW, GH);
  const strands = makeStrands();
  const layer = (paint: (lg: CanvasRenderingContext2D) => void, px: number) => {
    const c = document.createElement('canvas');
    c.width = GW;
    c.height = GH;
    const lg = c.getContext('2d');
    if (!lg) return;
    lg.globalCompositeOperation = 'lighter';
    lg.lineCap = 'round';
    lg.lineJoin = 'round';
    paint(lg);
    blurOnto(g, c, px);
  };
  layer(paintHaze, 18);
  layer((lg) => paintSoft(lg, strands), 4);
  layer((lg) => paintFine(lg, strands), 0.6);
  return main;
}

const SMOKE_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uTime;
uniform float uSpeed;
uniform float uSeed;
uniform float uFront;
uniform float uFace;
uniform float uRise;
uniform float uBreak;
uniform float uAlpha;
uniform float uEmber;
uniform float uThread;
uniform float uFaceMul;
uniform vec2 uOff;
varying vec2 vUv;
const float ASPECT = ${(SMOKE_W / SMOKE_H).toFixed(4)};
float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { return 0.55 * n3(p) + 0.3 * n3(p * 2.1) + 0.15 * n3(p * 4.3); }
float inside(vec2 u) { return step(0.0, u.x) * step(u.x, 1.0) * step(0.0, u.y) * step(u.y, 1.0); }
void main() {
  float h = vUv.y;
  float t = uTime * uSpeed;
  vec2 uv = vUv - uOff * smoothstep(0.15, 0.7, h);
  // rising on, and spreading a little as it rises
  uv.y -= uRise * 0.14 * (0.25 + h);
  uv.x = 0.5 + (uv.x - 0.5) / (1.0 + uRise * 0.4 * h);
  // noise is taken in the picture's true shape, so its swirls are round
  vec2 p = vec2(uv.x * ASPECT, uv.y);
  // the sway: slow, broad noise travelling up the column, none at the wick, more higher up
  vec3 q = vec3(p.x * 2.2, p.y * 2.2 - t * 0.2, t * 0.08 + uSeed);
  vec2 w = vec2(fbm(q), fbm(q + vec3(5.2, 1.3, 2.8))) - 0.5;
  // and a finer curl along the filaments
  vec3 q2 = vec3(p.x * 9.0 + w.x * 1.5, p.y * 7.0 - t * 0.45, t * 0.16 + uSeed * 1.7);
  vec2 w2 = vec2(n3(q2), n3(q2 + vec3(3.1, 7.4, 1.9))) - 0.5;
  float amp = 0.003 + 0.09 * smoothstep(0.02, 0.9, h);
  vec2 sway = vec2(w.x * amp, w.y * amp * 0.25);
  vec2 su = uv + sway + vec2(w2.x * amp * 0.25, w2.y * amp * 0.1);
  // the face sways with the column but keeps its shape
  vec2 fu = uv + sway + w2 * amp * 0.04;
  vec4 s = texture2D(uMap, su) * inside(su);
  vec4 f = texture2D(uMap, fu) * inside(fu);
  float edge = smoothstep(1.0, 0.9, vUv.y) * smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
  float nz = fbm(vec3(p * 6.0, uSeed + 9.0));
  // revealed from the bottom up as the smoke climbs, its front ragged
  float shown = smoothstep(uFront + 0.02, uFront - 0.12, h + (nz - 0.5) * 0.1);
  shown *= mix(1.0, smoothstep(0.3, 0.16, h), uThread);
  // denser and thinner patches travelling up the filaments, so the smoke flows
  float flow = 0.7 + 0.6 * n3(vec3(p.x * 14.0, p.y * 10.0 - t * 0.9, t * 0.3 + uSeed));
  // thinning out: holes open in it and spread
  float b = fbm(vec3(p * vec2(9.0, 5.0), t * 0.25 + 3.0));
  float keep = 1.0 - smoothstep(b - 0.12, b + 0.12, uBreak * 1.2 - 0.05);
  float d = s.r * flow;
  float sa = smoothstep(0.0, 0.85, d) * 0.9 * shown * keep * edge * uAlpha;
  vec3 sc = mix(vec3(0.55, 0.57, 0.6), vec3(0.9, 0.9, 0.89), smoothstep(0.05, 0.7, d));
  sc += uEmber * vec3(0.4, 0.16, 0.04) * pow(max(0.0, 1.0 - h * 5.0), 3.0);
  // the face condenses in patches rather than fading in evenly
  float fm = uFace * uFaceMul * keep * edge * uAlpha * shown;
  float cond = smoothstep(nz - 0.25, nz + 0.25, uFace * 1.4 - 0.2);
  float af = clamp(f.g * 1.2, 0.0, 1.0) * fm * cond * 0.72;
  float ah = clamp(f.b * 1.1, 0.0, 1.0) * fm * cond * 0.75;
  vec3 col = sc * sa;
  float a = sa;
  col = vec3(0.9, 0.89, 0.86) * af + col * (1.0 - af);
  a = af + a * (1.0 - af);
  col = vec3(0.01, 0.012, 0.016) * ah + col * (1.0 - ah);
  a = ah + a * (1.0 - ah);
  gl_FragColor = vec4(col, a);
}
`;

function smokeUniforms(map: THREE.Texture, seed: number, speed: number, faceMul: number, thread: number) {
  return {
    uMap: { value: map },
    uTime: { value: 0 },
    uSpeed: { value: speed },
    uSeed: { value: seed },
    uFront: { value: 0 },
    uFace: { value: 0 },
    uRise: { value: 0 },
    uBreak: { value: 0 },
    uAlpha: { value: 0 },
    uEmber: { value: 0 },
    uThread: { value: thread },
    uFaceMul: { value: faceMul },
    uOff: { value: new THREE.Vector2() },
  };
}
type SmokeU = ReturnType<typeof smokeUniforms>;

function smokeMat(u: SmokeU): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: BILL_VERT,
    fragmentShader: SMOKE_FRAG,
    transparent: true,
    depthWrite: false,
    premultipliedAlpha: true,
  });
}

function buildGhost() {
  const tex = new THREE.CanvasTexture(paintGhost());
  tex.anisotropy = 4;
  const geo = new THREE.PlaneGeometry(SMOKE_W, SMOKE_H);
  geo.translate(0, SMOKE_H / 2, 0);
  const front = smokeUniforms(tex, 1.3, 1, 1, 0);
  const back = smokeUniforms(tex, 7.9, 0.62, 0, 0);
  const wisp = smokeUniforms(tex, 4.4, 1.2, 0, 1);
  return { geo, front, back, wisp, mats: { front: smokeMat(front), back: smokeMat(back), wisp: smokeMat(wisp) } };
}
let ghostGeo: ReturnType<typeof buildGhost> | null = null;
const ghostParts = () => (ghostGeo ??= buildGhost());

interface SmokeState {
  time: number;
  front: number;
  face: number;
  rise: number;
  brk: number;
  alpha: number;
  ember: number;
  off: [number, number];
}

function setSmoke(u: SmokeU, st: SmokeState) {
  u.uTime.value = st.time;
  u.uFront.value = st.front;
  u.uFace.value = st.face;
  u.uRise.value = st.rise;
  u.uBreak.value = st.brk;
  u.uAlpha.value = st.alpha;
  u.uEmber.value = st.ember;
  u.uOff.value.set(st.off[0], st.off[1]);
}

const qA = new THREE.Quaternion();
const qB = new THREE.Quaternion();
const vA = new THREE.Vector3();

/** Turns a thing to face the camera, whatever its parents are turned to. */
function faceCamera(o: THREE.Object3D, cam: THREE.Camera) {
  if (!o.parent) return;
  o.parent.getWorldQuaternion(qA);
  cam.getWorldQuaternion(qB);
  o.quaternion.copy(qA.invert().multiply(qB));
}

/** Turns a thing about its upright axis only to face the camera (a flame stays upright). */
function faceCameraY(o: THREE.Object3D, cam: THREE.Camera) {
  if (!o.parent) return;
  cam.getWorldPosition(vA);
  o.parent.worldToLocal(vA);
  o.rotation.set(0, Math.atan2(vA.x - o.position.x, vA.z - o.position.z), 0);
}

/** Every frame of the smoke, from the seconds since the Take (outside the component). */
function driveSmoke(root: THREE.Group | null, s: number, cam: THREE.Camera) {
  if (!root) return;
  if (s < 0 || s === Infinity || s > TAKE.end) {
    root.visible = false;
    return;
  }
  root.visible = true;
  faceCamera(root, cam);
  const p = ghostParts();
  const t = s;
  // the thread climbs (0.3-1.5 s), then the column grows up out of it (1.3-3.0 s)
  const front = Math.max(0.3 * smooth((t - 0.3) / 1.2), t > 1.3 ? 0.3 + 0.85 * smooth((t - 1.3) / 1.7) : 0);
  // it hangs (3.8-5.0 s), then rises on and thins out (5.0-6.5 s)
  const rise = progress(t, 1.4, 5.0);
  const alpha = 1 - progress(t, 1.0, 5.5);
  const ember = emberAt(t);
  const off: [number, number] = [Math.sin(t * 0.7) * 0.006, Math.sin(t * 0.53 + 1) * 0.004];
  // the face condenses in it (2.4-3.8 s)
  setSmoke(p.front, { time: t, front, face: progress(t, 1.4, 2.4), rise, brk: rise, alpha, ember, off });
  // a fainter second layer, swaying on its own, gives the column depth
  setSmoke(p.back, { time: t + 11, front: front - 0.05, face: 0, rise: rise * 1.1, brk: rise, alpha: alpha * 0.35, ember, off });
  // a last thin wisp from the ember as it dies (6.0-7.0 s)
  const wisp = t > 6.0 ? 1 - progress(t, 0.6, 6.4) : 0;
  setSmoke(p.wisp, { time: t + 3, front: 0.3 * smooth((t - 6.0) / 0.5), face: 0, rise: 0, brk: 0, alpha: wisp * 0.8, ember, off: [0, 0] });
}

/**
 * The smoke from the blown-out wick: one straight column of fine twisting filaments rising off
 * the ember, and partway up, small, a face in it: a pale oval, hollow eyes, an open mouth. It
 * hangs a moment, swaying, then rises on and thins out. A picture that always turns to face
 * you, its foot on the ember.
 */
function SmokeGhost({ since, scale }: { since: () => number; scale: number }) {
  const root = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const p = ghostParts();
  useFrame(() => driveSmoke(root.current, since(), camera));
  return (
    <group ref={root} position={OLD_TIP} scale={scale} visible={false} userData={{ extra: true }}>
      <mesh geometry={p.geo} material={p.mats.back} position-z={-0.03} scale={1.04} renderOrder={6} />
      <mesh geometry={p.geo} material={p.mats.front} renderOrder={7} />
      <mesh geometry={p.geo} material={p.mats.wisp} renderOrder={7} />
    </group>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* The candle                                                                                 */
/* ------------------------------------------------------------------------------------------ */

interface Rig {
  flame: THREE.Group | null;
  light: THREE.PointLight | null;
  ember: THREE.Group | null;
}

/** Every frame of the flame, its light and the ember (outside the component). */
function driveCandle(r: Rig, s: number, clock: number, base: number, cam: THREE.Camera, at: V3, haunted: boolean) {
  const lp = lights();
  // lit until it is taken; then it shrinks into the wick and dies in 0.3 s
  const lit = s < 0 ? 1 : 1 - progress(s, TAKE.out);
  const fl = 1 + Math.sin(clock * 13) * 0.05 + Math.sin(clock * 7.3 + 1) * 0.04 + Math.sin(clock * 23.1) * 0.02;
  const size = haunted ? 0.85 : 1;
  const f = r.flame;
  if (f) {
    f.visible = lit > 0.002;
    f.position.set(at[0], at[1] - 0.012 * (1 - lit), at[2]);
    f.scale.set(size * (0.55 + 0.45 * lit) * (1 - (fl - 1) * 0.5), size * fl * lit ** 0.8, size);
    faceCameraY(f, cam);
  }
  lp.flameU.uSway.value = Math.sin(clock * 3.1) * 0.6 + Math.sin(clock * 5.7) * 0.3;
  lp.flameU.uBright.value = Math.min(1, lit * 1.4);
  lp.haloU.uBright.value = lit * (0.85 + 0.15 * fl);
  if (r.light) r.light.intensity = base * lit * (0.92 + 0.08 * fl);
  waxGlow.value = 0.32 * lit * (0.9 + 0.1 * fl);
  const e = emberAt(s);
  lp.emberMat.opacity = e;
  lp.emberU.uBright.value = e * 0.8;
  if (r.ember) {
    r.ember.visible = e > 0.002;
    faceCameraY(r.ember, cam);
  }
}

/** The dish: polished brass by day; old dark bronze with patina after the Reveal. */
function Dish({ haunted }: { haunted: boolean }) {
  if (haunted) return <mesh geometry={oldParts().dish} material={dishOld()} />;
  return <mesh geometry={dishNew()} material={M.brass()} />;
}

function NewCandle() {
  const g = newParts();
  return (
    <group>
      <mesh geometry={g.wax} material={newWax()} />
      <mesh geometry={g.wick} material={M.clothWhite()} />
      <mesh geometry={g.wickTip} material={M.ink()} />
    </group>
  );
}

function OldCandle() {
  const g = oldParts();
  return (
    <group>
      <mesh geometry={g.wax} material={oldWax()} />
      <mesh geometry={g.wick} material={M.ink()} />
    </group>
  );
}

/** A holly leaf: a lens with spiky points along both edges. */
function buildLeaf(): THREE.ExtrudeGeometry {
  const L = 0.085;
  const W = 0.026;
  const n = 8;
  const pts: THREE.Vector2[] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    pts.push(new THREE.Vector2(t * L, Math.sin(Math.PI * t) ** 0.8 * W * (k % 2 ? 0.6 : 1.05)));
  }
  for (let k = n - 1; k > 0; k--) {
    const t = k / n;
    pts.push(new THREE.Vector2(t * L, -(Math.sin(Math.PI * t) ** 0.8) * W * (k % 2 ? 0.6 : 1.05)));
  }
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.003, bevelEnabled: false });
  g.translate(0, 0, -0.0015);
  return g;
}

function buildTrim() {
  // a rolled quill of bark, open along one side, with a tighter roll inside it
  const outer = new THREE.CylinderGeometry(0.018, 0.018, 0.21, 20, 1, true, 0.4, TAU * 0.9);
  const inner = new THREE.CylinderGeometry(0.011, 0.011, 0.21, 16, 1, true, 2.2, TAU * 0.8);
  return { quill: merge([outer, inner]), leaf: buildLeaf(), berry: new THREE.SphereGeometry(0.011, 12, 9) };
}
let trimGeo: ReturnType<typeof buildTrim> | null = null;
const trimParts = () => (trimGeo ??= buildTrim());

/**
 * The smoke's scale on a shelf card: the card fits the candle's body, which leaves about 0.6 of
 * its height above the wick; at this scale the column (0.54 tall) fades out inside it.
 */
const SHELF_SMOKE = 0.45;

/** Where the cinnamon lies on the dish: front right, along the gap between candle and wall. */
const TRIM_AT = 0.85;

/**
 * Two cinnamon sticks tied with twine and a sprig of holly, on the dish by the candle. After the
 * Reveal they are sunk in the pooled wax, the bark dark, the leaves dead and curled.
 */
function Trimmings({ haunted }: { haunted: boolean }) {
  const g = trimParts();
  const r = 0.305;
  const y = haunted ? -0.5865 : -0.581;
  return (
    <group position={[Math.sin(TRIM_AT) * r, y, Math.cos(TRIM_AT) * r]} rotation-y={TRIM_AT}>
      {[-0.013, 0.016].map((z, i) => (
        <mesh key={z} geometry={g.quill} material={cinnamon()} position={[i * 0.012 - 0.006, 0, z]} rotation={[i * 0.6, 0, Math.PI / 2]} />
      ))}
      <mesh material={twine()} rotation-y={Math.PI / 2} scale={[1, 0.62, 1]}>
        <torusGeometry args={[0.034, 0.003, 6, 32]} />
      </mesh>
      <group position={[0.02, 0.022, 0.004]} rotation-z={haunted ? -0.25 : 0}>
        <mesh geometry={g.leaf} material={M.green()} rotation={haunted ? [-0.9, 0.5, 0.2] : [-1.35, 0.25, 0.25]} />
        <mesh geometry={g.leaf} material={M.green()} rotation={haunted ? [-0.6, -0.4, Math.PI - 0.1] : [-1.3, -0.2, Math.PI - 0.35]} />
        {[
          [0, 0.006, 0.008],
          [0.014, 0.004, -0.004],
          [-0.012, 0.004, -0.006],
        ].map(([bx, by, bz], i) => (
          <mesh key={i} geometry={g.berry} material={M.berry()} position={[bx!, by!, bz!]} scale={haunted ? 0.7 : 1} />
        ))}
      </group>
    </group>
  );
}

/**
 * The candle for the window (see the top of this file). The flame flickers (with a periodic
 * redraw, so it lives on the on-demand shelf too) and lights the room; that light grows when
 * the mains fail. Taken, it goes out and a face shows in its smoke. On the shelf the light it
 * gave is gone afterwards: the card stands in a low light.
 */
export default function Candle() {
  const haunted = useHaunted();
  const { taken, since } = useTaken('candle');
  const invalidate = useThree((s) => s.invalidate);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const mains = useFx((s) => s.mains);
  const onShelf = !gl.domElement.closest('.inspection-canvas');
  const flame = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const ember = useRef<THREE.Group>(null);
  useEffect(() => {
    const t = setInterval(() => invalidate(), 80);
    return () => clearInterval(t);
  }, [invalidate]);
  // paint her in the smoke ahead of time, so the Take does not stall while it is drawn
  useEffect(() => {
    if (!haunted) return;
    const t = setTimeout(() => ghostParts(), 700);
    return () => clearTimeout(t);
  }, [haunted]);
  const base = 1.2 + (1 - mains);
  const at = haunted ? OLD_FLAME : NEW_FLAME;
  const lp = lights();
  useFrame((st) => driveCandle({ flame: flame.current, light: light.current, ember: ember.current }, since(), st.clock.elapsedTime, base, camera, at, haunted));
  return (
    <group>
      <Dish haunted={haunted} />
      {haunted ? <OldCandle /> : <NewCandle />}
      <Trimmings haunted={haunted} />
      <group ref={flame} position={at} userData={{ extra: true }}>
        <mesh geometry={lp.flameGeo} material={lp.flameMat} renderOrder={4} />
        <mesh geometry={lp.haloGeo} material={lp.haloMat} renderOrder={4} />
      </group>
      <pointLight ref={light} position={[at[0], at[1] + 0.12, 0.18]} intensity={base} distance={2.5} color="#ffb860" />
      {taken && (
        // the wick glowing after it is blown out, then going dark
        <group ref={ember} position={OLD_TIP} visible={false} userData={{ extra: true }}>
          <mesh material={lp.emberMat} renderOrder={6}>
            <sphereGeometry args={[0.0085, 12, 8]} />
          </mesh>
          <mesh geometry={lp.emberHaloGeo} material={lp.emberHaloMat} renderOrder={6} />
        </group>
      )}
      {taken && <SmokeGhost since={since} scale={onShelf ? SHELF_SMOKE : 1} />}
      {taken && onShelf && (
        // a dark veil all round the card's camera (seen from inside), over everything in it but the smoke
        <mesh renderOrder={5} userData={{ extra: true }}>
          <sphereGeometry args={[6, 24, 16]} />
          <meshBasicMaterial color="#020306" transparent opacity={0.6} depthWrite={false} depthTest={false} side={THREE.BackSide} />
        </mesh>
      )}
      {haunted && (
        // not drawn: the lower part of the smoke column, up to just above her face; the product
        // view frames it from the start (userData.frame), so the candle keeps nearly its usual
        // size and the view does not move when the Take happens. The column rises on out of it.
        <mesh position={[OLD_TIP[0], OLD_TIP[1] + (SMOKE_H * 0.66) / 2, OLD_TIP[2]]} userData={{ frame: true }}>
          <boxGeometry args={[SMOKE_W * 0.6, SMOKE_H * 0.66, 0.3]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      )}
    </group>
  );
}
