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
 * The candle for the window, in a brass chamberstick: a round drip pan with a rolled rim on a
 * short stepped foot, a socket in its middle and a ring handle at its side. By day a new cream
 * pillar candle, tall and slim, a crisp rim and a few small drips, burning with a tall flame,
 * and a sprig of holly in the pan. After the Reveal it is the same candle burnt for eighty hours
 * of waiting: the rim thick and slumped, long drips all down its upper half, one fat drip hanging
 * over the socket's lip; the brass worn, tarnished in its corners. It is still lit.
 *
 * Taken, it goes out, and the rest is one movement: the flame shrinks into the wick (0-0.3 s),
 * the wick glows, and a thin thread of smoke rises from it at once, curling in an S (from 0.1 s).
 * Where the smoke reaches the top it is a face: long and skull-like, hollow eyes, an open scream.
 * It forms as the smoke arrives (0.85-1.5 s), rises on with the smoke, drifting, holding its
 * shape (1.5-3.3 s), then stretches upward and comes apart (3.3-5.0 s) while the thread lets go
 * of the wick and follows it up (3.0-4.9 s). A last wisp leaves the ember (4.4-5.8 s) and the
 * ember goes dark (by 5.8 s). Over at 6 s. The room stays dark round it afterwards.
 *
 * All in the candle's own space: the table at y = -0.62, +z toward you.
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
const TAKE = { out: 0.3, end: 6.0 };

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
  g.scale(1, 1.18, 0.9);
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

/** Seeded 3D value noise, 0..1 (for the tarnish on the old brass). */
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
/* The chamberstick                                                                           */
/* ------------------------------------------------------------------------------------------ */

/** The pan's floor, the floor of the socket (where the candle stands) and the socket's rim. */
const PAN_FLOOR = -0.536;
const CUP_FLOOR = -0.528;
const CUP_TOP = -0.45;

/**
 * The chamberstick in one turned profile: a stepped foot flaring up to a neck, the shallow pan
 * out to its rolled rim and back down to its floor, then the socket: up its outside, over its
 * beaded lip and down inside it.
 */
const HOLDER: Prof = [
  // the foot, hollow underneath, two steps up to the neck
  [0, -0.611],
  [0.128, -0.611],
  [0.144, -0.6195],
  [0.157, -0.62],
  [0.1615, -0.6172],
  [0.1625, -0.6115],
  [0.1595, -0.6065],
  [0.15, -0.6035],
  [0.14, -0.6022],
  [0.1365, -0.5985],
  [0.1352, -0.5925],
  [0.1305, -0.5885],
  [0.118, -0.5862],
  [0.1, -0.5805],
  [0.086, -0.5725],
  [0.0765, -0.5625],
  [0.0715, -0.5535],
  [0.0725, -0.5492],
  // the pan's underside out to the rim
  [0.09, -0.5462],
  [0.15, -0.5432],
  [0.22, -0.5372],
  [0.258, -0.5312],
  [0.278, -0.5242],
  [0.2872, -0.5162],
  // the rolled rim
  [0.2905, -0.5125],
  [0.2918, -0.508],
  [0.2905, -0.5035],
  [0.287, -0.5013],
  [0.282, -0.5012],
  [0.2775, -0.5035],
  [0.2755, -0.508],
  // the pan's inside down to its floor
  [0.272, -0.515],
  [0.262, -0.5242],
  [0.245, -0.5312],
  [0.22, -0.5348],
  [0.17, -0.536],
  [0.135, PAN_FLOOR],
  [0.126, -0.5348],
  [0.1212, -0.5312],
  // the socket: its outside, its beaded lip, its inside
  [0.1192, -0.52],
  [0.118, -0.49],
  [0.118, -0.462],
  [0.1225, -0.4595],
  [0.1245, -0.455],
  [0.122, -0.4505],
  [0.117, -0.4498],
  [0.1128, -0.4525],
  [0.112, -0.46],
  [0.112, -0.5235],
  [0.105, CUP_FLOOR],
  [0, CUP_FLOOR],
];

/** The ring handle on the right of the pan: a loop about as tall as the socket, on the rim. */
const HANDLE = { x: 0.3305, y: -0.503, R: 0.0405, tube: 0.0062 };

/**
 * The old brass: warm and polished where hands have worn it (the rims, the top of the ring),
 * browner in blotches, dark tarnish gathered in the recesses: round the socket's foot, in the
 * corner of the pan, inside the socket, in the foot's steps and on every underside.
 */
