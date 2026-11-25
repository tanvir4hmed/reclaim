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
 * thin thread of smoke rises from it (0.3-1.6 s). The thread climbs and blooms into veils
 * (1.4-3.4 s), and her face comes up in the smoke (2.6-4.0 s): hollow eyes, the mouth open in
 * a long scream. She hangs there, drifting (4.0-5.6 s), then the smoke rises on and comes apart
 * (5.6-7.2 s). A last thin wisp leaves the dying ember (7.0-8.0 s), and then nothing.
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
const TAKE = { out: 0.3, end: 8.0 };

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
  const dim = 1 - 0.4 * smooth((s - 0.8) / 4.8);
  const off = 1 - smooth((s - 5.6) / 2.4);
  return on * dim * off * (0.88 + 0.12 * Math.sin(s * 2.3));
}

/* ------------------------------------------------------------------------------------------ */
/* The smoke ghost                                                                            */
/* ------------------------------------------------------------------------------------------ */

/*
 * She is painted once into a 1024x1536 texture, one channel per part: red is the smoke (the
 * thread, the veils, the wisps), green her pale face, blue the dark of her eyes, nose, mouth and
 * the streaks under her eyes. The shader warps, reveals and composites them.
 */
const GW = 1024;
const GH = 1536;
/** The middle of her face in the texture. */
const FX = 512;
const FY = 430;
/** The smoke's picture in the candle's space: width and height, its foot on the ember. */
const SMOKE_W = 1.6;
const SMOKE_H = 2.4;

type P2 = [number, number];
type Ch = 'r' | 'g' | 'b';
const ink = (ch: Ch, a: number) =>
  `rgba(${ch === 'r' ? 255 : 0},${ch === 'g' ? 255 : 0},${ch === 'b' ? 255 : 0},${clamp01(a).toFixed(4)})`;

/** A smooth line through the points (Catmull-Rom), as n + 1 points. */
function spline(pts: P2[], n: number): P2[] {
  const out: P2[] = [];
  const m = pts.length - 1;
  for (let i = 0; i <= n; i++) {
    const f = (i / n) * m;
    const k = Math.min(m - 1, Math.floor(f));
    const t = f - k;
    const p0 = pts[Math.max(0, k - 1)]!;
    const p1 = pts[k]!;
    const p2 = pts[k + 1]!;
    const p3 = pts[Math.min(m, k + 2)]!;
    const cr = (a: number, b: number, c: number, d: number) =>
      0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
    out.push([cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])]);
  }
  return out;
}

interface Rib {
  /** How many strands, how far apart they are at the start and at the end. */
  n: number;
  s0: number;
  s1: number;
  width: number;
  alpha: number;
  /** How far each strand wanders off the line, growing along it. */
  wob?: number;
  /** Alpha at the start and the end of the strands. */
  fade?: [number, number];
}

/**
 * A ribbon of smoke along a path: many thin strands side by side, fanning out along it, each
 * wandering a little and starting and stopping at its own place, as filaments of smoke do.
 */
