import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { seeded } from '../../director/footprints';
import { decayUniforms, mat } from '../../gl/decay';
import { M } from '../../gl/materials';
import { useTaken } from '../../gl/useTaken';
import { useHaunted } from '../../store';

/*
 * A baby girl's first Christmas shoes: a pair of red velvet Mary Janes standing at a three-quarter
 * turn, the right one a little behind and to the right of the left. Round toes; a cream lace frill
 * standing up and out all round each opening; one velvet strap over the instep, its edges trimmed
 * with tiny lace, fastened on the outer side with a square antique-gold buckle and prong; on each
 * toe a big velvet bow (two loops, two tails) with a little gold jingle bell hanging from its knot,
 * and a cream snowflake embroidered below it. Brown leather soles with a cream-stitched welt and a
 * slightly raised heel; tan leather inside.
 *
 * After the Reveal it is the same pair, ruined: the velvet faded to a dirty brown-red and worn
 * through on the toes to pale cracked leather (a hole torn in the right shoe's toe), the lace
 * greyed, torn and tangled, cobwebs across the openings and from one shoe to the other, the
 * buckle tarnished, the bows ragged and dark. Old blood has run from the bows down the toes and
 * dried in drops on the floor.
 *
 * Taken (seconds after the Take):
 *   0.15-4.4  blood wells out from under the whole of both soles, all round their outlines, and
 *             spreads slowly across the floor: quick at first (four fifths of the way by about
 *             2.5 s), then creeping, each part of the edge at its own pace (the right shoe 0.3 s
 *             later, to 4.7). Dark and glossy.
 *   0.3-2.05  fresh blood runs from each bow's knot down the toe, over the welt, to the floor,
 *             two runs a shoe (the right shoe 0.3 s later).
 *   1.8-5.7   drops keep coming down those runs, hang at the welt and fall into the pool, one
 *             every 0.9 s; the last one stays hanging.
 *   1.3-6.05  meanwhile the prints (fx/ShoePrints, drawn over the picture) walk away from where
 *             the next step would fall.
 * Reload or reduced motion: the pool spread, the runs down, a drop hanging at each toe.
 *
 * Each shoe is built in its own space: toe +x, up +y, its left side -z, the floor at y = 0.
 */

const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => {
  const k = clamp01(v);
  return k * k * (3 - 2 * k);
};
/** A signed power: keeps the sign, bends the size. */
const spow = (v: number, p: number) => Math.sign(v) * Math.abs(v) ** p;
type V3 = THREE.Vector3;
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** Built the first time it is asked for, then shared by every view. */
function once<T>(make: () => T): () => T {
  let value: T | undefined;
  return () => (value ??= make());
}

/** A smooth seeded wobble round a circle, -1..1. */
function wobble(seed: number, terms = 5): (th: number) => number {
  const r = seeded(seed);
  const t = Array.from({ length: terms }, (_, k) => ({ k: k + 1, ph: r() * TAU, w: (0.5 + r()) / (k + 1) }));
  const norm = t.reduce((s, x) => s + x.w, 0);
  return (th) => t.reduce((s, x) => s + x.w * Math.sin(x.k * th + x.ph), 0) / norm;
}

/* ------------------------------------------------------------------------------------------ */
/* The last: the shape every part is built on                                                 */
/* ------------------------------------------------------------------------------------------ */

/** Half the shoe's length, heel to toe. */
const L2 = 0.215;
/** The last's lengthwise features were laid out for a longer shoe; this scales them to L2. */
const SX = L2 / 0.28;
/** How far the sole stands out round the upper (the welt). */
const WELT = 0.012;
/** Where the opening begins, over the instep. */
const THROAT = 0.05 * SX;
/** The upper's thickness: the lining sits this far inside the velvet. */
const LINING = 0.008;
const RUFFLE_W = 0.05;

/** Narrow at the heel, round and wide at the toes: a baby's foot, short and chubby. */
const halfWidth = (x: number) => 0.09 + 0.032 * smooth((x / L2 + 0.95) / 1.2);

/** The upper's footprint, round from a = 0 at the back of the heel, 0.25 its left side, 0.5 the toe tip, 0.75 its right side. */
function outline(a: number): [number, number] {
  const th = TAU * a + Math.PI;
  const x = L2 * spow(Math.cos(th), 0.85);
  return [x, halfWidth(x) * spow(Math.sin(th), 0.9)];
}

/** The outward normal of the footprint, in the floor plane. */
function outlineNormal(a: number): [number, number] {
  const e = 1e-4;
  const [x0, z0] = outline(a - e);
  const [x1, z1] = outline(a + e);
  const tx = x1 - x0;
  const tz = z1 - z0;
  const l = Math.hypot(tx, tz) || 1;
  return [tz / l, -tx / l];
}

/** The spine the sections close onto: a line along the middle of the shoe. */
const spineK = (x: number) => 0.52 - 0.07 * Math.tanh(x / SX / 0.08);
/** The front of the sole curls up a little off the floor. */
const spring = (x: number) => 0.01 * smooth((x / SX - 0.15) / 0.13) ** 1.5;
/** Top of the sole: the heel stands a little higher than the forefoot. */
const soleTop = (x: number) => 0.026 + 0.016 * (1 - smooth((x / SX + 0.17) / 0.07)) + spring(x);
/** Underneath: heel and ball on the floor, the waist just off it. */
const soleBot = (x: number) => 0.007 * smooth((x / SX + 0.125) / 0.02) * (1 - smooth(x / SX / 0.05)) + spring(x);
/** Height of the top line of the last over spine point c: the high round toe box, the instep, the heel. */
const ridge = (c: number) => 0.168 + 0.02 * smooth((0.15 - c / SX) / 0.13) + 0.045 * smooth((-c / SX - 0.04) / 0.14);

/** How far round its section the upper goes at x: right over the toes, less round the opening. */
function wrap(x: number): number {
  const side = 0.74 + 0.2 * smooth((-x / SX - 0.16) / 0.12);
  return side + (Math.PI / 2 - side) * smooth((x / SX - (THROAT / SX - 0.075)) / 0.075);
}

/** The section: straight up off the sole, a full round puff (a baby's toes), then over to the spine. */
const secX = (p: number) => Math.max(0, Math.cos(p)) ** 0.55 * (1 + 0.1 * Math.sin(2 * p));
const secY = (p: number) => Math.max(0, Math.sin(p)) ** 0.9;

/** A point on the upper at a round the footprint and p up its section, pushed in by `inset` (or out, if negative). */
function upperPoint(a: number, p: number, inset: number, out: V3): V3 {
  const [ox, oz] = outline(a);
  const c = spineK(ox) * ox;
  const dx = ox - c;
  const dl = Math.hypot(dx, oz);
  const k = Math.max(0, dl - inset) / dl;
  const base = soleTop(ox) - 0.003;
  const top = ridge(c) - inset;
  const h = secX(p) * k;
  return out.set(c + dx * h, base + (top - base) * secY(p), oz * h);
}

const ta = v3();
const tb = v3();
const tc = v3();

/** The upper's outward normal at (a, p). */
function upperNormal(a: number, p: number, out: V3): V3 {
  const e = 1e-3;
  upperPoint(a, p + e, 0, ta).sub(upperPoint(a, p - e, 0, tb));
  upperPoint(a + e, p, 0, tc).sub(upperPoint(a - e, p, 0, tb));
  return out.crossVectors(ta, tc).normalize();
}

/** A frame on the upper at (a, p), `lift` off it: X across, Y up the surface, Z out of it. */
function surfaceFrame(a: number, p: number, lift: number): THREE.Matrix4 {
  const z = upperNormal(a, p, v3());
  const y = upperPoint(a, p + 1e-3, 0, v3()).sub(upperPoint(a, p - 1e-3, 0, v3()));
  y.addScaledVector(z, -y.dot(z)).normalize();
  const x = v3().crossVectors(y, z);
  const at = upperPoint(a, p, 0, v3()).addScaledVector(z, lift);
  return new THREE.Matrix4().makeBasis(x, y, z).setPosition(at);
}