function tarnish(g: THREE.BufferGeometry) {
  const p = g.attributes.position as THREE.BufferAttribute;
  const n = g.attributes.normal as THREE.BufferAttribute;
  const col = new Float32Array(p.count * 3);
  const brass = new THREE.Color(0.3, 0.205, 0.09);
  const brown = new THREE.Color(0.17, 0.11, 0.05);
  const dark = new THREE.Color(0.04, 0.03, 0.02);
  const bright = new THREE.Color(0.62, 0.46, 0.22);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const r = Math.hypot(x, z);
    const n1 = vnoise(x * 18 + 3, y * 18, z * 18);
    const n2 = vnoise(x * 64, y * 64 + 9, z * 64);
    c.copy(brass).lerp(brown, smooth((n1 - 0.42) / 0.3) * 0.65);
    let rec = 0;
    if (y < -0.524 && r < 0.29) rec = Math.max(smooth(1 - (r - 0.119) / 0.035), smooth((r - 0.235) / 0.04) * 0.8);
    if (y > -0.53 && r < 0.1132) rec = Math.max(rec, 0.85);
    if (y < -0.545 && y > -0.605 && r < 0.14) rec = Math.max(rec, smooth(1 - (r - 0.072) / 0.05) * 0.75);
    if (y < -0.598 && r > 0.13 && r < 0.142) rec = Math.max(rec, 0.6);
    rec = Math.max(rec, smooth((-n.getY(i) - 0.2) / 0.6) * 0.55);
    c.lerp(dark, rec * (0.65 + 0.35 * n2));
    const rimWorn = r > 0.275 && r < 0.3 && y > -0.512;
    const lipWorn = r > 0.112 && r < 0.126 && y > -0.458;
    const ringWorn = r > 0.3 && y > HANDLE.y + 0.01;
    if (rimWorn || lipWorn || ringWorn) c.lerp(bright, 0.45 + 0.35 * n2);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

function buildHolder(): THREE.BufferGeometry {
  const pan = revolve(() => HOLDER, 128);
  const loop = new THREE.TorusGeometry(HANDLE.R, HANDLE.tube, 14, 64);
  loop.translate(HANDLE.x, HANDLE.y, 0);
  // the knuckle where the ring is soldered to the rim
  const joint = new THREE.SphereGeometry(0.0095, 14, 10);
  joint.scale(1.1, 0.85, 1.35);
  joint.translate(0.2915, -0.5065, 0);
  const g = merge([pan, loop, joint]);
  tarnish(g);
  return g;
}

/* ------------------------------------------------------------------------------------------ */
/* The candles                                                                                */
/* ------------------------------------------------------------------------------------------ */

/** The new candle: its radius and the height of its rim (about 2.6 times as tall as wide above the socket). */
const NEW_R = 0.1;
const NEW_TOP = 0.075;
/** The old candle: radius, the mean height of its rim, the floor of the crater round the wick. */
const OLD_R = 0.1;
const OLD_TOP = 0.045;
const FLOOR = 0.004;
/** Where the fat drip runs down over the socket's lip: the front, a little to the right. */
const FAT = 0.16;
/** Where the rim slumped lowest: front left. */
const SLUMP = -0.7;
const slump = (th: number) => Math.exp(-(angDiff(th, SLUMP) ** 2) / (2 * 0.55 * 0.55));
const ringA = ring(11);
const ringB = ring(23, 5);
const ringC = ring(37, 7);

/** The old candle's lip: how thick it is, and the height its round top reaches. */
const lipL = (th: number) => 0.0118 + 0.0035 * slump(th) + 0.0025 * ringB(th) + 0.001 * Math.sin(th * 9 + 1.3);
const rimTop = (th: number) => OLD_TOP + 0.01 * ringA(th) - 0.024 * slump(th) + 0.0025 * Math.sin(th * 7 + 0.4);
/** The height where the side turns over into the lip. */
const lipY = (th: number) => rimTop(th) - 1.15 * lipL(th);
/** The old candle's side: slightly uneven, bulging a little where the wax ran over the rim. */
function oldR(th: number, y: number): number {
  const hs = lipY(th);
  return OLD_R + 0.0022 * ringC(th) + 0.0012 * Math.sin(y * 47 + th * 2) + 0.004 * slump(th) * smooth((y - (hs - 0.12)) / 0.12);
}

/** The new candle: a crisp, slightly rounded rim and a shallow dish of wax round the wick. */
const NEW_PROFILE: Prof = [
  [0, CUP_FLOOR],
  [0.08, CUP_FLOOR],
  [0.097, CUP_FLOOR + 0.002],
  [NEW_R, CUP_FLOOR + 0.008],
  ...Array.from({ length: 12 }, (_, k): [number, number] => [NEW_R, CUP_FLOOR + 0.02 + (k / 11) * (NEW_TOP - 0.008 - CUP_FLOOR - 0.02)]),
  [0.0998, NEW_TOP - 0.004],
  [0.0986, NEW_TOP - 0.001],
  [0.0962, NEW_TOP],
  [0.091, NEW_TOP - 0.0015],
  [0.062, NEW_TOP - 0.006],
  [0.032, NEW_TOP - 0.0092],
  [0.011, NEW_TOP - 0.0106],
  [0, NEW_TOP - 0.011],
];

/** The old candle's profile at an angle: foot, side, the thick round lip, the crater. */
function oldProfile(th: number): Prof {
  const out: Prof = [
    [0, CUP_FLOOR],
    [0.06, CUP_FLOOR],
    [OLD_R - 0.003, CUP_FLOOR],
    [OLD_R, CUP_FLOOR + 0.004],
  ];
  const hs = lipY(th);
  const L = lipL(th);
  for (let k = 0; k < 26; k++) {
    const y = CUP_FLOOR + 0.012 + (k / 25) * (hs - 0.006 - CUP_FLOOR - 0.012);
    out.push([oldR(th, y), y]);
  }
  // the lip: thick and round, a little proud of the side; where it slumped low its inside still
  // stands above the floor of the crater
  const cx = oldR(th, hs) + 0.005 - L;
  const top = hs + 1.15 * L;
  const hsIn = Math.max(hs, Math.min(top - 0.004, FLOOR + 0.006));
  for (let k = 0; k <= 10; k++) {
    const a = (k / 10) * Math.PI;
    const base = a <= Math.PI / 2 ? hs : hsIn;
    out.push([cx + L * Math.cos(a), base + (top - base) * Math.sin(a)]);
  }
  // the crater: down from the inside of the lip to the floor round the wick
  const rIn = cx - L;
  for (let k = 1; k <= 10; k++) {
    const f = 1 - k / 10;
    out.push([rIn * f, FLOOR + Math.max(0.002, hsIn - FLOOR) * f ** 2.2]);
  }
  return out;
}

/** Wax that ran down into the socket, filling the gap round the candle to just under its lip. */
const CUP_POOL: Prof = [
  [OLD_R - 0.002, -0.43],
  [OLD_R + 0.0015, -0.4415],
  [OLD_R + 0.005, -0.4492],
  [0.107, -0.4512],
  [0.1112, -0.4518],
  [0.1124, -0.4545],
  [0.1108, -0.4615],
];

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
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const y = d.y0 + 0.004 - (d.y0 + 0.004 - d.y1) * f;
    const th = d.th + 0.05 * Math.sin(f * 4.5 + d.th * 3) * f;
    const rr = radius(th, Math.min(y, capY)) + d.r * (i === 0 ? -0.3 : 0.32);
    pts.push(new THREE.Vector3(rr * Math.sin(th), y, rr * Math.cos(th)));
  }
  const end = pts[n]!.clone();
  const out = new THREE.Vector3(Math.sin(d.th), 0, Math.cos(d.th));
  return [
    tube(
      pts,
      32,
      12,
      (t) => {
        const w = d.r * (0.66 + 0.55 * (1 - t) ** 3 + 0.1 * Math.sin(t * 9 + d.th));
        return [w * 0.72, w];
      },
      undefined,
      0.3,
    ),
    bulb(end.addScaledVector(out, d.r * 0.12).setY(end.y - d.r * 0.25), d.r * 1.28),
  ];
}

/**
 * The old candle's drips: its whole upper half thickly covered in them, long and short side by
 * side and overlapping, short fat runs right under the lip, and a few that ran all the way down
 * to the socket.
 */
function oldDrips(): Drip[] {
  const r = seeded(808);
  const out: Drip[] = [];
  for (const th of [-1.4, 0.98, 2.2, -2.5, -0.42]) out.push({ th, y0: lipY(th), y1: CUP_TOP + 0.026 + r() * 0.012, r: 0.0105 + r() * 0.003 });
  const n = 34;
  for (let k = 0; k < n; k++) {
    const th = (k / n) * TAU + (r() - 0.5) * 0.16;
    if (Math.abs(angDiff(th, FAT)) < 0.14) continue;
    const y0 = lipY(th);
    const len = k % 3 === 0 ? 0.2 + r() * 0.12 : k % 3 === 1 ? 0.11 + r() * 0.09 : 0.05 + r() * 0.06;
    out.push({ th, y0, y1: y0 - len, r: 0.0072 + r() * 0.005 });
  }
  // short fat runs under the lip, so the top of the candle is lumpy all round
  for (let k = 0; k < 16; k++) {
    const th = ((k + 0.5) / 16) * TAU + (r() - 0.5) * 0.2;
    const y0 = lipY(th);
    out.push({ th, y0, y1: y0 - 0.022 - r() * 0.03, r: 0.011 + r() * 0.005 });
  }
  return out;
}

/** Where a drip is round the candle a share `f` of the way down it (it wanders a little). */
const dripTh = (d: Drip, f: number) => d.th + 0.05 * Math.sin(f * 4.5 + d.th * 3) * f;
/** Half a drip's width a share `t` of the way down: wide where it leaves the lip, thin, then the bulb. */
const dripW = (d: Drip, t: number) => d.r * (0.6 + 0.75 * (1 - t) ** 3 + 0.1 * Math.sin(t * 9 + d.th * 5));
/** The bulb at a drip's end: its middle and its radii (round, down, out). */
function dripBulb(d: Drip): { th: number; y: number; r: number; rx: number; ry: number; rz: number } {
  const th = dripTh(d, 1);
  return { th, y: d.y1 - d.r * 0.35, r: oldR(th, d.y1) + d.r * 0.42, rx: d.r * 1.28, ry: d.r * 1.55, rz: d.r * 0.95 };
}

/**
 * An old drip: a tongue of wax down the side, flat against it and standing well proud of it,
 * ending in a heavy bulb.
 */