function ribbon(g: CanvasRenderingContext2D, path: P2[], o: Rib, ch: Ch, r: () => number) {
  const line = spline(path, 140);
  const L = line.length - 1;
  const [f0, f1] = o.fade ?? [1, 1];
  for (let k = 0; k < o.n; k++) {
    const u = o.n === 1 ? 0 : k / (o.n - 1) - 0.5 + (r() - 0.5) * (0.6 / o.n);
    const ph = r() * TAU;
    const fr = 1.5 + r() * 4;
    const wob = (o.wob ?? 6) * (0.4 + r());
    const a = o.alpha * (0.35 + r() * 0.9);
    const i0 = Math.floor(r() * 0.15 * L);
    const i1 = L - Math.floor(r() * 0.22 * L);
    g.beginPath();
    for (let i = i0; i <= i1; i++) {
      const t = i / L;
      const [x, y] = line[i]!;
      const [xa, ya] = line[Math.max(0, i - 1)]!;
      const [xb, yb] = line[Math.min(L, i + 1)]!;
      const nl = Math.hypot(yb - ya, xb - xa) || 1;
      const nx = -(yb - ya) / nl;
      const ny = (xb - xa) / nl;
      const d = u * (o.s0 + (o.s1 - o.s0) * t) + Math.sin(t * fr * Math.PI + ph) * wob * t;
      if (i === i0) g.moveTo(x + nx * d, y + ny * d);
      else g.lineTo(x + nx * d, y + ny * d);
    }
    const p0 = line[i0]!;
    const p1 = line[i1]!;
    const grad = g.createLinearGradient(p0[0], p0[1], p1[0], p1[1] + 0.01);
    grad.addColorStop(0, ink(ch, a * f0));
    grad.addColorStop(0.5, ink(ch, a));
    grad.addColorStop(1, ink(ch, a * f1));
    g.strokeStyle = grad;
    g.lineWidth = o.width * (0.6 + r() * 0.8);
    g.stroke();
  }
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

/** Her face's outline: an egg, narrower to the chin, the jaw long because the mouth hangs open. */
function eggPath(g: CanvasRenderingContext2D, rx: number, top: number, bottom: number) {
  g.beginPath();
  for (let i = 0; i <= 72; i++) {
    const p = (i / 72) * TAU;
    const c = Math.cos(p);
    const narrow = 1 - 0.26 * Math.max(0, -c) ** 1.4;
    const x = FX + rx * Math.sin(p) * narrow;
    const y = FY - (c > 0 ? top : bottom) * c;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
}

/* The paths of the smoke, in texture pixels (the ember is at the bottom middle, 512, 1536). */
const THREAD: P2[] = [
  [512, 1536],
  [507, 1482],
  [515, 1424],
  [528, 1364],
  [522, 1302],
  [502, 1244],
  [496, 1184],
  [511, 1124],
];
const mirror = (p: P2[], jig = 0): P2[] => p.map(([x, y], i): P2 => [1024 - x + (i % 2 ? jig : -jig), y + (i % 3) * jig]);
const HOOD_L: P2[] = [
  [505, 235],
  [430, 245],
  [372, 320],
  [352, 450],
  [362, 600],
  [380, 760],
  [420, 900],
  [470, 1020],
  [500, 1120],
];
const OUTER_L: P2[] = [
  [490, 215],
  [380, 210],
  [290, 290],
  [250, 450],
  [262, 640],
  [300, 820],
  [370, 960],
  [455, 1075],
  [505, 1150],
];
const FRAME_L: P2[] = [
  [470, 262],
  [415, 330],
  [396, 450],
  [402, 580],
  [425, 690],
];
const CURL_L: P2[] = [
  [470, 230],
  [360, 160],
  [240, 150],
  [150, 222],
  [122, 332],
  [170, 410],
  [245, 396],
  [262, 330],
  [225, 296],
];
const FLARE_L: P2[] = [
  [505, 240],
  [480, 150],
  [420, 88],
  [320, 64],
  [232, 88],
];
const SWEEP_L: P2[] = [
  [382, 700],
  [282, 682],
  [192, 722],
  [146, 820],
  [176, 902],
];
const VEILS: { p: P2[]; s0: number; s1: number; n: number; a: number }[] = [
  { p: HOOD_L, s0: 10, s1: 70, n: 22, a: 1 },
  { p: mirror(HOOD_L, 6), s0: 10, s1: 70, n: 22, a: 1 },
  { p: OUTER_L, s0: 14, s1: 95, n: 20, a: 0.75 },
  { p: mirror(OUTER_L, 8), s0: 14, s1: 95, n: 20, a: 0.75 },
  { p: FRAME_L, s0: 4, s1: 22, n: 10, a: 0.9 },
  { p: mirror(FRAME_L, 4), s0: 4, s1: 22, n: 10, a: 0.9 },
  {
    p: [
      [512, 1180],
      [500, 1080],
      [525, 980],
      [510, 880],
      [495, 760],
      [512, 650],
    ],
    s0: 8,
    s1: 60,
    n: 20,
    a: 1,
  },
  {
    p: [
      [505, 1200],
      [530, 1100],
      [490, 1000],
      [540, 900],
      [480, 800],
      [530, 700],
    ],
    s0: 4,
    s1: 26,
    n: 8,
    a: 0.9,
  },
  { p: CURL_L, s0: 12, s1: 46, n: 16, a: 0.85 },
  { p: mirror(CURL_L, 10), s0: 12, s1: 46, n: 16, a: 0.85 },
  { p: FLARE_L, s0: 8, s1: 50, n: 12, a: 0.7 },
  { p: mirror(FLARE_L, 12), s0: 8, s1: 50, n: 12, a: 0.7 },
  { p: SWEEP_L, s0: 10, s1: 40, n: 10, a: 0.55 },
  { p: mirror(SWEEP_L, 9), s0: 10, s1: 40, n: 10, a: 0.55 },
];

/** Haze: the volume of the smoke, very soft (blurred most). */
function paintHaze(g: CanvasRenderingContext2D) {
  blob(g, 512, 480, 250, 330, 0.1, 'r');
  blob(g, 512, 870, 160, 260, 0.07, 'r');
  blob(g, 512, 1200, 60, 170, 0.05, 'r');
  blob(g, 280, 290, 190, 130, 0.06, 'r', -0.4);
  blob(g, 744, 290, 190, 130, 0.06, 'r', 0.4);
  blob(g, 512, 200, 240, 110, 0.05, 'r');
  // the face's soft presence, and the shadow round the holes and in the cheeks
  blob(g, FX, FY + 10, 125, 190, 0.22, 'g');
  for (const sd of [-1, 1]) {
    blob(g, FX + sd * 44, FY - 20, 52, 48, 0.32, 'b');
    blob(g, FX + sd * 64, FY + 82, 24, 46, 0.2, 'b');
  }
  blob(g, FX, FY + 140, 50, 88, 0.3, 'b');
}

/** Soft: broad ribbons of smoke, her face, the holes in it. */
function paintSoft(g: CanvasRenderingContext2D, r: () => number) {
  for (const v of VEILS) ribbon(g, v.p, { n: 5, s0: v.s0 * 0.8, s1: v.s1 * 0.9, width: 14, alpha: 0.045 * v.a, wob: 10 }, 'r', r);
  ribbon(g, THREAD, { n: 1, s0: 0, s1: 0, width: 9, alpha: 0.16, fade: [0.4, 1] }, 'r', r);
  // the face: pale, lit a little from below and in front, palest on the brow and cheekbones
  eggPath(g, 100, 150, 178);
  const face = g.createRadialGradient(FX, FY - 30, 10, FX, FY + 10, 200);
  face.addColorStop(0, ink('g', 0.62));
  face.addColorStop(0.5, ink('g', 0.5));
  face.addColorStop(0.85, ink('g', 0.25));
  face.addColorStop(1, ink('g', 0.05));
  g.fillStyle = face;
  g.fill();
  blob(g, FX, FY - 90, 60, 34, 0.22, 'g');
  blob(g, FX, FY + 8, 12, 42, 0.16, 'g');
  blob(g, FX, FY + 168, 34, 18, 0.12, 'g');
  for (const sd of [-1, 1]) {
    blob(g, FX + sd * 56, FY + 32, 30, 22, 0.18, 'g');
    // the hollow sockets, drooping a little at the outer corners
    blob(g, FX + sd * 44, FY - 12, 27, 35, 0.95, 'b', -sd * 0.22, 0.7);
  }
  blob(g, FX, FY + 62, 11, 24, 0.55, 'b');
  // the mouth: a long dark oval, open in a scream
  blob(g, FX, FY + 138, 30, 62, 1, 'b', 0, 0.72);
  // soft shadow along the streaks
  for (const sd of [-1, 1]) streaks(g, sd, 8, 0.22, r);
}

/** The dark streaks running down from her eyes. */
function streaks(g: CanvasRenderingContext2D, sd: number, width: number, alpha: number, r: () => number) {
  const ex = FX + sd * 44;
  for (const dx of [-8, 7]) {
    ribbon(
      g,
      [
        [ex + dx, FY + 18],
        [ex + dx * 1.2 + 3, FY + 70],
        [ex + dx * 1.1 - 2, FY + 120],
        [ex + dx * 1.3, FY + 168],
      ],
      { n: 1, s0: 0, s1: 0, width, alpha, wob: 3, fade: [1, 0.2] },
      'b',
      r,
    );
  }
}

/** Fine: the filaments, the thread, the smoke grain over her face, the cores of the holes. */
function paintFine(g: CanvasRenderingContext2D, r: () => number) {
  for (const v of VEILS) ribbon(g, v.p, { n: v.n, s0: v.s0, s1: v.s1, width: 1.3, alpha: 0.11 * v.a, wob: 7 }, 'r', r);
  ribbon(g, THREAD, { n: 4, s0: 1.5, s1: 10, width: 1.8, alpha: 0.42, wob: 3, fade: [0.5, 1] }, 'r', r);
  // her face is smoke too: strands follow its outline down each side
  for (const sd of [-1, 1])
    for (let k = 0; k < 7; k++) {
      const pts: P2[] = [];
      for (let i = 0; i <= 8; i++) {
        const p = 0.25 + (i / 8) * 2.35;
        const c = Math.cos(p);
        const narrow = 1 - 0.26 * Math.max(0, -c) ** 1.4;
        const s = 0.74 + 0.05 * k;
        pts.push([FX + sd * 100 * Math.sin(p) * narrow * s, FY - (c > 0 ? 150 : 178) * c * (0.8 + 0.035 * k)]);
      }
      ribbon(g, pts, { n: 1, s0: 0, s1: 0, width: 1.6, alpha: 0.13, wob: 4 }, 'g', r);
      ribbon(g, pts, { n: 1, s0: 0, s1: 0, width: 1.4, alpha: 0.07, wob: 5 }, 'r', r);
    }
  for (const sd of [-1, 1]) {
    blob(g, FX + sd * 44, FY - 10, 15, 21, 0.6, 'b');
    blob(g, FX + sd * 7, FY + 80, 5, 4, 0.5, 'b');
    streaks(g, sd, 3.5, 0.5, r);
  }
  blob(g, FX, FY + 140, 18, 44, 0.7, 'b');
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
  const r = seeded(1225);
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
  layer(paintHaze, 24);
  layer((lg) => paintSoft(lg, r), 7);
  layer((lg) => paintFine(lg, r), 1);
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
  vec2 uv = vUv - uOff * smoothstep(0.2, 0.7, h);
  // rising on, and spreading as it rises
  uv.y -= uRise * 0.12 * (0.3 + h);
  uv.x = 0.5 + (uv.x - 0.5) / (1.0 + uRise * 0.35 * h);
  // the drift and curl: slow noise travelling upward, steady near the wick, freer higher up
  vec3 q = vec3(uv.x * 2.4, uv.y * 3.2 - t * 0.22, t * 0.11 + uSeed);
  vec2 w = vec2(fbm(q), fbm(q + vec3(5.2, 1.3, 2.8))) - 0.5;
  vec3 q2 = vec3(uv.x * 7.0 + w.x * 2.0, uv.y * 8.0 - t * 0.5 + w.y * 2.0, t * 0.2 + uSeed * 1.7);
  vec2 w2 = vec2(n3(q2), n3(q2 + vec3(3.1, 7.4, 1.9))) - 0.5;
  float amp = 0.004 + 0.05 * smoothstep(0.04, 0.55, h);
  vec2 su = uv + w * amp * 1.4 + w2 * amp * 0.45;
  // her face drifts with it, less, so it holds together
  vec2 fu = uv + w * amp * 0.35;
  vec4 s = texture2D(uMap, su) * inside(su);
  vec4 f = texture2D(uMap, fu) * inside(fu);
  float edge = smoothstep(1.0, 0.92, vUv.y) * smoothstep(0.0, 0.05, vUv.x) * smoothstep(1.0, 0.95, vUv.x);
  float nz = fbm(vec3(vUv * vec2(5.0, 4.0), uSeed + 9.0));
  // revealed from the bottom up as the smoke climbs, its front ragged
  float shown = smoothstep(uFront + 0.02, uFront - 0.14, h + (nz - 0.5) * 0.14);
  shown *= mix(1.0, smoothstep(0.3, 0.16, h), uThread);
  // coming apart: holes open in it and spread
  float b = fbm(vec3(su * vec2(4.0, 5.0), t * 0.25 + 3.0));
  float keep = 1.0 - smoothstep(b - 0.12, b + 0.12, uBreak * 1.2 - 0.05);
  float d = s.r;
  // brighter and denser than a real wisp, so the veils read against the dark as in the reference
  float sa = min(1.0, smoothstep(0.0, 0.4, d) * 1.3) * shown * keep * edge * uAlpha;
  vec3 sc = mix(vec3(0.5, 0.52, 0.55), vec3(0.93, 0.93, 0.92), smoothstep(0.05, 0.6, d));
  sc *= 0.82 + 0.3 * (1.0 - h);
  sc += uEmber * vec3(0.4, 0.16, 0.04) * pow(max(0.0, 1.0 - h * 3.0), 3.0);
  // her face condenses in patches rather than fading in evenly
  float fm = uFace * uFaceMul * keep * edge * uAlpha;
  float cond = smoothstep(nz - 0.25, nz + 0.25, uFace * 1.4 - 0.2);
  float af = clamp(f.g * 1.15, 0.0, 1.0) * fm * cond * 0.9;
  float ah = clamp(f.b * 1.1, 0.0, 1.0) * fm * cond * 0.9;
  vec3 col = sc * sa;
  float a = sa;
  col = vec3(0.92, 0.91, 0.88) * af + col * (1.0 - af);
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
  // the thread climbs (0.3-1.6 s), then blooms up into the veils (1.4-3.4 s)
  const front = Math.max(0.32 * smooth((t - 0.3) / 1.3), t > 1.4 ? 0.32 + 0.85 * smooth((t - 1.4) / 2.0) : 0);
  // then it rises on and comes apart (5.6-7.2 s)
  const rise = progress(t, 1.6, 5.6);
  const alpha = 1 - progress(t, 1.0, 6.2);
  const ember = emberAt(t);
  const off: [number, number] = [Math.sin(t * 0.7) * 0.006, Math.sin(t * 0.53 + 1) * 0.005];
  // her face comes up in it (2.6-4.0 s)
  setSmoke(p.front, { time: t, front, face: progress(t, 1.4, 2.6), rise, brk: rise, alpha, ember, off });
  setSmoke(p.back, { time: t + 11, front: front - 0.05, face: 0, rise: rise * 1.1, brk: rise, alpha: alpha * 0.5, ember, off });
  // a last thin wisp from the ember as it dies (7.0-8.0 s)
  const wisp = t > 7.0 ? 1 - progress(t, 0.6, 7.4) : 0;
  setSmoke(p.wisp, { time: t + 3, front: 0.3 * smooth((t - 7.0) / 0.5), face: 0, rise: 0, brk: 0, alpha: wisp * 0.8, ember, off: [0, 0] });
}

/**
 * The smoke from the blown-out wick: a thin thread curling up, blooming into veils, and in them
 * her face, the eyes and the screaming mouth holes in the smoke. It hangs a moment and drifts,
 * then rises on and comes apart. A picture that always turns to face you, its foot on the ember.
 */
function SmokeGhost({ since, scale }: { since: () => number; scale: number }) {
  const root = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const p = ghostParts();
  useFrame(() => driveSmoke(root.current, since(), camera));
  return (
    <group ref={root} position={OLD_TIP} scale={scale} visible={false} userData={{ extra: true }}>
      <mesh geometry={p.geo} material={p.mats.back} position-z={-0.03} scale={1.06} renderOrder={6} />
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
 * the mains fail. Taken, it goes out and its smoke rises into her. On the shelf the light it
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
      {taken && <SmokeGhost since={since} scale={onShelf ? 0.42 : 1} />}
      {taken && onShelf && (
        // a dark veil all round the card's camera (seen from inside), over everything in it but the smoke
        <mesh renderOrder={5} userData={{ extra: true }}>
          <sphereGeometry args={[6, 24, 16]} />
          <meshBasicMaterial color="#020306" transparent opacity={0.6} depthWrite={false} depthTest={false} side={THREE.BackSide} />
        </mesh>
      )}
      {/* not drawn: the space above the wick the smoke rises into, so the product view frames it */}
      <mesh position={[0, OLD_TIP[1] + SMOKE_H / 2, 0]}>
        <boxGeometry args={[SMOKE_W + 0.05, SMOKE_H + 0.05, 0.6]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
}