/** The a on the left side where the footprint reaches x. */
function findA(x: number): number {
  let lo = 0;
  let hi = 0.5;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (outline(m)[0] < x) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

const A_THROAT = findA(THROAT);

/** Round the opening: s = 0 at the throat on the right, 0.5 at the heel, 1 back at the throat. */
function collarA(s: number): number {
  const a = 1 - A_THROAT + 2 * A_THROAT * s;
  return a >= 1 ? a - 1 : a;
}

function collarPoint(s: number, inset: number, out: V3): V3 {
  const a = collarA(s);
  return upperPoint(a, wrap(outline(a)[0]), inset, out);
}

/** The middle of the opening, in the floor plane. */
const collarMid = once(() => {
  const m = v3();
  for (let k = 0; k < 48; k++) m.add(collarPoint(k / 48, 0, v3()));
  return m.multiplyScalar(1 / 48).setY(0);
});

const tq = v3();

/** The way the frill stands at s: square to the edge, up and out, away from the opening. */
function frillDir(s: number, out: V3, droop = 0): V3 {
  collarPoint(Math.min(1, s + 1e-3), 0, out).sub(collarPoint(Math.max(0, s - 1e-3), 0, tq));
  collarPoint(s, 0, tq).sub(collarMid());
  let ox = out.z;
  let oz = -out.x;
  if (ox * tq.x + oz * tq.z < 0) {
    ox = -ox;
    oz = -oz;
  }
  const l = Math.hypot(ox, oz) || 1;
  return out.set((ox / l) * (0.5 + droop), 0.86 - droop * 0.9, (oz / l) * (0.5 + droop)).normalize();
}

/* ------------------------------------------------------------------------------------------ */
/* Geometry                                                                                   */
/* ------------------------------------------------------------------------------------------ */

type At = (i: number, j: number, out: V3) => void;

/**
 * A (cols × rows) grid of quads. Triangles wind so that, when i runs round a shape and j runs up
 * it, the outside faces out; `flip` turns them over. `wrap` joins the first and last columns.
 */
function gridGeometry(cols: number, rows: number, at: At, uvAt: (i: number, j: number) => [number, number], opts: { wrap?: boolean; flip?: boolean } = {}) {
  const n = (cols + 1) * (rows + 1);
  const pos = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  const p = v3();
  for (let i = 0; i <= cols; i++)
    for (let j = 0; j <= rows; j++) {
      const o = i * (rows + 1) + j;
      at(i, j, p);
      pos.set([p.x, p.y, p.z], o * 3);
      uv.set(uvAt(i, j), o * 2);
    }
  const idx: number[] = [];
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      const a = i * (rows + 1) + j;
      const b = a + rows + 1;
      if (opts.flip) idx.push(a, b, a + 1, b, b + 1, a + 1);
      else idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (opts.wrap) {
    const nor = g.attributes.normal as THREE.BufferAttribute;
    for (let j = 0; j <= rows; j++) {
      const a = j;
      const b = cols * (rows + 1) + j;
      p.set(nor.getX(a) + nor.getX(b), nor.getY(a) + nor.getY(b), nor.getZ(a) + nor.getZ(b)).normalize();
      nor.setXYZ(a, p.x, p.y, p.z);
      nor.setXYZ(b, p.x, p.y, p.z);
    }
  }
  return g;
}

/** Parts must all be indexed or all not, with the same attributes (position, normal, uv). */
function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const out = mergeGeometries(parts) ?? new THREE.BufferGeometry();
  parts.forEach((g) => g.dispose());
  return out;
}

/** For merging with non-indexed parts (an extrusion). */
function unindexed(g: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!g.index) return g;
  const out = g.toNonIndexed();
  g.dispose();
  return out;
}

const NA = 168;
const NP = 20;

/**
 * The upper as a shell over the last. `paint` gives it plain 0..1 coordinates (a round, p up),
 * for the wear painted on it after the Reveal; otherwise they are scaled for the velvet's weave.
 */
function upperGeometry(inset: number, paint: boolean) {
  return gridGeometry(
    NA,
    NP,
    (i, j, out) => {
      const a = i / NA;
      upperPoint(a, (j / NP) * wrap(outline(a)[0]), inset, out);
    },
    (i, j) => {
      const a = i / NA;
      const v = ((j / NP) * wrap(outline(a)[0])) / (Math.PI / 2);
      return paint ? [a, v] : [a * 5.8, v * 0.75];
    },
    { wrap: true },
  );
}

/** Rows of the sole's section: [share of the way out from the spine, top or bottom, height offset]. */
const SOLE_ROWS: [number, 0 | 1, number][] = [
  [0, 0, 0],
  [0.9, 0, 0],
  [0.978, 0, 0.0025],
  [1, 0, 0.008],
  [1, 1, -0.006],
  [0.99, 1, -0.0016],
  [0.95, 1, 0],
  [0, 1, 0],
];

/** The leather sole: a rounded slab under the welt, a little thicker at the heel. */
function soleGeometry() {
  return gridGeometry(
    NA,
    SOLE_ROWS.length - 1,
    (i, j, out) => {
      const a = i / NA;
      const [ox, oz] = outline(a);
      const [nx, nz] = outlineNormal(a);
      const wx = ox + nx * WELT;
      const wz = oz + nz * WELT;
      const c = spineK(ox) * ox;
      const [r, top, dy] = SOLE_ROWS[j]!;
      const x = c + (wx - c) * r;
      out.set(x, (top ? soleTop(x) : soleBot(x)) + dy, wz * r);
    },
    (i, j) => [(i / NA) * 5, j / 7],
    { wrap: true },
  );
}

/** The tan insole, curling up a little at its edge into the lining. */
function insoleGeometry() {
  const R = [0, 0.6, 0.9, 1];
  return gridGeometry(
    NA,
    3,
    (i, j, out) => {
      const a = i / NA;
      const [ox, oz] = outline(a);
      const c = spineK(ox) * ox;
      const dx = ox - c;
      const dl = Math.hypot(dx, oz);
      const k = ((dl - LINING - 0.002) / dl) * R[j]!;
      const x = c + dx * k;
      out.set(x, soleTop(x) + 0.0045 + (j === 3 ? 0.003 : 0), oz * k);
    },
    (i, j) => [(i / NA) * 4, R[j]! * 0.5],
    { wrap: true, flip: true },
  );
}

/** The velvet piping round the opening, over the seam between velvet and lining. */
function bindingGeometry() {
  const pts = Array.from({ length: 140 }, (_, k) => collarPoint(k / 140, LINING / 2, v3()));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, 'centripetal'), 320, 0.0052, 8, true);
}

const WAVES = 46;

/**
 * The lace frill round the opening: it stands up and out from the piping, gathered in small
 * pleats, one scallop of the lace per pleat. After the Reveal it is limp and tangled: drooping
 * here and there, crushed, the pleats uneven (the decay shader tears holes in it).
 */
function ruffleGeometry(haunted: boolean) {
  const n1 = wobble(haunted ? 71 : 7, 7);
  const n2 = wobble(91, 9);
  const N = 330;
  const K = 5;
  const e = v3();
  const t = v3();
  const r = v3();
  const w = v3();
  return gridGeometry(
    N,
    K,
    (i, k, out) => {
      const s = i / N;
      const f = k / K;
      collarPoint(s, LINING * 0.5, e);
      collarPoint(Math.min(1, s + 1e-3), LINING * 0.5, t).sub(collarPoint(Math.max(0, s - 1e-3), LINING * 0.5, r)).normalize();
      // limp after the Reveal, but held up where it crosses the throat (or it would sink into the toe)
      const held = smooth(Math.min(s, 1 - s) / 0.07);
      frillDir(s, r, haunted ? (0.35 + 0.35 * n1(s * TAU)) * held : 0);
      w.crossVectors(t, r).normalize();
      const width = RUFFLE_W * (haunted ? 0.78 + 0.3 * n2(s * TAU) : 1);
      const amp = (haunted ? 0.0085 : 0.0055) * f ** 0.85;
      const ph = TAU * s * WAVES + (haunted ? 1.3 * n1(s * TAU * 3) : 0);
      out
        .copy(e)
        .addScaledVector(r, f * width - 0.003)
        .addScaledVector(w, amp * Math.sin(ph))
        .addScaledVector(t, 0.0015 * f * Math.cos(ph));
      if (haunted) out.y -= 0.006 * f * f * (0.5 + 0.5 * n2(s * TAU * 2)) * held;
    },
    (i, k) => [(i / N) * WAVES, k / K],
  );
}