function oldDripGeo(d: Drip): THREE.BufferGeometry[] {
  const pts: THREE.Vector3[] = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const y = d.y0 + 0.004 - (d.y0 + 0.004 - d.y1) * f;
    const th = dripTh(d, f);
    const w = dripW(d, f);
    const rr = oldR(th, y) + (i === 0 ? -0.35 * w : 0.24 * w);
    pts.push(new THREE.Vector3(rr * Math.sin(th), y, rr * Math.cos(th)));
  }
  const side = new THREE.Vector3(Math.cos(d.th), 0, -Math.sin(d.th));
  const b = dripBulb(d);
  const ball = new THREE.SphereGeometry(1, 16, 12);
  ball.scale(b.rx, b.ry, b.rz);
  ball.translate(0, 0, b.r);
  ball.rotateY(b.th);
  ball.translate(0, b.y, 0);
  return [
    tube(
      pts,
      36,
      14,
      (t) => {
        const w = dripW(d, t);
        return [w * 0.66, w];
      },
      side,
      0.3,
    ),
    ball,
  ];
}

/**
 * Shadow in the creases of the old wax, in its vertex colours: along the edges of every drip
 * where it lies on the side, under the bulbs and under the overhanging lip. This is what lets
 * the drips read from the front, where their relief is not in the outline.
 */