/** The cream stitches round the welt, a little slanted, like hand saddle-stitching. */
function stitchGeometry() {
  const N = 900;
  const len: number[] = [0];
  for (let i = 1; i <= N; i++) {
    const [x0, z0] = outline((i - 1) / N);
    const [x1, z1] = outline(i / N);
    len.push(len[i - 1]! + Math.hypot(x1 - x0, z1 - z0));
  }
  const total = len[N]!;
  const parts: THREE.BufferGeometry[] = [];
  const step = 0.0125;
  let i = 0;
  for (let d = step / 2; d < total; d += step) {
    while (i < N && len[i + 1]! < d) i++;
    const a = (i + (d - len[i]!) / (len[i + 1]! - len[i]!)) / N;
    const [ox, oz] = outline(a);
    const [nx, nz] = outlineNormal(a);
    const x = ox + nx * WELT * 0.5;
    const z = oz + nz * WELT * 0.5;
    const b = new THREE.BoxGeometry(0.0072, 0.0016, 0.0024);
    // along the welt (+x turned onto the tangent), then slanted
    b.rotateY(Math.atan2(-nx, -nz) + 0.3);
    b.translate(x, soleTop(x) + 0.0006, z);
    parts.push(b);
  }
  return merge(parts);
}

/** Threads between points in the plane of a small motif, laid onto the toe by `onToe`. */
function threadGeometry(segs: [number, number, number, number][], onToe: (x: number, y: number) => V3, r: number) {
  return merge(
    segs.map(([x0, y0, x1, y1]) => {
      const pts = Array.from({ length: 5 }, (_, k) => onToe(x0 + ((x1 - x0) * k) / 4, y0 + ((y1 - y0) * k) / 4));
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 6, r, 5, false);
    }),
  );
}

/** Where things sit on the toe, up its front: the snowflake, the bell, the bow. */
const P_SNOW = 0.34;
const P_BELL = 0.74;
const P_BOW = 1.12;
const BELL_R = 0.0145;
/** How much bigger than its first pattern the bow is drawn. */
const BOW_S = 1.75;

/** Maps a motif's flat coordinates (metres, x across, y up) onto the front of the toe round (0.5, p0). */
function toeMapper(p0: number, lift: number) {
  const sa = upperPoint(0.5 + 1e-3, p0, 0, v3()).distanceTo(upperPoint(0.5 - 1e-3, p0, 0, v3())) / 2e-3;
  const sp = upperPoint(0.5, p0 + 1e-3, 0, v3()).distanceTo(upperPoint(0.5, p0 - 1e-3, 0, v3())) / 2e-3;
  return (x: number, y: number) => upperPoint(0.5 - x / sa, p0 + y / sp, -lift, v3());
}

/** The embroidered snowflake: six arms, each with two pairs of little branches, round a hexagon. */
function snowflakeGeometry() {
  const R = 0.022;
  const segs: [number, number, number, number][] = [];
  for (let k = 0; k < 6; k++) {
    const t = Math.PI / 2 + (k * Math.PI) / 3;
    const dx = Math.cos(t);
    const dy = Math.sin(t);
    segs.push([dx * R * 0.2, dy * R * 0.2, dx * R, dy * R]);
    for (const [f, l] of [
      [0.48, 0.34],
      [0.74, 0.24],
    ] as const)
      for (const sd of [-1, 1]) {
        const b = t + sd * 0.8;
        segs.push([dx * R * f, dy * R * f, dx * R * f + Math.cos(b) * R * l, dy * R * f + Math.sin(b) * R * l]);
      }
    const t2 = t + Math.PI / 3;
    segs.push([dx * R * 0.2, dy * R * 0.2, Math.cos(t2) * R * 0.2, Math.sin(t2) * R * 0.2]);
  }
  return threadGeometry(segs, toeMapper(P_SNOW, 0.0022), 0.0013);
}

/** The bow's place: on top of the toe, tipped forward so its face looks out over the toe. */
const bowFrame = once(() => surfaceFrame(0.5, P_BOW, 0.021).multiply(new THREE.Matrix4().makeRotationX(0.45)));

/**
 * One loop of the bow, in the bow's own space (x across, y up, z out of its face): the ribbon
 * goes out from the knot along the front, folds back at the far end and returns behind, narrow
 * where the knot pinches it and wide at the fold, its faces cupped. After the Reveal, crushed
 * and drooping.
 */
function loopGeometry(sg: 1 | -1, haunted: boolean) {
  const NL = 48;
  const NW = 6;
  const W = 0.064;
  const D = haunted ? 0.0065 : 0.0095;
  const tilt = haunted ? -0.14 : 0.24;
  const crush = wobble(sg > 0 ? 13 : 17, 4);
  const g = gridGeometry(
    NL,
    NW,
    (i, j, out) => {
      const th = (i / NL) * TAU;
      const q = (j / NW) * 2 - 1;
      const h = 0.0065 + 0.0175 * Math.sin(th / 2) ** 1.3;
      const x = (W * (1 - Math.cos(th))) / 2;
      let y = q * h;
      if (haunted) y += 0.004 * crush(th * 2 + q) * Math.sin(th / 2);
      const z = Math.sin(th) * (D + 0.004 * (1 - q * q));
      out.set(sg * (x * Math.cos(tilt) - y * Math.sin(tilt)), x * Math.sin(tilt) + y * Math.cos(tilt), z);
    },
    (i, j) => [(i / NL) * 1.2, (j / NW) * 0.2],
  );
  return g;
}

/** A tail of the bow, laid down over the toe from the knot, cut in a V at the end. */
function tailGeometry(sg: 1 | -1, haunted: boolean) {
  const N = 26;
  const K = 4;
  const end = haunted ? 0.86 : 1;
  const fray = seeded(sg > 0 ? 5 : 9);
  const cut = Array.from({ length: K + 1 }, () => (haunted ? fray() * 0.012 : 0));
  const c = v3();
  const t = v3();
  const n = v3();
  const w = v3();
  const at = (u: number, out: V3) => {
    const a = 0.5 - sg * (0.008 + 0.075 * u ** 1.15);
    const p = P_BOW - 0.08 - (P_BOW - 0.08 - 0.42) * u;
    return upperPoint(a, p, -(0.0045 + 0.006 * (1 - u) ** 2), out);
  };
  return gridGeometry(
    N,
    K,
    (i, k, out) => {
      const u = (i / N) * end;
      at(u, c);
      at(Math.min(1, u + 0.01), t).sub(at(Math.max(0, u - 0.01), n)).normalize();
      const a = 0.5 - sg * (0.008 + 0.075 * u ** 1.15);
      const p = P_BOW - 0.08 - (P_BOW - 0.08 - 0.42) * u;
      upperNormal(a, p, n);
      w.crossVectors(n, t).normalize();
      const q = (k / K) * 2 - 1;
      const hw = 0.0135 + 0.004 * u;
      out.copy(c).addScaledVector(w, q * hw).addScaledVector(n, 0.0018 * (1 - q * q));
      if (i === N) out.addScaledVector(t, -(0.016 * (1 - Math.abs(q)) + cut[k]!));
    },
    (i, k) => [(i / N) * 0.4, (k / K) * 0.1],
  );
}

/** The whole bow, in the shoe's space: two loops and the knot (placed on the toe) and the tails. */
function bowGeometry(haunted: boolean) {
  const f = bowFrame();
  const loops = [loopGeometry(1, haunted), loopGeometry(-1, haunted)];
  const knot = new THREE.SphereGeometry(1, 16, 12);
  knot.scale(0.0125, 0.0165, 0.0105);
  knot.translate(0, 0, 0.005);
  // big: the loops together about as wide as the toe
  const placed = [...loops, knot].map((g) => g.scale(BOW_S, BOW_S, BOW_S * 0.85).applyMatrix4(f));
  return merge([...placed, tailGeometry(1, haunted), tailGeometry(-1, haunted)]);
}

/** The bell's frame: hanging against the toe below the knot, its top toward the knot. */
const bellFrame = once(() => {
  const n = upperNormal(0.5, P_BELL, v3());
  const at = upperPoint(0.5, P_BELL, 0, v3()).addScaledVector(n, BELL_R + 0.0015);
  const knot = v3().setFromMatrixPosition(bowFrame());
  const y = knot.clone().sub(at).normalize();
  const z = n.clone().addScaledVector(y, -n.dot(y)).normalize();
  const x = v3().crossVectors(y, z);
  return { m: new THREE.Matrix4().makeBasis(x, y, z).setPosition(at), at, knot };
});

/** The jingle bell in gold: the ball, the seam round it, the ring at its top and the cord to the knot. */
function bellGoldGeometry() {
  const { m, at, knot } = bellFrame();
  const ball = new THREE.SphereGeometry(BELL_R, 22, 16);
  const seam = new THREE.TorusGeometry(BELL_R * 1.005, 0.0009, 6, 32);
  seam.rotateX(Math.PI / 2);
  const ringTop = new THREE.TorusGeometry(0.0034, 0.0011, 6, 14);
  ringTop.rotateY(Math.PI / 2);
  ringTop.translate(0, BELL_R + 0.0025, 0);
  const body = [ball, seam, ringTop].map((g) => g.applyMatrix4(m));
  const top = v3(0, BELL_R + 0.005, 0).applyMatrix4(m);
  const mid = top.clone().lerp(knot, 0.5).addScaledVector(v3().subVectors(at, knot).cross(v3(0, 0, 1)).normalize(), 0.002);
  const cord = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([top, mid, knot]), 8, 0.0011, 5, false);
  return merge([...body, cord]);
}

/** The bell's slot: a dark slit under it, front to back, with a round hole at each end. */
function bellDarkGeometry() {
  const { m } = bellFrame();
  const slit = new THREE.TorusGeometry(BELL_R * 1.004, 0.0011, 4, 24, Math.PI * 0.9);
  slit.rotateY(Math.PI / 2);
  slit.rotateX(Math.PI + Math.PI * 0.05);
  const holes = [1, -1].map((sd) => {
    const h = new THREE.SphereGeometry(0.0023, 10, 8);
    h.translate(0, -BELL_R * 0.18, sd * BELL_R * 0.96);
    return h;
  });
  return merge([slit, ...holes].map((g) => g.applyMatrix4(m)));
}

/** Where the strap crosses, and how far up the outer side its buckle sits. */
const STRAP_X = -0.07 * SX;
const P_BUCKLE = 0.32;

/** A point on the upper at (a, p) lifted `lift` off it along its normal. */
function onUpper(a: number, p: number, lift: number): V3 {
  return upperPoint(a, p, 0, v3()).addScaledVector(upperNormal(a, p, v3()), lift);
}

/**
 * The strap's centre line: sewn in on the inner side below the frill, over the frill and across
 * the opening in a low arch, over the frill on the outer side and down the outside to the buckle,
 * its end through the buckle and a little past it.
 */
const strapCurve = once(() => {
  const aOut = findA(STRAP_X);
  const aIn = 1 - aOut;
  const pw = wrap(STRAP_X);
  const edge = (a: number) => {
    const [nx, nz] = outlineNormal(a);
    return upperPoint(a, pw, 0, v3()).add(v3(nx * 0.006, 0.012, nz * 0.006));
  };
  const eIn = edge(aIn);
  const eOut = edge(aOut);
  const apex = 0.036 + (eIn.y + eOut.y) / 2;
  return new THREE.CatmullRomCurve3(
    [
      upperPoint(aIn, pw * 0.36, 0.003, v3()),
      onUpper(aIn, pw * 0.5, 0.0035),
      eIn,
      v3(STRAP_X + 0.002, (eIn.y + apex) / 2 + 0.01, eIn.z * 0.55),
      v3(STRAP_X + 0.004, apex, 0),
      v3(STRAP_X + 0.002, (eOut.y + apex) / 2 + 0.01, eOut.z * 0.55),
      eOut,
      onUpper(aOut, pw * 0.62, 0.0055),
      onUpper(aOut, P_BUCKLE, 0.0055),
      onUpper(aOut, P_BUCKLE - 0.17, 0.005),
    ],
    false,
    'centripetal',
  );
});

const STRAP_W = 0.0145;
const STRAP_T = 0.0024;
const AXIS_X = v3(1, 0, 0);

/** The strap's width direction (along the shoe) and thickness direction at t. */
function strapFrame(t: number, p: V3, tan: V3, b: V3, n: V3) {
  const c = strapCurve();
  c.getPointAt(t, p);
  c.getTangentAt(t, tan);
  b.copy(AXIS_X).addScaledVector(tan, -AXIS_X.dot(tan)).normalize();
  n.crossVectors(tan, b);
}

/** The strap: a flat band of velvet with rounded edges, its free end rounded off. */
function strapGeometry() {
  const N = 140;
  const K = 16;
  const p = v3();
  const tan = v3();
  const b = v3();
  const n = v3();
  return gridGeometry(
    N,
    K,
    (i, k, out) => {
      const t = i / N;
      strapFrame(t, p, tan, b, n);
      const ang = (k / K) * TAU;
      const round = t > 0.97 ? Math.sqrt(Math.max(0.02, 1 - ((t - 0.97) / 0.03) ** 2)) : 1;
      out.copy(p).addScaledVector(b, STRAP_W * round * spow(Math.cos(ang), 0.3)).addScaledVector(n, STRAP_T * spow(Math.sin(ang), 0.3));
    },
    (i, k) => [(i / N) * 2.4, k / K / 4],
  );
}

/** Tiny lace along both edges of the strap, where it crosses over the instep. */
function strapLaceGeometry() {
  const N = 150;
  const K = 2;
  const p = v3();
  const tan = v3();
  const b = v3();
  const n = v3();
  const length = strapCurve().getLength();
  return merge(
    [1, -1].map((sd) =>
      gridGeometry(
        N,
        K,
        (i, k, out) => {
          const t = 0.06 + (i / N) * 0.66;
          strapFrame(t, p, tan, b, n);
          const f = k / K;
          out
            .copy(p)
            .addScaledVector(b, sd * (STRAP_W * 0.92 + f * 0.0085))
            .addScaledVector(n, 0.0018 * f * Math.sin((t * length * TAU) / 0.007));
        },
        (i, k) => [((i / N) * 0.66 * length) / 0.0075, k / K],
      ),
    ),
  );
}

/** A rounded square path, for the buckle. */
function roundSquare(path: THREE.Path, h: number, r: number) {
  path.moveTo(-h + r, -h);
  path.lineTo(h - r, -h);
  path.quadraticCurveTo(h, -h, h, -h + r);
  path.lineTo(h, h - r);
  path.quadraticCurveTo(h, h, h - r, h);
  path.lineTo(-h + r, h);
  path.quadraticCurveTo(-h, h, -h, h - r);
  path.lineTo(-h, -h + r);
  path.quadraticCurveTo(-h, -h, -h + r, -h);
}

/** The square buckle on the outer side, the strap through it, and its prong. */
function buckleGeometry() {
  const shape = new THREE.Shape();
  roundSquare(shape, 0.021, 0.006);
  const hole = new THREE.Path();
  roundSquare(hole, 0.0145, 0.003);
  shape.holes.push(hole);
  const frame = new THREE.ExtrudeGeometry(shape, { depth: 0.0026, bevelEnabled: true, bevelThickness: 0.0011, bevelSize: 0.0011, bevelSegments: 2, curveSegments: 6 });
  frame.translate(0, 0, -0.0013);
  const prong = new THREE.CylinderGeometry(0.0015, 0.0015, 0.031, 8);
  prong.translate(0, 0.0015, 0.0012);
  const m = surfaceFrame(findA(STRAP_X), P_BUCKLE, 0.0085);
  return merge([frame, unindexed(prong)].map((g) => g.applyMatrix4(m)));
}