function shadeBody(g: THREE.BufferGeometry, drips: Drip[]) {
  const p = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const r = Math.hypot(x, z);
    const th = Math.atan2(x, z);
    let k = 0;
    const ly = lipY(th);
    if (r > OLD_R * 0.8 && y < ly + 0.002) {
      k = 0.3 * smooth(1 - (ly - y) / 0.016);
      for (const d of drips) {
        if (y > d.y0 + 0.004 || y < d.y1 - d.r * 2.6) continue;
        const f = clamp01((d.y0 + 0.004 - y) / (d.y0 + 0.004 - d.y1));
        let e: number;
        if (y >= d.y1) e = Math.abs(angDiff(th, dripTh(d, f))) * r - dripW(d, f);
        else {
          const b = dripBulb(d);
          e = Math.hypot((angDiff(th, b.th) * r) / b.rx, (y - b.y) / b.ry) * b.rx - b.rx;
        }
        k = Math.max(k, 0.42 * smooth(1 - Math.abs(e) / 0.008));
      }
    }
    const c = 1 - k;
    col.set([c, c * 0.97, c * 0.92], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

/** A drip or bulb darkens where it meets the side, and is palest where it stands out furthest. */
function shadeDrip(g: THREE.BufferGeometry) {
  const p = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const out = Math.hypot(x, z) - oldR(Math.atan2(x, z), y);
    const c = 1.04 - 0.3 * smooth(1 - out / 0.007);
    col.set([c, c * 0.975, c * 0.935], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

/** A plain vertex colour (for the wax in the socket). */
function shadeFlat(g: THREE.BufferGeometry, c: number) {
  const n = (g.attributes.position as THREE.BufferAttribute).count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c, c * 0.97, c * 0.92], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

/**
 * The fat drip at the front: a thick run of wax from the lip all the way down the side, out over
 * the socket's beaded lip and hanging off it in a heavy drop.
 */
function fatDrip(): THREE.BufferGeometry[] {
  const th = FAT;
  const y0 = lipY(th);
  const path: [number, number][] = [];
  for (let k = 0; k <= 9; k++) {
    const y = y0 + 0.004 - (k / 9) * (y0 + 0.004 + 0.418);
    path.push([oldR(th, y) + (k === 0 ? -0.004 : 0.0045), y]);
  }
  path.push([0.1085, -0.4345], [0.1165, -0.4395], [0.1235, -0.441], [0.1305, -0.4445], [0.1342, -0.4525], [0.1352, -0.4635], [0.1348, -0.4765]);
  const s = Math.sin(th);
  const c = Math.cos(th);
  const pts = path.map(([pr, y]) => new THREE.Vector3(pr * s, y, pr * c));
  const side = new THREE.Vector3(c, 0, -s);
  const end = pts[pts.length - 1]!;
  const drop = new THREE.SphereGeometry(1, 16, 12);
  drop.scale(0.0125, 0.0155, 0.0105);
  drop.translate(end.x + s * 0.0012, end.y - 0.0105, end.z + c * 0.0012);
  return [
    tube(pts, 72, 16, (t) => [0.0078 + 0.0014 * t, 0.017 * (1 - t) ** 1.4 + 0.0118 + 0.0016 * Math.sin(t * 11)], side, 0.35),
    drop,
  ];
}

function buildNew() {
  const drips: Drip[] = [
    { th: -0.5, y0: NEW_TOP - 0.006, y1: NEW_TOP - 0.05, r: 0.0045 },
    { th: 0.72, y0: NEW_TOP - 0.006, y1: NEW_TOP - 0.03, r: 0.004 },
    { th: 2.5, y0: NEW_TOP - 0.006, y1: NEW_TOP - 0.07, r: 0.0045 },
  ];
  const wax = merge([revolve(() => NEW_PROFILE, 128), ...drips.flatMap((d) => dripGeo(d, () => NEW_R, NEW_TOP))]);
  const wickPts = [
    [0, NEW_TOP - 0.014, 0],
    [0, NEW_TOP + 0.004, 0],
    [0.0006, NEW_TOP + 0.019, 0],
    [0.0035, NEW_TOP + 0.031, 0.001],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  return {
    wax,
    // white cotton below, burnt black at the tip
    wick: tube(wickPts.slice(0, 3), 8, 8, () => [0.0032, 0.0032]),
    wickTip: tube(wickPts.slice(1), 8, 8, (t) => [0.0033 - 0.0008 * t, 0.0033 - 0.0008 * t]),
  };
}

function buildOld() {
  const drips = oldDrips();
  const body = revolve(oldProfile, 200);
  shadeBody(body, drips);
  const pool = revolve(() => CUP_POOL, 128);
  shadeFlat(pool, 0.9);
  const runs = [...drips.flatMap((d) => oldDripGeo(d)), ...fatDrip()];
  runs.forEach(shadeDrip);
  const wax = merge([body, pool, ...runs]);
  const wick = tube(
    [
      [0, FLOOR - 0.004, 0],
      [0.001, FLOOR + 0.025, 0],
      [0.003, FLOOR + 0.048, 0.001],
      [0.008, FLOOR + 0.063, 0.003],
      [OLD_TIP[0], OLD_TIP[1], OLD_TIP[2]],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    16,
    8,
    (t) => [0.0036 - 0.0011 * t, 0.0036 - 0.0011 * t],
  );
  return { wax, wick };
}

/** The tip of the old wick (the ember, where the smoke comes from), and the roots of the flames. */
const OLD_TIP: V3 = [0.014, FLOOR + 0.072, 0.005];
const NEW_FLAME: V3 = [0.001, NEW_TOP + 0.008, 0];
const OLD_FLAME: V3 = [0.004, FLOOR + 0.036, 0.001];

let newGeo: ReturnType<typeof buildNew> | null = null;
let oldGeo: ReturnType<typeof buildOld> | null = null;
let holderGeo: THREE.BufferGeometry | null = null;
const newParts = () => (newGeo ??= buildNew());
const oldParts = () => (oldGeo ??= buildOld());
const holder = () => (holderGeo ??= buildHolder());

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

/** Old ivory wax, mottled and a little yellowed, a few specks of grime, soot in the crater. */
function paintWax(g: CanvasRenderingContext2D, w: number, h: number) {
  const r = seeded(31);
  g.fillStyle = '#ebdcbd';
  g.fillRect(0, 0, w, h);
  const dot = (x: number, y: number, rad: number, c: string) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, c);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  };
  // older, yellower wax in blotches, and paler fresh runs
  for (let i = 0; i < 150; i++) dot(r() * w, r() * h, 8 + r() * 40, `rgba(196,168,116,${0.04 + r() * 0.08})`);
  for (let i = 0; i < 90; i++) dot(r() * w, r() * h, 6 + r() * 26, `rgba(255,250,238,${0.08 + r() * 0.12})`);
  // runs down the side
  g.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const x = r() * w;
    const y = h * (0.3 + r() * 0.45);
    g.strokeStyle = `rgba(180,154,108,${0.04 + r() * 0.06})`;
    g.lineWidth = 1 + r() * 3;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 6, y + 20 + r() * 70);
    g.stroke();
  }
  // soot and old dark wax in the crater, the top of the texture
  const soot = g.createLinearGradient(0, 0, 0, h * 0.2);
  soot.addColorStop(0, 'rgba(92,74,52,0.5)');
  soot.addColorStop(0.7, 'rgba(120,98,66,0.2)');
  soot.addColorStop(1, 'rgba(120,98,66,0)');
  g.fillStyle = soot;
  g.fillRect(0, 0, w, h * 0.2);
  // a little grime: fine dark specks, more of them low down
  for (let i = 0; i < 110; i++) {
    const y = h * (0.2 + Math.sqrt(r()) * 0.8);
    g.fillStyle = `rgba(60,46,32,${0.25 + r() * 0.4})`;
    g.beginPath();
    g.arc(r() * w, y, 0.5 + r() * 1.2, 0, TAU);
    g.fill();
  }
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
    vertexColors: true,
    roughness: 0.4,
    sheen: 0.25,
    sheenColor: new THREE.Color('#fff0d4'),
    sheenRoughness: 0.5,
    clearcoat: 0.45,
    clearcoatRoughness: 0.3,
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
        float wTop = smoothstep(uTop - 0.26, uTop + 0.01, vWaxP.y);
        float wEdge = 1.0 - abs(dot(normal, normalize(vViewPosition)));
        totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.66, 0.36) * (0.025 + 0.03 * wTop + uGlow * wTop * wTop * (0.25 + 0.55 * wEdge));`,
      );
  };
  m.customProgramCacheKey = () => 'candle-old-wax';
  oldWaxMat = m;
  return m;
}

let brassOldMat: THREE.MeshStandardMaterial | null = null;
/** The old brass: its colours (worn bright, browned, tarnished dark) are in the vertices. */
const brassOld = () =>
  (brassOldMat ??= new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, metalness: 0.9, roughness: 0.5 }));

/** The day brass: the shop's brass, warmer and more polished, as a chamberstick kept for best. */
const brassDay = () =>
  mat('candleBrassDay', {
    surface: 'metal',
    color: '#e0ad4c',
    metalness: 1,
    roughness: 0.19,
    clearcoat: 0.35,
    hauntedColor: '#6e5a33',
    decay: { age: 0.7, dust: 0.4 },
  });

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

/** The flame's picture, and where its root (at the wick) sits in it. */
const FLAME_W = 0.1;
const FLAME_H = 0.3;
const FLAME_ROOT = 0.08;

/**
 * A tall candle flame, a long teardrop about 0.45 of the candle's height: blue at its root, a
 * dark heart round the wick (so the black wick shows in its foot), a white-gold core, orange at
 * the edges, swaying more toward its tip. Drawn additively.
 */
const FLAME_FRAG = /* glsl */ `
uniform float uSway;
uniform float uBright;
varying vec2 vUv;
void main() {
  vec2 p = vUv - vec2(0.5, ${FLAME_ROOT.toFixed(3)});
  float h = p.y / ${(1 - FLAME_ROOT - 0.06).toFixed(3)};
  p.x -= uSway * max(h, 0.0) * max(h, 0.0) * 0.06;
  // a round foot, widest a fifth of the way up, drawn out into a long point
  float fy = (0.2 - h) / 0.26;
  float foot = sqrt(clamp(1.0 - fy * fy, 0.0, 1.0));
  float top = pow(clamp((1.0 - h) / 0.8, 0.0, 1.0), 1.2);
  float w = 0.27 * (h < 0.2 ? foot : top);
  float d = abs(p.x) / max(w, 1e-3);
  float body = smoothstep(1.0, 0.45, d) * step(-0.06, h) * smoothstep(1.0, 0.86, h);
  float hollow = smoothstep(0.6, 0.0, d) * smoothstep(0.17, 0.03, h);
  float core = smoothstep(0.78, 0.0, d) * smoothstep(0.1, 0.24, h) * smoothstep(0.88, 0.38, h);
  float blue = smoothstep(0.16, -0.04, h);
  vec3 col = mix(vec3(1.0, 0.44, 0.1), vec3(1.0, 0.78, 0.38), smoothstep(1.0, 0.35, d));
  col = mix(col, vec3(1.0, 0.97, 0.88), core);
  col = mix(col, vec3(0.28, 0.42, 1.0), blue * 0.8);
  float a = body * (1.0 - 0.6 * blue) * (1.0 - 0.85 * hollow) * uBright;
  gl_FragColor = vec4(col, min(1.0, a * (0.85 + 0.45 * core)));
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
  const flameGeo = new THREE.PlaneGeometry(FLAME_W, FLAME_H);
  flameGeo.translate(0, FLAME_H / 2 - FLAME_ROOT * FLAME_H, 0);
  const flameU = { uSway: { value: 0 }, uBright: { value: 1 } };
  const haloU = { uColor: { value: new THREE.Color('#ffae55') }, uBright: { value: 1 } };
  const emberU = { uColor: { value: new THREE.Color('#ff6420') }, uBright: { value: 0 } };
  const halo = new THREE.PlaneGeometry(0.42, 0.56);
  halo.translate(0, 0.11, 0);
  return {
    flameGeo,
    flameU,
    flameMat: additive(FLAME_FRAG, flameU),
    haloGeo: halo,
    haloU,
    haloMat: additive(GLOW_FRAG, haloU),
    emberHaloGeo: new THREE.PlaneGeometry(0.07, 0.07),
    emberU,
    emberHaloMat: additive(GLOW_FRAG, emberU),
    emberMat: new THREE.MeshBasicMaterial({ color: '#ff6a24', transparent: true, opacity: 0, toneMapped: false }),
  };
}
let lightParts: ReturnType<typeof buildLights> | null = null;
const lights = () => (lightParts ??= buildLights());

/** How bright the ember on the wick is, s after the Take: it glows at once, dims, goes dark by 5.8 s. */
function emberAt(s: number): number {
  if (s < 0 || s === Infinity) return 0;
  const on = smooth((s - 0.05) / 0.22);
  const dim = 1 - 0.35 * smooth((s - 0.8) / 3.5);
  const off = 1 - smooth((s - 4.6) / 1.2);
  return on * dim * off * (0.9 + 0.1 * Math.sin(s * 2.3));
}

/* ------------------------------------------------------------------------------------------ */
/* The darkness                                                                               */
/* ------------------------------------------------------------------------------------------ */

/**
 * The dark after the candle goes out: one quad over the whole picture (drawn in screen space,
 * so it covers the card or the product view whatever the camera does), over the candle and the
 * room but under the ember and the smoke, which are drawn after it.
 */
const VEIL_VERT = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;
const VEIL_FRAG = /* glsl */ `
uniform float uAlpha;
void main() {
  gl_FragColor = vec4(0.008, 0.012, 0.024, uAlpha);
}
`;
/** How dark the room goes. */
const VEIL_DARK = 0.62;

function buildVeil() {
  const u = { uAlpha: { value: 0 } };
  const m = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: VEIL_VERT,
    fragmentShader: VEIL_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  return { geo: new THREE.PlaneGeometry(2, 2), u, mat: m };
}
let veilParts: ReturnType<typeof buildVeil> | null = null;
const veil = () => (veilParts ??= buildVeil());

/* ------------------------------------------------------------------------------------------ */
/* The smoke ghost                                                                            */
/* ------------------------------------------------------------------------------------------ */

/*
 * The smoke is painted once into a 448x916 texture (the shape of its picture), one channel per
 * part: red is the thread and the column it widens into (it stays on the wick), green the smoke
 * that is the head, with the wisps flowing round and above it (it rises), blue the dark of its
 * eyes, nose and mouth. The shader reveals, moves, sways and breaks them up.
 */
const GW = 396;
const GH = 540;
/** Texture pixels per unit of the candle's space (about twice the screen's, so it stays crisp). */
const PX = 635;
const SMOKE_W = GW / PX;
const SMOKE_H = GH / PX;
/**
 * The head: its middle above the wick, its half-width and half-height (all in the candle's
 * units). The face is about two thirds as wide as the candle is tall, and long.
 */
const HEAD_AT = 0.36;
const HEAD_RX = 0.145;
const HEAD_RY = 0.22;
/** The chin, as a share of the picture's height. */
const CHIN_V = (HEAD_AT - HEAD_RY) / SMOKE_H;

type Ch = 'r' | 'g' | 'b';
const ink = (ch: Ch, a: number) =>
  `rgba(${ch === 'r' ? 255 : 0},${ch === 'g' ? 255 : 0},${ch === 'b' ? 255 : 0},${clamp01(a).toFixed(4)})`;

/** The middle of the column at height v (0 at the wick, 1 at the top), in pixels: a gentle S up to the chin. */
function colX(v: number): number {
  return GW / 2 + GW * 0.055 * Math.min(1.2, v / CHIN_V) * Math.sin((v / CHIN_V) * TAU);
}

/** Half the column's width at height v: a hair at the wick, widening into soft smoke under the chin. */
function colHW(v: number): number {
  return 2.2 + GW * 0.1 * Math.min(1.3, v / CHIN_V) ** 1.5;
}

/** The head's middle and size in pixels; `hp` turns head units (x across, y down) into pixels. */
const HX = colX(CHIN_V) + 3;
const HY = GH * (1 - HEAD_AT / SMOKE_H);
const HRX = HEAD_RX * PX;
const HRY = HEAD_RY * PX;
const hp = (u: number, w: number): [number, number] => [HX + u * HRX, HY + w * HRY];

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

/** An outline of an ellipse (smoke gathered round a hole). */
function ellipseLine(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot: number, width: number, a: number, ch: Ch) {
  g.save();
  g.strokeStyle = ink(ch, a);
  g.lineWidth = width;
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, TAU);
  g.stroke();
  g.restore();
}

/**
 * Strokes a smooth curve through `pts`, a short segment at a time so it can thicken, thin and
 * fade along its length (width and alpha as functions of 0..1 along it).
 */
function band(g: CanvasRenderingContext2D, pts: [number, number][], width: (t: number) => number, alpha: (t: number) => number, ch: Ch, n = 140) {
  const curve = new THREE.SplineCurve(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  g.save();
  // butt ends, so the added segments do not pile up into beads where they meet
  g.lineCap = 'butt';
  let prev = curve.getPoint(0);
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const p = curve.getPoint(t);
    const a = alpha(t);
    if (a > 0.002) {
      g.strokeStyle = ink(ch, a);
      g.lineWidth = width(t);
      g.beginPath();
      g.moveTo(prev.x, prev.y);
      g.lineTo(p.x, p.y);
      g.stroke();
    }
    prev = p;
  }
  g.restore();
}

/** The face's outline: long, the cranium wider, narrowing to a long jaw. `k` scales it. */
function eggPath(g: CanvasRenderingContext2D, k = 1) {
  g.beginPath();
  for (let i = 0; i <= 72; i++) {
    const p = (i / 72) * TAU;
    const c = Math.cos(p);
    const narrow = 1 - 0.34 * Math.max(0, -c) ** 1.3;
    const x = HX + k * HRX * Math.sin(p) * narrow;
    const y = HY - k * HRY * c;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
}

/** The hollows of the face, in head units: two eye sockets, the nose, the long screaming mouth. */
interface Hole {
  u: number;
  w: number;
  rx: number;
  ry: number;
  rot: number;
  a: number;
  /** Smoke gathers round it in a rim. */
  rim: boolean;
}
const HOLES: Hole[] = [
  // the sockets, big and tall, their tops leaning in (a look of anguish)
  { u: -0.37, w: -0.2, rx: 0.25, ry: 0.21, rot: 0.38, a: 0.95, rim: true },
  { u: 0.37, w: -0.2, rx: 0.25, ry: 0.21, rot: -0.38, a: 0.95, rim: true },
  // the nose: a dark hollow, two nostrils
  { u: 0, w: 0.12, rx: 0.06, ry: 0.07, rot: 0, a: 0.7, rim: false },
  { u: -0.06, w: 0.16, rx: 0.05, ry: 0.055, rot: 0.4, a: 0.65, rim: false },
  { u: 0.06, w: 0.16, rx: 0.05, ry: 0.055, rot: -0.4, a: 0.65, rim: false },
  // the mouth, hanging open in a long scream
  { u: 0, w: 0.5, rx: 0.17, ry: 0.27, rot: 0, a: 0.95, rim: true },
  { u: 0, w: 0.66, rx: 0.18, ry: 0.17, rot: 0, a: 0.95, rim: false },
];

function drawHoles(g: CanvasRenderingContext2D, k: number, ch: Ch) {
  for (const h of HOLES) {
    const [x, y] = hp(h.u, h.w);
    blob(g, x, y, h.rx * HRX * k, h.ry * HRY * k, h.a, ch, h.rot, 0.7);
  }
}

/**
 * The wisps of smoke flowing round the head and up over it, trailing off to the right at the
 * top (head units). They rise from the smoke under the chin: smoke, not hair.
 */
const WISPS: [number, number][][] = [
  [
    [-0.45, 0.95],
    [-0.98, 0.45],
    [-1.12, -0.25],
    [-0.95, -0.82],
    [-0.5, -1.1],
    [0.15, -1.18],
    [0.75, -1.2],
    [1.2, -1.27],
    [1.45, -1.22],
  ],
  [
    [0.5, 0.92],
    [0.98, 0.38],
    [1.08, -0.3],
    [0.98, -0.78],
    [1.12, -1.02],
    [1.4, -1.1],
  ],
  [
    [0.0, -0.95],
    [-0.18, -1.1],
    [0.0, -1.24],
    [0.45, -1.28],
    [0.92, -1.2],
  ],
  [
    [-0.62, -1.0],
    [-0.95, -1.14],
    [-0.98, -1.28],
    [-0.76, -1.32],
    [-0.62, -1.22],
  ],
];
const wispPx = (w: [number, number][], du = 0, dw = 0) => w.map(([u, v]) => hp(u + du, v + dw));

/** The thread's filaments: they leave the wick as one and wind loosely round each other as they widen. */
interface Strand {
  ph: number;
  turns: number;
  amp: number;
  v1: number;
  alpha: number;
  width: number;
}
function makeStrands(): Strand[] {
  const r = seeded(1225);
  return Array.from({ length: 5 }, (_, k) => ({
    ph: (k / 5) * TAU + (r() - 0.5) * 0.5,
    turns: 1.3 + r() * 0.8,
    amp: 0.5 + r() * 0.45,
    v1: CHIN_V + 0.05 + r() * 0.05,
    alpha: 0.65 + r() * 0.35,
    width: 2.2 + r() * 0.8,
  }));
}
function strandAt(s: Strand, v: number): { x: number; y: number; depth: number } {
  const a = s.ph + TAU * s.turns * v;
  return { x: colX(v) + colHW(v) * s.amp * Math.sin(a), y: GH * (1 - v), depth: Math.cos(a) };
}
function drawStrand(g: CanvasRenderingContext2D, s: Strand, widthMul: number, alphaMul: number) {
  const n = 220;
  g.save();
  g.lineCap = 'butt';
  let prev = strandAt(s, 0);
  for (let i = 1; i <= n; i++) {
    const v = (i / n) * s.v1;
    const p = strandAt(s, v);
    const a = s.alpha * alphaMul * (1 - smooth((v - (s.v1 - 0.09)) / 0.09)) * (0.5 + 0.25 * (1 + p.depth));
    if (a > 0.002) {
      g.strokeStyle = ink('r', a);
      g.lineWidth = s.width * widthMul * (1 + 4 * v);
      g.beginPath();
      g.moveTo(prev.x, prev.y);
      g.lineTo(p.x, p.y);
      g.stroke();
    }
    prev = p;
  }
  g.restore();
}

/** The column's haze: the soft volume round the filaments, widening as it rises to the chin. */
function paintColumnHaze(g: CanvasRenderingContext2D) {
  for (let v = 0.04; v < CHIN_V + 0.08; v += 0.012) {
    const hw = colHW(v);
    blob(g, colX(v), GH * (1 - v), hw * 1.3 + 3, hw * 0.8 + 8, 0.1 * smooth(v / 0.1) * (1 - smooth((v - CHIN_V) / 0.08)), 'r');
  }
}

/** The thread and its filaments; `soft` draws their wider glow. */
function paintColumn(g: CanvasRenderingContext2D, strands: Strand[], soft: boolean) {
  for (const s of strands) drawStrand(g, s, soft ? 2.6 : 1, soft ? 0.3 : 0.9);
  if (soft) return;
  // the bright single thread right off the wick, before it opens out
  const pts: [number, number][] = Array.from({ length: 8 }, (_, k) => {
    const v = (k / 7) * CHIN_V * 0.7;
    return [colX(v), GH * (1 - v)];
  });
  band(g, pts, (t) => 4.2 + 2 * t, (t) => 0.95 * (1 - smooth((t - 0.5) / 0.5)), 'r', 60);
}

/** The head's smoke: the long face, brow and cheekbones, the neck it rises from, the wisps; the hollows cut out. */
function paintHeadSoft(g: CanvasRenderingContext2D) {
  eggPath(g, 1.05);
  const face = g.createRadialGradient(HX, HY - 0.25 * HRY, 4, HX, HY, HRY * 1.1);
  face.addColorStop(0, ink('g', 0.8));
  face.addColorStop(0.55, ink('g', 0.66));
  face.addColorStop(0.85, ink('g', 0.36));
  face.addColorStop(1, ink('g', 0.05));
  g.fillStyle = face;
  g.fill();
  blob(g, ...hp(0, -0.38), 0.8 * HRX, 0.14 * HRY, 0.25, 'g');
  for (const sd of [-1, 1]) blob(g, ...hp(sd * 0.56, 0.02), 0.3 * HRX, 0.13 * HRY, 0.22, 'g', sd * 0.2);
  blob(g, ...hp(0, 0.92), 0.36 * HRX, 0.12 * HRY, 0.18, 'g');
  // the neck: the smoke under the chin that the head rises out of
  band(g, [hp(0.03, 1.5), hp(0.02, 1.2), hp(0, 0.9)], (t) => HRX * (0.3 + 0.4 * t), (t) => 0.3 * smooth(t / 0.5), 'g', 60);
  for (const w of WISPS)
    band(g, wispPx(w), (t) => HRX * (0.3 - 0.15 * t), (t) => 0.26 * smooth(t / 0.12) * (1 - smooth((t - 0.5) / 0.5)), 'g');
  g.globalCompositeOperation = 'destination-out';
  drawHoles(g, 1.15, 'g');
  g.globalCompositeOperation = 'lighter';
  // the smoke is densest round the sockets and the mouth
  for (const h of HOLES)
    if (h.rim) ellipseLine(g, ...hp(h.u, h.w), h.rx * HRX * 1.4, h.ry * HRY * 1.35, h.rot, 0.14 * HRX, 0.34, 'g');
}

/** The head's fine detail: strands along its outline and brow, the rims of its hollows, curls in the wisps. */
function paintHeadFine(g: CanvasRenderingContext2D) {
  g.save();
  g.lineWidth = 2;
  for (const k of [0.97, 1.05]) {
    eggPath(g, k);
    g.strokeStyle = ink('g', 0.1);
    g.stroke();
  }
  g.restore();
  for (const h of HOLES) if (h.rim) ellipseLine(g, ...hp(h.u, h.w), h.rx * HRX * 1.22, h.ry * HRY * 1.2, h.rot, 3, 0.36, 'g');
  band(g, [hp(-0.72, -0.3), hp(0, -0.43), hp(0.72, -0.3)], () => 3, (t) => 0.22 * Math.sin(Math.PI * t), 'g', 60);
  for (const w of WISPS)
    for (const off of [-0.06, 0.05])
      band(g, wispPx(w, off, off * 0.5), (t) => 3 * (1 - 0.6 * t), (t) => 0.36 * smooth(t / 0.1) * (1 - t), 'g');
  g.globalCompositeOperation = 'destination-out';
  drawHoles(g, 1.05, 'g');
  g.globalCompositeOperation = 'lighter';
}

/** The dark of the hollows, and the faint hollows of the cheeks and temples that make it a skull. */
function paintHoles(g: CanvasRenderingContext2D) {
  drawHoles(g, 1, 'b');
  for (const sd of [-1, 1]) {
    blob(g, ...hp(sd * 0.5, 0.42), 0.12 * HRX, 0.25 * HRY, 0.16, 'b', sd * 0.2);
    blob(g, ...hp(sd * 0.74, -0.38), 0.1 * HRX, 0.14 * HRY, 0.1, 'b');
  }
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
    lg.lineJoin = 'round';
    paint(lg);
    blurOnto(g, c, px);
  };
  layer(paintColumnHaze, 9);
  layer((lg) => paintColumn(lg, strands, true), 3);
  layer((lg) => paintColumn(lg, strands, false), 0.6);
  layer(paintHeadSoft, 6);
  layer(paintHeadFine, 1.2);
  layer(paintHoles, 2.5);
  return main;
}

const SMOKE_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uTime;
uniform float uSeed;
uniform float uFront;
uniform float uTail;
uniform float uCol;
uniform float uThread;
uniform float uHead;
uniform float uLift;
uniform float uDrift;
uniform float uStretch;
uniform float uBreak;
uniform float uEmber;
varying vec2 vUv;
const float ASPECT = ${(SMOKE_W / SMOKE_H).toFixed(4)};
const float CHIN = ${CHIN_V.toFixed(4)};
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
  float t = uTime;
  // noise is taken in the picture's true shape, so its swirls are round
  vec2 p = vec2(vUv.x * ASPECT, h);
  // the sway: slow, broad noise travelling up, none at the wick, more higher up
  vec3 q = vec3(p.x * 2.6, p.y * 2.6 - t * 0.32, t * 0.1 + uSeed);
  vec2 w = vec2(fbm(q), fbm(q + vec3(5.2, 1.3, 2.8))) - 0.5;
  // and a finer curl along the filaments
  vec3 q2 = vec3(p.x * 10.0 + w.x * 1.5, p.y * 8.0 - t * 0.9, t * 0.2 + uSeed * 1.7);
  vec2 w2 = vec2(n3(q2), n3(q2 + vec3(3.1, 7.4, 1.9))) - 0.5;
  float amp = 0.002 + 0.06 * smoothstep(0.03, 0.5, h);
  float nz = fbm(vec3(p * 6.0, uSeed + 9.0));
  float rag = (nz - 0.5) * 0.08;
  // the smoke has reached this high (its front ragged), and has let go of the wick below uTail
  float front = smoothstep(uFront + 0.02, uFront - 0.1, h + rag);
  float tail = smoothstep(uTail - 0.02, uTail + 0.12, h + rag);
  float edge = smoothstep(1.0, 0.9, h) * smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);

  // the thread and its column, which stay on the wick while the smoke flows up through them
  vec2 cu = vUv + vec2(w.x * amp + w2.x * amp * 0.3, (w.y * 0.3 + w2.y * 0.1) * amp);
  float cd = texture2D(uMap, cu).r * inside(cu);
  float flow = 0.6 + 0.8 * n3(vec3(p.x * 12.0, p.y * 9.0 - t * 1.2, t * 0.3 + uSeed));
  float thread = mix(1.0, smoothstep(0.3, 0.1, h), uThread);
  float ca = clamp(cd * flow * 1.5, 0.0, 1.0) * front * tail * thread * uCol * edge;
  vec3 cc = mix(vec3(0.72, 0.74, 0.78), vec3(0.97, 0.97, 0.98), smoothstep(0.05, 0.6, cd));
  cc += uEmber * vec3(0.45, 0.18, 0.05) * pow(max(0.0, 1.0 - h * 7.0), 3.0);
  vec3 col = cc * ca;
  float a = ca;

  if (uHead > 0.0) {
    // the head rises with the smoke and drifts; it sways less than the thread, so it keeps its shape
    vec2 hu = vUv;
    hu.x -= uDrift * smoothstep(0.15, 0.5, h);
    hu.y -= uLift;
    // drawn out upward as it comes apart
    hu.y = CHIN + (hu.y - CHIN) / (1.0 + uStretch);
    hu += vec2(w.x, w.y * 0.3) * amp * 0.3 + w2 * amp * (0.05 + 0.4 * uBreak);
    vec4 hd = texture2D(uMap, hu) * inside(hu);
    // coming apart: holes open in it and spread
    float b = fbm(vec3(p * vec2(8.0, 5.0) - vec2(0.0, t * 0.4), t * 0.25 + 3.0));
    float keep = 1.0 - smoothstep(b - 0.15, b + 0.15, uBreak * 1.3 - 0.15);
    float m = front * keep * uHead * edge;
    float hf = 0.8 + 0.4 * n3(vec3(p.x * 14.0, p.y * 11.0 - t * 0.7, t * 0.2 + uSeed * 2.3));
    float ha = clamp(hd.g * 1.45 * hf, 0.0, 0.95) * m;
    float hk = clamp(hd.b * 1.15, 0.0, 1.0) * m * 0.85;
    vec3 hc = mix(vec3(0.8, 0.81, 0.84), vec3(1.0, 1.0, 0.99), smoothstep(0.1, 0.65, hd.g));
    col = hc * ha + col * (1.0 - ha);
    a = ha + a * (1.0 - ha);
    col = vec3(0.005, 0.006, 0.01) * hk + col * (1.0 - hk);
    a = hk + a * (1.0 - hk);
  }
  gl_FragColor = vec4(col, a);
}
`;

function smokeUniforms(map: THREE.Texture, seed: number, thread: number) {
  return {
    uMap: { value: map },
    uTime: { value: 0 },
    uSeed: { value: seed },
    uFront: { value: 0 },
    uTail: { value: -0.2 },
    uCol: { value: 0 },
    uThread: { value: thread },
    uHead: { value: 0 },
    uLift: { value: 0 },
    uDrift: { value: 0 },
    uStretch: { value: 0 },
    uBreak: { value: 0 },
    uEmber: { value: 0 },
  };
}
type SmokeU = ReturnType<typeof smokeUniforms>;

/** Drawn after the veil, on top of everything, never darkened: the smoke comes out toward you. */
function smokeMat(u: SmokeU): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: BILL_VERT,
    fragmentShader: SMOKE_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    premultipliedAlpha: true,
  });
}

function buildGhost() {
  const tex = new THREE.CanvasTexture(paintGhost());
  tex.anisotropy = 4;
  const geo = new THREE.PlaneGeometry(SMOKE_W, SMOKE_H);
  geo.translate(0, SMOKE_H / 2, 0);
  const front = smokeUniforms(tex, 1.3, 0);
  const back = smokeUniforms(tex, 7.9, 0);
  const wisp = smokeUniforms(tex, 4.4, 1);
  return { geo, front, back, wisp, mats: { front: smokeMat(front), back: smokeMat(back), wisp: smokeMat(wisp) } };
}
let ghostGeo: ReturnType<typeof buildGhost> | null = null;
const ghostParts = () => (ghostGeo ??= buildGhost());

interface SmokeState {
  time: number;
  front: number;
  tail: number;
  col: number;
  head: number;
  lift: number;
  drift: number;
  stretch: number;
  brk: number;
  ember: number;
}

function setSmoke(u: SmokeU, st: SmokeState) {
  u.uTime.value = st.time;
  u.uFront.value = st.front;
  u.uTail.value = st.tail;
  u.uCol.value = st.col;
  u.uHead.value = st.head;
  u.uLift.value = st.lift;
  u.uDrift.value = st.drift;
  u.uStretch.value = st.stretch;
  u.uBreak.value = st.brk;
  u.uEmber.value = st.ember;
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

/**
 * Every frame of the smoke, from the seconds since the Take (outside the component). One
 * movement, no pauses: the front of the smoke climbs at an even pace from 0.12 s; the head is
 * carried up from the start, so it is already rising when the front reaches it and it forms
 * (0.85-1.5 s); it drifts on, holding its shape, until 3.3 s, then speeds up, draws out and
 * breaks up (gone by 5.0 s). The thread lets go of the wick at 3.0 s and follows it.
 */
function driveSmoke(root: THREE.Group | null, s: number, cam: THREE.Camera) {
  if (!root) return;
  if (s === Infinity || s > TAKE.end) {
    root.visible = false;
    return;
  }
  // Before the Take it is drawn, fully clear, so its shaders are ready: no stall (no jerk) the
  // moment the flame goes out.
  root.visible = true;
  faceCamera(root, cam);
  const p = ghostParts();
  if (s < 0) {
    for (const u of [p.front, p.back, p.wisp]) setSmoke(u, { time: 0, front: 0, tail: -0.2, col: 0, head: 0, lift: 0, drift: 0, stretch: 0, brk: 0, ember: 0 });
    return;
  }
  const t = s;
  // never still: the front climbs, and the head is carried up from the first moment, at a
  // pace that only grows, until it has gone out of the top
  const front = 0.95 * clamp01((t - 0.05) / 1.6) ** 0.85;
  const lift = 0.12 * t + 0.04 * t * t;
  const drift = 0.012 * Math.sin(t * 0.8) + 0.04 * smooth((t - 1.0) / 2.0);
  const stretch = 0.7 * smooth((t - 2.0) / 1.5);
  const brk = smooth((t - 2.2) / 1.5);
  const head = 1 - smooth((t - 3.0) / 0.8);
  const tail = t < 2.0 ? -0.2 : -0.12 + 0.5 * (t - 2.0);
  const col = 1 - smooth((t - 3.0) / 0.7);
  const ember = emberAt(t);
  setSmoke(p.front, { time: t, front, tail, col, head, lift, drift, stretch, brk, ember });
  // a fainter second layer, swaying on its own, gives the column depth
  setSmoke(p.back, { time: t + 11, front: front - 0.04, tail, col: col * 0.35, head: 0, lift: 0, drift: 0, stretch: 0, brk: 0, ember });
  // a last thin wisp from the ember as it dies (4.4-5.8 s)
  const wisp = t > 3.2 ? 0.7 * (1 - smooth((t - 3.8) / 0.8)) : 0;
  setSmoke(p.wisp, { time: t + 3, front: 0.3 * smooth((t - 3.2) / 0.6), tail: -0.2, col: wisp, head: 0, lift: 0, drift: 0, stretch: 0, brk: 0, ember });
}

/**
 * The smoke from the blown-out wick: a thin thread curling up off the ember and widening, and
 * at its top the smoke is a face. A picture that always turns to face you, its foot on the
 * ember, drawn over everything (after the veil) so it stays bright in the dark.
 */
/** How much narrower than it was painted the smoke and its face are drawn. */
const SMOKE_SQUEEZE = 0.55;

function SmokeGhost({ since, scale }: { since: () => number; scale: number }) {
  const root = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const p = ghostParts();
  useFrame(() => {
    const s = since();
    // fast forward
    driveSmoke(root.current, s < 0 || s === Infinity ? s : s * 1.8, camera);
  });
  return (
    // squeezed narrow: a thin column, a thin face
    <group ref={root} position={OLD_TIP} scale={[scale * SMOKE_SQUEEZE, scale, scale]} visible={false} userData={{ extra: true }}>
      <mesh geometry={p.geo} material={p.mats.back} position-z={-0.02} scale={1.06} renderOrder={9} />
      <mesh geometry={p.geo} material={p.mats.front} renderOrder={10} />
      <mesh geometry={p.geo} material={p.mats.wisp} renderOrder={10} />
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

/** Every frame of the flame, its light, the ember and the dark (outside the component). */
function driveCandle(r: Rig, s: number, clock: number, base: number, cam: THREE.Camera, at: V3, taken: boolean) {
  const lp = lights();
  // lit until it is taken; then it shrinks into the wick and dies in 0.3 s
  const lit = s < 0 ? 1 : 1 - progress(s, TAKE.out);
  const fl = 1 + Math.sin(clock * 13) * 0.05 + Math.sin(clock * 7.3 + 1) * 0.04 + Math.sin(clock * 23.1) * 0.02;
  const f = r.flame;
  if (f) {
    f.visible = lit > 0.002;
    f.position.set(at[0], at[1] - 0.008 * (1 - lit), at[2]);
    f.scale.set((0.55 + 0.45 * lit) * (1 - (fl - 1) * 0.5), fl * lit ** 0.8, 1);
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
  // the room goes dark as the flame dies, and stays dark
  veil().u.uAlpha.value = taken ? VEIL_DARK * progress(Math.max(0, s), 0.4) : 0;
}

/** The chamberstick: polished brass by day; worn and tarnished after the Reveal. */
function Holder({ haunted }: { haunted: boolean }) {
  return <mesh geometry={holder()} material={haunted ? brassOld() : brassDay()} />;
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
  const L = 0.07;
  const W = 0.021;
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
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.0025, bevelEnabled: false });
  g.translate(0, 0, -0.00125);
  return g;
}

let hollyGeo: { leaf: THREE.ExtrudeGeometry; berry: THREE.SphereGeometry } | null = null;
const hollyParts = () => (hollyGeo ??= { leaf: buildLeaf(), berry: new THREE.SphereGeometry(0.009, 12, 9) });

/** Where the holly lies in the pan: front left, between the socket and the rim. */
const HOLLY_AT = -0.8;

/** A sprig of holly in the pan by day: two leaves along the rim and three red berries. */
function Holly() {
  const g = hollyParts();
  const r = 0.2;
  return (
    <group position={[Math.sin(HOLLY_AT) * r, PAN_FLOOR + 0.004, Math.cos(HOLLY_AT) * r]} rotation-y={HOLLY_AT}>
      <mesh geometry={g.leaf} material={M.green()} position={[0.004, 0.002, 0]} rotation={[-Math.PI / 2 + 0.14, 0.12, 0.25]} />
      <mesh geometry={g.leaf} material={M.green()} position={[-0.004, 0.003, 0.004]} rotation={[-Math.PI / 2 - 0.12, -0.1, Math.PI - 0.35]} />
      {[
        [0, 0.008, 0.006],
        [0.012, 0.007, -0.004],
        [-0.011, 0.007, -0.005],
      ].map(([bx, by, bz], i) => (
        <mesh key={i} geometry={g.berry} material={M.berry()} position={[bx!, by!, bz!]} />
      ))}
    </group>
  );
}

/**
 * The smoke's scale on a shelf card. The card fits the candlestick and its flame, which leaves
 * a little over half a unit above the wick; at this scale the face and its wisps fit inside it.
 */
const SHELF_SMOKE = 0.7;

/**
 * How tall the room the Take rises into is, above the wick, in the product view. With the
 * view's margin round it, the thread, the face and the wisps over it fit inside the picture
 * while the face rises, and the candlestick keeps about 40% of the view's height.
 */
const FRAME_H = 0.52;

/**
 * The candle for the window (see the top of this file). The flame flickers (with a periodic
 * redraw, so it lives on the on-demand shelf too) and lights the room; that light grows when
 * the mains fail. Taken, it goes out and a face rises in its smoke; the room stays dark round
 * it afterwards, on its card and in its product view.
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
  // paint the smoke ahead of time, so the Take does not stall while it is drawn
  useEffect(() => {
    if (!haunted) return;
    const t = setTimeout(() => ghostParts(), 700);
    return () => clearTimeout(t);
  }, [haunted]);
  const base = 1.2 + (1 - mains);
  const at = haunted ? OLD_FLAME : NEW_FLAME;
  const lp = lights();
  const vp = veil();
  useFrame((st) =>
    driveCandle({ flame: flame.current, light: light.current, ember: ember.current }, since(), st.clock.elapsedTime, base, camera, at, taken),
  );
  return (
    <group>
      <Holder haunted={haunted} />
      {haunted ? <OldCandle /> : <NewCandle />}
      {!haunted && <Holly />}
      {/* the flame counts toward the object's size (it is tall), its glow does not */}
      <group ref={flame} position={at}>
        <mesh geometry={lp.flameGeo} material={lp.flameMat} renderOrder={4} />
        <group userData={{ extra: true }}>
          <mesh geometry={lp.haloGeo} material={lp.haloMat} renderOrder={4} />
        </group>
      </group>
      <pointLight ref={light} position={[at[0], at[1] + 0.1, 0.12]} intensity={base} distance={2.5} color="#ffb860" />
      {haunted && (
        // the dark: over the candle and the room, under the ember and the smoke (clear until
        // it is taken; mounted before, so its shader is ready and nothing stalls)
        <mesh geometry={vp.geo} material={vp.mat} renderOrder={5} frustumCulled={false} userData={{ extra: true }} />
      )}
      {haunted && (
        // the wick glowing after it is blown out, then going dark
        <group ref={ember} position={OLD_TIP} visible={false} userData={{ extra: true }}>
          <mesh material={lp.emberMat} renderOrder={8}>
            <sphereGeometry args={[0.0045, 12, 8]} />
          </mesh>
          <mesh geometry={lp.emberHaloGeo} material={lp.emberHaloMat} renderOrder={8} />
        </group>
      )}
      {haunted && <SmokeGhost since={since} scale={onShelf ? SHELF_SMOKE : 1} />}
      {haunted && (
        // not drawn: the room above the wick that the smoke and the face rise into; the product
        // view frames it from the start (userData.frame), so the view does not move when the
        // Take happens, and only as tall as the face so the candlestick keeps a good size
        <mesh position={[OLD_TIP[0] + 0.03, OLD_TIP[1] + FRAME_H / 2, OLD_TIP[2]]} userData={{ frame: true }}>
          <boxGeometry args={[0.5, FRAME_H, 0.1]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      )}
    </group>
  );
}