/* ------------------------------------------------------------------------------------------ */
/* Blood                                                                                      */
/* ------------------------------------------------------------------------------------------ */

/** Where the runs come down the toe: just either side of the middle. */
const RUN_DA = [-0.011, 0.014];

/** A run from under the bow's knot, down the front of the toe, over the welt and down to the floor. */
function runCurve(da: number, wig: number): THREE.CatmullRomCurve3 {
  const pts: V3[] = [];
  for (let k = 0; k <= 8; k++) {
    const t = k / 8;
    const p = (P_BOW - 0.12) * (1 - t) + 0.04 * t;
    const a = 0.5 + da * (1 + 0.4 * t) + wig * 0.006 * Math.sin(t * 5.3);
    pts.push(upperPoint(a, p, -0.0034, v3()));
  }
  const a = 0.5 + da * 1.4;
  const [ox, oz] = outline(a);
  const [nx, nz] = outlineNormal(a);
  const yT = soleTop(ox);
  const at = (out: number, y: number) => v3(ox + nx * out, y, oz + nz * out);
  pts.push(at(WELT * 0.6, yT + 0.0022), at(WELT + 0.0028, yT - 0.004), at(WELT + 0.003, soleBot(ox) + 0.004), at(WELT + 0.006, 0.0015));
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
}

const runCurves = once(() => RUN_DA.map((da, i) => runCurve(da, i ? -1 : 1)));

/** Old drops dried on the floor in front of the toe, a bigger one under each run. */
function driedDropsGeometry() {
  const r = seeded(433);
  const parts: THREE.BufferGeometry[] = [];
  const add = (x: number, z: number, rad: number, stretch: number) => {
    const d = new THREE.SphereGeometry(rad, 14, 6);
    d.scale(stretch, 0.16, 1);
    d.translate(x, rad * 0.06, z);
    parts.push(d);
  };
  runCurves().forEach((c) => {
    const p = c.getPointAt(1);
    add(p.x + 0.004, p.z, 0.009, 1.3);
  });
  for (let i = 0; i < 6; i++) {
    const d = 0.02 + r() * 0.05;
    const ang = (r() - 0.5) * 1.1;
    add(L2 + WELT + d * Math.cos(ang), d * Math.sin(ang) * 1.3, 0.0028 + r() * 0.005, 1 + r() * 0.4);
  }
  return merge(parts);
}

/* ------------------------------------------------------------------------------------------ */
/* Painted textures                                                                           */
/* ------------------------------------------------------------------------------------------ */

/** One scallop of the lace (alpha): a round crest with picots, a cut-work flower, eyelets, a net. */
const laceTexture = once(() => {
  const w = 256;
  const h = 128;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(0, h * 0.4);
    g.bezierCurveTo(w * 0.12, h * 0.02, w * 0.88, h * 0.02, w, h * 0.4);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.closePath();
    g.fill();
    for (const x of [0.3, 0.5, 0.7]) {
      g.beginPath();
      g.arc(w * x, h * (x === 0.5 ? 0.08 : 0.13), 6, 0, TAU);
      g.fill();
    }
    g.fillStyle = '#000';
    const fx = w * 0.5;
    const fy = h * 0.44;
    for (let k = 0; k < 6; k++) {
      const t = (k / 6) * TAU;
      g.beginPath();
      g.ellipse(fx + Math.cos(t) * 15, fy + Math.sin(t) * 11, 9, 4.5, t, 0, TAU);
      g.fill();
    }
    g.beginPath();
    g.arc(fx, fy, 3.5, 0, TAU);
    g.fill();
    for (let k = 0; k < 7; k++) {
      const t = (k + 1) / 8;
      g.beginPath();
      g.arc(w * t, h * (0.4 - 0.33 * Math.sin(Math.PI * t)) + 11, 3.2, 0, TAU);
      g.fill();
    }
    for (let row = 0; row < 2; row++)
      for (let k = 0; k < 9; k++) {
        const x = (k + (row % 2) * 0.5) * (w / 9) + 6;
        const y = h * 0.7 + row * 13;
        g.beginPath();
        g.moveTo(x, y - 5);
        g.lineTo(x + 5, y);
        g.lineTo(x, y + 5);
        g.lineTo(x - 5, y);
        g.closePath();
        g.fill();
      }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
});

const WEAR_W = 2048;
const WEAR_H = 256;
const U = (a: number) => a * WEAR_W;
const Vy = (v: number) => (1 - v) * WEAR_H;

/** An irregular round outline, for patches and holes. */
function blobPath(r: () => number, cx: number, cy: number, rx: number, ry: number, jag: number): [number, number][] {
  const ph = r() * TAU;
  const ph2 = r() * TAU;
  return Array.from({ length: 36 }, (_, i) => {
    const th = (i / 36) * TAU;
    const k = 0.72 + 0.18 * Math.sin(3 * th + ph) + 0.1 * Math.sin(7 * th + ph2) + jag * (r() - 0.5);
    return [cx + Math.cos(th) * rx * k, cy + Math.sin(th) * ry * k];
  });
}

function trace(g: CanvasRenderingContext2D, pts: [number, number][]) {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
}

/** Velvet worn through to the leather under it: pale, cracked, flaking, frayed fibres round it. */
function wornPatch(g: CanvasRenderingContext2D, r: () => number, a: number, v: number, ra: number, rv: number) {
  const cx = U(a);
  const cy = Vy(v);
  const rx = ra * WEAR_W;
  const ry = rv * WEAR_H;
  const pts = blobPath(r, cx, cy, rx, ry, 0.16);
  trace(g, pts);
  g.lineWidth = 9;
  g.strokeStyle = 'rgba(46,14,12,0.55)';
  g.stroke();
  const fill = g.createRadialGradient(cx, cy, 2, cx, cy, Math.max(rx, ry));
  fill.addColorStop(0, '#c6b08c');
  fill.addColorStop(0.7, '#ad9571');
  fill.addColorStop(1, '#8f7656');
  trace(g, pts);
  g.fillStyle = fill;
  g.fill();
  g.save();
  trace(g, pts);
  g.clip();
  g.strokeStyle = 'rgba(58,42,28,0.85)';
  g.lineCap = 'round';
  for (let i = 0, n = Math.max(30, Math.round((rx * ry) / 110)); i < n; i++) {
    let x = cx + (r() - 0.5) * rx * 2;
    let y = cy + (r() - 0.5) * ry * 2;
    let dir = r() * TAU;
    g.lineWidth = 0.8 + r() * 1.4;
    g.beginPath();
    g.moveTo(x, y);
    const n = 4 + Math.floor(r() * 6);
    for (let k = 0; k < n; k++) {
      dir += (r() - 0.5) * 1.2;
      const l = 5 + r() * 12;
      x += Math.cos(dir) * l;
      y += Math.sin(dir) * l;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < 50; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(70,52,36,0.5)' : 'rgba(226,212,186,0.45)';
    g.fillRect(cx + (r() - 0.5) * rx * 2, cy + (r() - 0.5) * ry * 2, 1 + r() * 3, 1 + r() * 2);
  }
  g.restore();
  g.strokeStyle = 'rgba(60,18,16,0.8)';
  g.lineWidth = 1;
  for (const [x, y] of pts) {
    const th = Math.atan2(y - cy, x - cx);
    const l = 3 + r() * 6;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x - Math.cos(th) * l, y - Math.sin(th) * l);
    g.stroke();
  }
}

/** The hole torn in the toe: a ragged rim of torn leather round the dark inside, threads across it. */
function tornHole(g: CanvasRenderingContext2D, r: () => number, a: number, v: number, rad: number) {
  const cx = U(a);
  const cy = Vy(v);
  trace(g, blobPath(r, cx, cy, rad * 1.35, rad * 1.25, 0.3));
  g.fillStyle = '#9c8461';
  g.fill();
  const inner = g.createRadialGradient(cx, cy - rad * 0.2, 1, cx, cy, rad);
  inner.addColorStop(0, '#050303');
  inner.addColorStop(0.75, '#0f0907');
  inner.addColorStop(1, '#24170f');
  trace(g, blobPath(r, cx, cy, rad, rad * 0.9, 0.35));
  g.fillStyle = inner;
  g.fill();
  g.strokeStyle = 'rgba(150,128,96,0.7)';
  g.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const t = r() * TAU;
    g.beginPath();
    g.moveTo(cx + Math.cos(t) * rad, cy + Math.sin(t) * rad);
    g.quadraticCurveTo(cx + (r() - 0.5) * rad, cy + r() * rad * 0.6, cx + Math.cos(t + 2.5) * rad * 0.9, cy + Math.sin(t + 2.5) * rad * 0.9);
    g.stroke();
  }
}

/** A dried run of blood down the toe, from under the bow to the sole, a drop at its foot. */
function driedRun(g: CanvasRenderingContext2D, r: () => number, a: number, vTop: number, vEnd: number, w: number) {
  g.fillStyle = 'rgba(44,4,7,0.92)';
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const v = vTop + (vEnd - vTop) * t;
    const x = U(a + 0.004 * Math.sin(t * 7 + r() * 0.2));
    g.beginPath();
    g.arc(x, Vy(v), w * (1 - 0.45 * t) + 0.5, 0, TAU);
    g.fill();
  }
  g.beginPath();
  g.ellipse(U(a), Vy(vEnd) + w, w * 1.6, w * 2.2, 0, 0, TAU);
  g.fill();
}

/**
 * What the years did to the velvet, painted over the upper after the Reveal: grime round the
 * bottom, dust, the toes worn through to cracked leather (the same on both sides of the toe, so
 * it meets over the top), dried blood down the front from the bow, and, on the right shoe, a hole.
 */
function wearTexture(holed: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = WEAR_W;
  c.height = WEAR_H;
  const g = c.getContext('2d');
  if (g) {
    const r = seeded(holed ? 311 : 207);
    const grime = g.createLinearGradient(0, WEAR_H, 0, Vy(0.3));
    grime.addColorStop(0, 'rgba(26,17,11,0.75)');
    grime.addColorStop(0.5, 'rgba(30,20,13,0.3)');
    grime.addColorStop(1, 'rgba(30,20,13,0)');
    g.fillStyle = grime;
    g.fillRect(0, Vy(0.3), WEAR_W, WEAR_H - Vy(0.3));
    for (let i = 0; i < 160; i++) {
      // dirt, brown rather than grey (grey on red reads pink)
      g.fillStyle = `rgba(${44 + Math.floor(r() * 26)},30,20,${0.1 + r() * 0.14})`;
      g.beginPath();
      g.arc(r() * WEAR_W, r() * WEAR_H * 0.8, 6 + r() * 26, 0, TAU);
      g.fill();
    }
    for (const flip of [false, true]) {
      g.save();
      if (flip) {
        g.translate(WEAR_W, 0);
        g.scale(-1, 1);
      }
      const rr = seeded(holed ? 41 : 29);
      wornPatch(g, rr, 0.425, 0.58, 0.05, 0.3);
      wornPatch(g, rr, 0.468, 0.93, 0.034, 0.13);
      g.restore();
    }
    // the toe cap, scuffed right through where a crawling baby drags it
    wornPatch(g, r, 0.5, 0.36, 0.07, 0.3);
    wornPatch(g, r, holed ? 0.03 : 0.97, 0.3, 0.035, 0.22);
    if (holed) tornHole(g, r, 0.548, 0.46, 44);
    RUN_DA.forEach((da, i) => driedRun(g, r, 0.5 + da * 1.2, (P_BOW - 0.14) / (Math.PI / 2), 0.02 + i * 0.06, 4 - i));
    // a dark stain under the bell, where it has dripped longest
    g.fillStyle = 'rgba(40,6,8,0.55)';
    trace(g, blobPath(r, U(0.5), Vy(0.6), 26, 24, 0.2));
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* ------------------------------------------------------------------------------------------ */
/* Materials                                                                                  */
/* ------------------------------------------------------------------------------------------ */

const P = {
  /*
   * Deep Christmas red velvet. The sheen is a darker, saturated red (a pale one reads pink at the
   * grazing angles of a low camera); after the Reveal a dirty dark red-brown, barely greyed or
   * dusted (grey dust on red reads pink too).
   */
  velvet: () =>
    soft(mat('shoeVelvet', {
      surface: 'fabric',
      color: '#7a0812',
      roughness: 0.78,
      sheen: 0.85,
      sheenColor: '#b3141f',
      hauntedColor: '#4a1410',
      decay: { age: 0.12, dust: 0.12 },
    })),
  /** The bows and strap: thin ribbon, seen from both sides; ragged after the Reveal. */
  ribbon: () =>
    soft(mat('shoeRibbon', {
      surface: 'fabric',
      color: '#7e0913',
      roughness: 0.74,
      sheen: 0.85,
      sheenColor: '#b8151f',
      side: THREE.DoubleSide,
      hauntedColor: '#2a0a0a',
      decay: { age: 0.1, dust: 0.1, tear: 0.16 },
    })),
  lining: () => mat('shoeLining', { surface: 'leather', color: '#d9bf98', roughness: 0.65, side: THREE.BackSide, hauntedColor: '#5f4e3d', decay: { age: 0.6, dust: 0.6 } }),
  insole: () => mat('shoeInsole', { surface: 'leather', color: '#cfae84', roughness: 0.6, hauntedColor: '#574634', decay: { age: 0.6, dust: 0.8 } }),
  sole: () =>
    mat('shoeSole', { surface: 'leather', color: '#6a3f26', roughness: 0.45, clearcoat: 0.35, hauntedColor: '#2c2119', matte: 1, decay: { age: 0.8, dust: 0.7 } }),
  thread: () => mat('shoeThread', { surface: 'fabric', color: '#f1e6cf', roughness: 0.7, sheen: 0.5, hauntedColor: '#7c7466', decay: { age: 0.5, dust: 0.5 } }),
  lace: () => withLace(mat('shoeLace', { color: '#f3eadb', roughness: 0.9, sheen: 0.4, side: THREE.DoubleSide, hauntedColor: '#857c70', decay: { tear: 0.35, dust: 0.6, age: 0.6 } })),
};

/** Velvet has almost no mirror shine: only a weak, red-tinted reflection, so it never goes pink. */
function soft(m: THREE.MeshPhysicalMaterial): THREE.MeshPhysicalMaterial {
  if (m.specularIntensity !== 0.35) {
    m.specularIntensity = 0.35;
    m.specularColor.set('#c23a3a');
  }
  return m;
}

/** Outside the components, so the React compiler rules see no mutation of a hook value. */
function withLace(m: THREE.MeshPhysicalMaterial): THREE.MeshPhysicalMaterial {
  if (!m.alphaMap) {
    m.alphaMap = laceTexture();
    m.alphaTest = 0.5;
    m.needsUpdate = true;
  }
  return m;
}

const wearMaterials = new Map<boolean, THREE.MeshStandardMaterial>();
function wearMaterial(holed: boolean): THREE.MeshStandardMaterial {
  let m = wearMaterials.get(holed);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: wearTexture(holed), transparent: true, opacity: 0, roughness: 0.88, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    wearMaterials.set(holed, m);
  }
  return m;
}

/** Old blood, dried dark on the floor. */
const driedMaterial = once(() => new THREE.MeshStandardMaterial({ color: '#2a0305', roughness: 0.5, metalness: 0 }));

/*
 * Fresh blood: wet, glossy and nearly black-red. No clearcoat (its reflection goes white at the
 * grazing angle the floor is seen at, and white over dark red is pink); the shine is the
 * material's own specular, tinted red and weak at grazing angles (specularIntensity also caps
 * the Fresnel edge), so the highlights are dark red, never pale.
 */
const freshMaterial = once(
  () => new THREE.MeshPhysicalMaterial({ color: '#3a0206', roughness: 0.2, specularIntensity: 0.5, specularColor: new THREE.Color('#ff3a3a') }),
);
const poolMaterial = once(
  () =>
    new THREE.MeshPhysicalMaterial({
      color: '#2c0104',
      roughness: 0.16,
      specularIntensity: 0.32,
      specularColor: new THREE.Color('#ff2a2a'),
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
);

const cobwebMaterial = once(() => new THREE.LineBasicMaterial({ color: '#d6cfc2', transparent: true, opacity: 0, depthWrite: false }));

/** Shown in step with the Reveal's decay. */
function fadeWithDecay(m: THREE.Material, max: number) {
  const o = max * decayUniforms.uDecay.value;
  m.opacity = o;
  m.visible = o > 0.004;
}

/* ------------------------------------------------------------------------------------------ */
/* The pair                                                                                   */
/* ------------------------------------------------------------------------------------------ */

type Spec = { pos: [number, number, number]; ry: number; mirror: boolean; holed: boolean; seed: number; delay: number };

/** The left shoe in front, its buckle toward you; the right one a little behind and to the right. */
const SHOES: Spec[] = [
  { pos: [-0.15, 0, 0.07], ry: -2.25, mirror: false, holed: false, seed: 3, delay: 0 },
  { pos: [0.2, 0, 0.005], ry: -2.12, mirror: true, holed: true, seed: 8, delay: 0.3 },
];
/** The pair is tipped toward you a little, so you look into the shoes, and lifted back onto the floor. */
const ROOT_TILT = 0.32;
const ROOT_LIFT = 0.085;

const shoeMatrix = (s: Spec) =>
  new THREE.Matrix4().compose(v3(...s.pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s.ry, 0)), v3(1, 1, s.mirror ? -1 : 1));

const parts = once(() => ({
  sole: soleGeometry(),
  upper: upperGeometry(0, false),
  lining: upperGeometry(LINING, false),
  wear: upperGeometry(-0.0012, true),
  insole: insoleGeometry(),
  binding: bindingGeometry(),
  stitches: stitchGeometry(),
  snowflake: snowflakeGeometry(),
  bellGold: bellGoldGeometry(),
  bellDark: bellDarkGeometry(),
  strap: strapGeometry(),
  strapLace: strapLaceGeometry(),
  buckle: buckleGeometry(),
  dried: driedDropsGeometry(),
}));
const ruffles = [once(() => ruffleGeometry(false)), once(() => ruffleGeometry(true))] as const;
const bows = [once(() => bowGeometry(false)), once(() => bowGeometry(true))] as const;

/** The tip of the frill at s round the opening, in the pair's space. */
function frillTip(s: number, m: THREE.Matrix4): V3 {
  return collarPoint(s, LINING * 0.5, v3()).addScaledVector(frillDir(s, v3()), RUFFLE_W * 0.7).applyMatrix4(m);
}

/**
 * Cobwebs (lines, in the pair's space): a web across each opening, spokes from the frill to the
 * middle and broken rings round them, and sagging threads from the right shoe's frill to the left's.
 */
const cobwebGeometry = once(() => {
  const r = seeded(613);
  const seg: number[] = [];
  const line = (a: V3, b: V3, sag: number, n = 6) => {
    let prev = a;
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const p = a.clone().lerp(b, t);
      p.y -= sag * 4 * t * (1 - t);
      seg.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
      prev = p;
    }
  };
  const mats = SHOES.map(shoeMatrix);
  mats.forEach((m, si) => {
    const centre = v3();
    for (let k = 0; k < 24; k++) centre.add(collarPoint(k / 24, 0, v3()));
    centre.multiplyScalar(1 / 24).add(v3(-0.01, -0.006, 0)).applyMatrix4(m);
    const NS = 11;
    const spokes = Array.from({ length: NS }, (_, k) => frillTip((k + 0.5 + (r() - 0.5) * 0.3) / NS, m));
    spokes.forEach((p, k) => {
      if (si === 1 && k === 3) return;
      line(centre, p, 0.004 + r() * 0.004);
    });
    for (const f of [0.2, 0.36, 0.52, 0.68, 0.84]) {
      for (let k = 0; k < NS; k++) {
        if (r() < 0.18) continue;
        line(centre.clone().lerp(spokes[k]!, f), centre.clone().lerp(spokes[(k + 1) % NS]!, f), 0.0015 + 0.002 * f, 3);
      }
    }
  });
  // from one shoe to the other: the right shoe's frill nearest the left shoe, to the left shoe's
  const back = Array.from({ length: 48 }, (_, i) => frillTip(i / 48, mats[1]!));
  const front = Array.from({ length: 48 }, (_, i) => frillTip(i / 48, mats[0]!));
  const near = back
    .map((p, i) => {
      let best = front[0]!;
      for (const q of front) if (q.distanceTo(p) < best.distanceTo(p)) best = q;
      return { i, p, q: best, d: best.distanceTo(p) };
    })
    .sort((x, y) => x.d - y.d);
  const used: number[] = [];
  const strands: { p: V3; q: V3 }[] = [];
  for (const n of near) {
    if (strands.length >= 7) break;
    if (used.some((u) => Math.abs(u - n.i) < 3)) continue;
    used.push(n.i);
    strands.push(n);
    line(n.p, n.q, 0.012 + r() * 0.014, 8);
  }
  for (let k = 0; k + 1 < strands.length; k++) {
    const a = strands[k]!;
    const b = strands[k + 1]!;
    for (const t of [0.35, 0.62]) line(a.p.clone().lerp(a.q, t).add(v3(0, -0.01, 0)), b.p.clone().lerp(b.q, t).add(v3(0, -0.01, 0)), 0.003, 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
  return g;
});

/* ------------------------------------------------------------------------------------------ */
/* The Take                                                                                   */
/* ------------------------------------------------------------------------------------------ */

const POOL_AT = 0.15;
const POOL_DUR = 3.75;
const RUN_AT = [0.3, 0.55];
const RUN_DUR = 1.5;
const DRIP_EVERY = 0.9;
/** The drops stop by here (seconds after the Take, for each shoe's own clock). */
const DRIP_END = 5.8;
/** Where a drop hangs on the welt, as a share of the way along its run. */
const HANG_K = 0.93;
/** Keep the shelf canvas drawing until the Take is over (it otherwise draws on demand). */
const TAKE_END = 6.4;

/** Rings of the pool, from under the sole out to its edge: [fixed offset, share of the spread, height]. */
const POOL_RINGS: [number, number, number][] = [
  [-0.035, 0, 1],
  [WELT * 0.5, 0, 1],
  [WELT, 0.55, 1],
  [WELT, 0.84, 0.93],
  [WELT, 0.95, 0.62],
  [WELT, 1, 0.04],
];
const POOL_N = 144;

type Pool = { geo: THREE.BufferGeometry; base: Float32Array; reach: Float32Array; lag: Float32Array };

/** The pool under one shoe: its outline round the sole, how far it gets at each point and how late. */
function makePool(seed: number): Pool {
  const n1 = wobble(seed * 7 + 1, 6);
  const n2 = wobble(seed * 13 + 5, 4);
  const base = new Float32Array((POOL_N + 1) * 4);
  const reach = new Float32Array(POOL_N + 1);
  const lag = new Float32Array(POOL_N + 1);
  for (let i = 0; i <= POOL_N; i++) {
    const a = i / POOL_N;
    const [ox, oz] = outline(a);
    const [nx, nz] = outlineNormal(a);
    base.set([ox, oz, nx, nz], i * 4);
    // further in front, where it also runs down off the toes
    reach[i] = 0.02 + 0.022 * (0.5 + 0.5 * n1(a * TAU)) + 0.035 * Math.max(0, Math.cos(TAU * (a - 0.5))) ** 3;
    lag[i] = 0.45 * (0.5 + 0.5 * n2(a * TAU));
  }
  const g = gridGeometry(
    POOL_N,
    POOL_RINGS.length - 1,
    (_, __, out) => out.set(0, 0, 0),
    (i, j) => [i / POOL_N, j / (POOL_RINGS.length - 1)],
    { flip: true },
  );
  return { geo: g, base, reach, lag };
}

/** Wells out from under the sole: fast at first, then creeping, each part of the edge at its own pace. */
function shapePool(p: Pool, t: number) {
  const pos = p.geo.attributes.position as THREE.BufferAttribute;
  const rows = POOL_RINGS.length;
  for (let i = 0; i <= POOL_N; i++) {
    const ox = p.base[i * 4]!;
    const oz = p.base[i * 4 + 1]!;
    const nx = p.base[i * 4 + 2]!;
    const nz = p.base[i * 4 + 3]!;
    const k = t === Infinity ? 1 : clamp01((t - POOL_AT - p.lag[i]!) / POOL_DUR);
    const d = p.reach[i]! * (1 - (1 - k) ** 2.3);
    const h = 0.0024 + 0.0018 * Math.min(1, d / 0.03);
    POOL_RINGS.forEach(([off, share, hk], j) => {
      const o = off + share * d;
      pos.setXYZ(i * rows + j, ox + nx * o, h * hk, oz + nz * o);
    });
  }
  pos.needsUpdate = true;
  p.geo.computeVertexNormals();
  p.geo.computeBoundingSphere();
}

type Run = { curve: THREE.CatmullRomCurve3; geo: THREE.TubeGeometry; radius: number; at: number };

/** A drop's place along its run at t: sliding down, hanging and swelling at the welt, falling. */
function dropAt(t: number, start: number): { k: number; s: number; on: boolean } {
  if (t === Infinity) return { k: HANG_K, s: 1, on: true };
  const e = t - start;
  if (e < 0) return { k: 0, s: 1, on: false };
  const cycles = Math.max(1, Math.floor((DRIP_END - start) / DRIP_EVERY));
  if (e >= cycles * DRIP_EVERY) return { k: HANG_K, s: 1, on: true };
  const ph = (e % DRIP_EVERY) / DRIP_EVERY;
  if (ph < 0.55) return { k: 0.45 + (HANG_K - 0.45) * (ph / 0.55) ** 2, s: 0.8, on: true };
  if (ph < 0.85) return { k: HANG_K, s: 0.8 + 0.4 * ((ph - 0.55) / 0.3), on: true };
  return { k: HANG_K + (1 - HANG_K) * ((ph - 0.85) / 0.15) ** 2, s: 1.1, on: ph < 0.98 };
}

/** The runs grow down the toe at a steady pace, a bead at their front; then the drops. */
function stepRuns(runs: Run[], t: number, beads: (THREE.Mesh | null)[], drops: (THREE.Mesh | null)[]) {
  runs.forEach((r, i) => {
    const k = t === Infinity ? 1 : clamp01((t - r.at) / RUN_DUR);
    const { tubularSegments, radialSegments } = r.geo.parameters;
    r.geo.setDrawRange(0, Math.floor(tubularSegments * k) * radialSegments * 6);
    const b = beads[i];
    if (b) {
      b.visible = k > 0 && k < 1;
      if (b.visible) r.curve.getPointAt(k, b.position);
    }
    const d = drops[i];
    if (!d) return;
    const st = dropAt(t, r.at + RUN_DUR + i * 0.4);
    d.visible = st.on;
    if (!st.on) return;
    r.curve.getPointAt(Math.min(1, st.k), d.position);
    d.scale.set(st.s, st.s * 1.25, st.s);
  });
}

/** One shoe's share of the Take: the pool under it and the blood running from its bow. */
function ShoeTake({ since, spec }: { since: () => number; spec: Spec }) {
  const pool = useMemo(() => makePool(spec.seed), [spec.seed]);
  const runs = useMemo<Run[]>(
    () =>
      runCurves().map((curve, i) => ({
        curve,
        geo: new THREE.TubeGeometry(curve, 110, i ? 0.0024 : 0.003, 6, false),
        radius: i ? 0.0024 : 0.003,
        at: RUN_AT[i] ?? 0.3,
      })),
    [],
  );
  useEffect(
    () => () => {
      pool.geo.dispose();
      runs.forEach((r) => r.geo.dispose());
    },
    [pool, runs],
  );
  const beads = useRef<(THREE.Mesh | null)[]>([]);
  const drops = useRef<(THREE.Mesh | null)[]>([]);
  useFrame((st) => {
    const s = since();
    if (s < 0) return;
    const t = s === Infinity ? Infinity : s - spec.delay;
    shapePool(pool, t);
    stepRuns(runs, t, beads.current, drops.current);
    if (s !== Infinity && s < TAKE_END) st.invalidate();
  });
  return (
    <group userData={{ extra: true }}>
      <mesh geometry={pool.geo} material={poolMaterial()} />
      {runs.map((r, i) => (
        <group key={i}>
          <mesh geometry={r.geo} material={freshMaterial()} />
          <mesh
            ref={(m) => {
              beads.current[i] = m;
            }}
            material={freshMaterial()}
            visible={false}
          >
            <sphereGeometry args={[r.radius * 1.35, 10, 8]} />
          </mesh>
          <mesh
            ref={(m) => {
              drops.current[i] = m;
            }}
            material={freshMaterial()}
            visible={false}
          >
            <sphereGeometry args={[r.radius * 1.7, 12, 10]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Components                                                                                 */
/* ------------------------------------------------------------------------------------------ */

/** The years on the velvet, coming in with the Reveal's decay. */
function Wear({ holed }: { holed: boolean }) {
  const m = wearMaterial(holed);
  useFrame(() => fadeWithDecay(m, 1));
  return <mesh geometry={parts().wear} material={m} />;
}

function Cobwebs() {
  const m = cobwebMaterial();
  useFrame(() => fadeWithDecay(m, 0.45));
  return <lineSegments geometry={cobwebGeometry()} material={m} />;
}

function Shoe({ spec, haunted, taken, since }: { spec: Spec; haunted: boolean; taken: boolean; since: () => number }) {
  const g = parts();
  const k = haunted ? 1 : 0;
  return (
    <group position={spec.pos} rotation-y={spec.ry} scale={[1, 1, spec.mirror ? -1 : 1]}>
      <mesh geometry={g.sole} material={P.sole()} />
      <mesh geometry={g.upper} material={P.velvet()} />
      <mesh geometry={g.lining} material={P.lining()} />
      <mesh geometry={g.insole} material={P.insole()} />
      <mesh geometry={g.binding} material={P.velvet()} />
      <mesh geometry={ruffles[k]()} material={P.lace()} />
      <mesh geometry={g.stitches} material={P.thread()} />
      <mesh geometry={g.snowflake} material={P.thread()} />
      <mesh geometry={bows[k]()} material={P.ribbon()} />
      <mesh geometry={g.bellGold} material={M.brass()} />
      <mesh geometry={g.bellDark} material={M.ink()} />
      <mesh geometry={g.strap} material={P.ribbon()} />
      <mesh geometry={g.strapLace} material={P.lace()} />
      <mesh geometry={g.buckle} material={M.gilt()} />
      {haunted && <Wear holed={spec.holed} />}
      {haunted && (
        <group userData={{ extra: true }}>
          <mesh geometry={g.dried} material={driedMaterial()} />
        </group>
      )}
      {taken && <ShoeTake since={since} spec={spec} />}
    </group>
  );
}

export default function Shoes() {
  const haunted = useHaunted();
  const { taken, since } = useTaken('shoes');
  return (
    <group position-y={-0.62 + ROOT_LIFT} rotation-x={ROOT_TILT}>
      {SHOES.map((spec) => (
        <Shoe key={spec.seed} spec={spec} haunted={haunted} taken={taken} since={since} />
      ))}
      {haunted && <Cobwebs />}
    </group>
  );
}
