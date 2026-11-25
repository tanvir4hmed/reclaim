import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { reducedMotion } from '../../director/runtime';
import { useFx } from '../../fx/fxStore';
import { useCanvasTexture } from '../../gl/canvasTex';
import { mat } from '../../gl/decay';
import { M } from '../../gl/materials';
import { progress, useTaken } from '../../gl/useTaken';
import { useHaunted } from '../../store';

const V3 = THREE.Vector3;

/*
 * A 1940s desk telephone in black bakelite, the squat German kind: a near-square body with
 * rounded edges on a flared base, a big finger-wheel dial on the sloped front, a cradle ridge
 * on top with two horned forks, a chunky handset with round cups, and braided cloth cords.
 */

/** Glossy black bakelite; after the Reveal duller, dusty on top, its shine gone. */
const BAKELITE = () =>
  mat('w48Bakelite', {
    surface: 'ceramic',
    color: '#0a0908',
    roughness: 0.13,
    clearcoat: 1,
    hauntedColor: '#16140f',
    matte: 0.55,
    decay: { dust: 0.6, age: 0.3 },
    side: THREE.DoubleSide,
  });
/** The braided cloth cords; after the Reveal greyed and frayed through in places. */
const CORD = () =>
  mat('w48Cord', {
    surface: 'fabric',
    color: '#161412',
    roughness: 0.7,
    sheen: 0.5,
    sheenColor: '#6a6058',
    hauntedColor: '#2b2621',
    matte: 1,
    decay: { tear: 0.42, dust: 0.45, age: 0.3 },
    side: THREE.DoubleSide,
  });
/** The cream button on the front; yellowed after the Reveal. */
const CREAM = () =>
  mat('w48Cream', { surface: 'ceramic', color: '#eee4cc', roughness: 0.28, clearcoat: 0.7, hauntedColor: '#b39a63', decay: { age: 0.5, dust: 0.35 } });

/** A small seeded generator (no Math.random in models). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// ---------------------------------------------------------------------------------------------
// The body: horizontal rounded-rectangle sections lofted from the base to the rounded top.

/** The table the telephone stands on (the base's underside). */
const TABLE_Y = -0.62;
/** The body's bottom (on the base), where its top rounding starts, and how big that rounding is. */
const Y0 = -0.585;
const YS = -0.12;
const RT = 0.07;
const RTY = 0.065;
const TOP_Y = YS + RTY;
/** The front is upright up to YC, then slopes back toward the top (rise : run = 1 : SLOPE). */
const YC = -0.47;
const BLEND = 0.04;
const SLOPE = 0.75;

/** Half width: a little wider at the bottom than at the top. */
const hwAt = (y: number) => 0.37 - 0.04 * clamp01((y - Y0) / (YS - Y0));
const zbAt = (y: number) => -0.345 + 0.035 * clamp01((y - Y0) / (YS - Y0));
/** How far the front has stepped back at height y (a smooth bend from upright to the slope). */
function rampAt(y: number) {
  const d = y - YC;
  if (d < -BLEND) return 0;
  if (d > BLEND) return d;
  return (d + BLEND) ** 2 / (4 * BLEND);
}
const zfAt = (y: number) => 0.35 - SLOPE * rampAt(y);

type Section = { y: number; hw: number; zf: number; zb: number; r: number };

/** The body at height y. Above YS every side curls in on a quarter round to the flat top. */
function bodySection(y: number): Section {
  const q = y > YS ? Math.min(1, (y - YS) / RTY) : 0;
  const off = RT * (1 - Math.sqrt(Math.max(0, 1 - q * q)));
  const yy = Math.min(y, YS);
  const hw = hwAt(yy) - off;
  const zf = zfAt(y) - off;
  const zb = zbAt(yy) + off;
  return { y, hw, zf, zb, r: Math.min(0.12 - off * 0.6, hw - 0.001, (zf - zb) / 2 - 0.001) };
}

const ARC = 8;
const SIDE = 6;
const RING = 4 * (ARC + SIDE) + 1;

/** One rounded-rectangle ring (x, z), starting at the back-left so the seam sits on the flat back. */
function ringXZ(s: Section, out: [number, number][]) {
  const cz = (s.zf + s.zb) / 2;
  const hd = (s.zf - s.zb) / 2;
  const r = Math.max(0.005, s.r);
  const corners: [number, number][] = [
    [-s.hw + r, cz - hd + r],
    [-s.hw + r, cz + hd - r],
    [s.hw - r, cz + hd - r],
    [s.hw - r, cz - hd + r],
  ];
  out.length = 0;
  for (let c = 0; c < 4; c++) {
    const [cx, cc] = corners[c]!;
    const a0 = Math.PI + (c * Math.PI) / 2;
    for (let i = 0; i <= ARC; i++) {
      const a = a0 + (i / ARC) * (Math.PI / 2);
      out.push([cx + Math.sin(a) * r, cc + Math.cos(a) * r]);
    }
    const [nx, nz] = corners[(c + 1) % 4]!;
    const na = a0 + Math.PI / 2;
    const ex = cx + Math.sin(na) * r;
    const ez = cc + Math.cos(na) * r;
    const sx = nx + Math.sin(na) * r;
    const sz = nz + Math.cos(na) * r;
    for (let j = 1; j < SIDE; j++) {
      const t = j / SIDE;
      out.push([ex + (sx - ex) * t, ez + (sz - ez) * t]);
    }
  }
  out.push(out[0]!);
}

/** Lofts the rings into one smooth shell, optionally closed with a flat cap on top. */
function loftGeometry(sections: Section[], cap: boolean) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const ring: [number, number][] = [];
  const ya = sections[0]!.y;
  const yb = sections[sections.length - 1]!.y;
  for (const s of sections) {
    ringXZ(s, ring);
    ring.forEach(([x, z], j) => {
      pos.push(x, s.y, z);
      uv.push((j / (RING - 1)) * 4, ((s.y - ya) / (yb - ya || 1)) * 1.5);
    });
  }
  for (let i = 0; i < sections.length - 1; i++) {
    for (let j = 0; j < RING - 1; j++) {
      const a = i * RING + j;
      const b = a + 1;
      const c = a + RING;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  if (cap) {
    const last = sections[sections.length - 1]!;
    const base = (sections.length - 1) * RING;
    const centre = pos.length / 3;
    pos.push(0, last.y, (last.zf + last.zb) / 2);
    uv.push(2, 1.5);
    for (let j = 0; j < RING - 1; j++) idx.push(centre, base + j, base + j + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function bodyGeometry() {
  const s: Section[] = [];
  for (let i = 0; i <= 30; i++) s.push(bodySection(Y0 + ((YS - Y0) * i) / 30));
  for (let j = 1; j <= 10; j++) s.push(bodySection(YS + RTY * Math.sin((j / 10) * (Math.PI / 2))));
  return loftGeometry(s, true);
}

/** The base plate: flared out past the body, with a rounded lower edge. */
function baseGeometry() {
  return loftGeometry(
    [
      { y: TABLE_Y, hw: 0.404, zf: 0.389, zb: -0.374, r: 0.14 },
      { y: -0.613, hw: 0.412, zf: 0.397, zb: -0.382, r: 0.145 },
      { y: -0.601, hw: 0.41, zf: 0.395, zb: -0.38, r: 0.145 },
      { y: -0.592, hw: 0.395, zf: 0.38, zb: -0.365, r: 0.135 },
      { y: -0.585, hw: 0.375, zf: 0.36, zb: -0.35, r: 0.125 },
      { y: -0.58, hw: 0.36, zf: 0.345, zb: -0.335, r: 0.12 },
    ],
    false,
  );
}

// ---------------------------------------------------------------------------------------------
// The dial on the sloped front.

const DIAL_Y = -0.29;
const DIAL_C = new V3(0, DIAL_Y, zfAt(DIAL_Y));
/** The sloped front's outward normal, and the way up along it. */
const FACE_N = new V3(0, SLOPE, 1).normalize();
const DIAL_UP = new V3(0, 1, -SLOPE).normalize();
const DIAL_TILT = -Math.atan2(FACE_N.y, FACE_N.z);
const PLATE_R = 0.17;
const WHEEL_R = 0.163;
const HOLE_R = 0.0235;
const HOLE_RING = 0.118;
const CARD_R = 0.072;
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
/** 1 at the upper right, then round over the top to 0 at the lower right. */
const holeAngle = (i: number) => ((50 + i * 27.8) * Math.PI) / 180;
/** The finger stop sits in the gap, just past the 0. */
const STOP_A = (-25 * Math.PI) / 180;

/** The finger wheel: a disc with ten finger holes and an open middle for the number card. */
function wheelGeometry() {
  const s = new THREE.Shape();
  s.absarc(0, 0, WHEEL_R, 0, Math.PI * 2, false);
  for (let i = 0; i < 10; i++) {
    const a = holeAngle(i);
    const h = new THREE.Path();
    h.absarc(Math.cos(a) * HOLE_RING, Math.sin(a) * HOLE_RING, HOLE_R, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  const mid = new THREE.Path();
  mid.absarc(0, 0, CARD_R, 0, Math.PI * 2, true);
  s.holes.push(mid);
  return new THREE.ExtrudeGeometry(s, { depth: 0.009, bevelEnabled: true, bevelThickness: 0.0025, bevelSize: 0.0025, bevelSegments: 3, curveSegments: 40 });
}

/** The raised bakelite collar round the dial (a lathe turned to face out of the slope). */
function collarGeometry() {
  const pts = [
    [0.194, -0.006],
    [0.193, 0],
    [0.191, 0.008],
    [0.185, 0.0145],
    [0.177, 0.0155],
    [0.17, 0.012],
    [0.168, 0.006],
    [0.168, 0],
  ].map(([r, h]) => new THREE.Vector2(r, h));
  const g = new THREE.LatheGeometry(pts, 72);
  g.rotateX(Math.PI / 2);
  return g;
}

/** The finger stop: a short steel hook from the collar over the edge of the wheel. */
function stopGeometry() {
  const c = Math.cos(STOP_A);
  const s = Math.sin(STOP_A);
  const p = (r: number, z: number) => new V3(c * r, s * r, z);
  const line = new THREE.CatmullRomCurve3([p(0.19, 0.004), p(0.19, 0.024), p(0.18, 0.031), p(0.152, 0.031), p(0.139, 0.028)]);
  return new THREE.TubeGeometry(line, 24, 0.0055, 8, false);
}

/** The number ring under the wheel: white numerals on black, seen through the finger holes. */
function drawNumbers(g: CanvasRenderingContext2D, w: number, h: number, haunted: boolean) {
  g.fillStyle = haunted ? '#16130f' : '#0c0b0a';
  g.fillRect(0, 0, w, h);
  const c = w / 2;
  const k = w / 2 / PLATE_R;
  g.strokeStyle = haunted ? 'rgba(196,184,152,0.45)' : 'rgba(240,236,228,0.7)';
  g.lineWidth = w * 0.004;
  g.beginPath();
  g.arc(c, c, 0.152 * k, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = haunted ? '#c6b690' : '#f4f0e8';
  g.font = `bold ${Math.round(0.027 * k)}px Arial, Helvetica, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  DIGITS.forEach((t, i) => {
    const a = holeAngle(i);
    // canvas y runs down, the dial's y runs up
    g.fillText(t, c + Math.cos(a) * HOLE_RING * k, c - Math.sin(a) * HOLE_RING * k + 1);
  });
  if (haunted) speckle(g, w, h, 7, 260, 'rgba(110,96,70,0.35)');
}

/** The number card in the middle: deep maroon, a small ring of white numerals round the hub. */
function drawCard(g: CanvasRenderingContext2D, w: number, h: number, haunted: boolean) {
  const c = w / 2;
  const k = w / 2 / CARD_R;
  const grad = g.createRadialGradient(c * 0.85, c * 0.8, w * 0.05, c, c, w * 0.5);
  grad.addColorStop(0, haunted ? '#4a2a36' : '#6a1c40');
  grad.addColorStop(1, haunted ? '#2c1820' : '#3a0c26');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = haunted ? 'rgba(190,178,160,0.5)' : 'rgba(250,246,240,0.8)';
  g.lineWidth = w * 0.008;
  g.beginPath();
  g.arc(c, c, 0.064 * k, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = haunted ? '#b8ab94' : '#fbf8f2';
  g.font = `bold ${Math.round(0.0105 * k)}px Arial, Helvetica, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  DIGITS.forEach((t, i) => {
    const a = holeAngle(i);
    g.fillText(t, c + Math.cos(a) * 0.047 * k, c - Math.sin(a) * 0.047 * k + 1);
  });
  g.fillStyle = '#0b0a09';
  g.beginPath();
  g.arc(c, c, 0.025 * k, 0, Math.PI * 2);
  g.fill();
  if (haunted) {
    // a hairline crack across the card, and grime
    g.strokeStyle = 'rgba(20,12,14,0.8)';
    g.lineWidth = w * 0.006;
    g.beginPath();
    g.moveTo(w * 0.12, h * 0.3);
    g.lineTo(w * 0.34, h * 0.38);
    g.lineTo(w * 0.42, h * 0.33);
    g.lineTo(w * 0.62, h * 0.46);
    g.stroke();
    speckle(g, w, h, 11, 120, 'rgba(90,80,60,0.3)');
  }
}

/** The label in the window at the bottom of the front: the line's number in ink. */
function drawLabel(g: CanvasRenderingContext2D, w: number, h: number, haunted: boolean) {
  g.fillStyle = haunted ? '#c9ae72' : '#f3ead4';
  g.fillRect(0, 0, w, h);
  if (haunted) {
    const stain = g.createRadialGradient(w * 0.7, h * 0.65, 2, w * 0.7, h * 0.65, w * 0.3);
    stain.addColorStop(0, 'rgba(120,80,30,0.45)');
    stain.addColorStop(0.8, 'rgba(120,80,30,0.2)');
    stain.addColorStop(1, 'rgba(120,80,30,0)');
    g.fillStyle = stain;
    g.fillRect(0, 0, w, h);
  }
  g.strokeStyle = haunted ? 'rgba(90,70,40,0.6)' : 'rgba(60,50,40,0.5)';
  g.lineWidth = 2;
  g.strokeRect(5, 5, w - 10, h - 10);
  g.fillStyle = haunted ? '#5a4c36' : '#1d2440';
  g.font = `italic ${Math.round(h * 0.5)}px Georgia, serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('No. 1225', w / 2, h * 0.54);
  if (haunted) speckle(g, w, h, 3, 90, 'rgba(110,70,30,0.35)');
}

/** Fine scratches and scuffs for the worn bakelite (a transparent decal). */
function drawScratches(g: CanvasRenderingContext2D, w: number, h: number) {
  const r = rng(4817);
  for (let i = 0; i < 7; i++) {
    const x = r() * w;
    const y = r() * h;
    const sc = g.createRadialGradient(x, y, 1, x, y, w * (0.06 + r() * 0.08));
    sc.addColorStop(0, 'rgba(170,160,140,0.14)');
    sc.addColorStop(1, 'rgba(170,160,140,0)');
    g.fillStyle = sc;
    g.fillRect(0, 0, w, h);
  }
  g.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const x = r() * w;
    const y = r() * h;
    // most scratches share a couple of directions, like wiping and knocking
    const a = (r() < 0.6 ? 0.35 : 2.1) + (r() - 0.5) * 0.5;
    const len = w * (0.04 + r() * 0.2);
    g.strokeStyle = `rgba(215,205,185,${0.08 + r() * 0.22})`;
    g.lineWidth = 0.6 + r() * 0.9;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + (r() - 0.5) * 6, y + Math.sin(a) * len * 0.5 + (r() - 0.5) * 6, x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
}

function speckle(g: CanvasRenderingContext2D, w: number, h: number, seed: number, n: number, color: string) {
  const r = rng(seed);
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const s = 1 + r() * 2.5;
    g.fillRect(r() * w, r() * h, s, s);
  }
}

// ---------------------------------------------------------------------------------------------
// The handset. Its own frame: +x runs earpiece → mouthpiece, the cups face −y, the handle
// arches up (+y), +z is its side.

const EAR_X = -0.33;
const MOUTH_X = 0.33;
/** The mouthpiece cup is a little larger than the earpiece cup. */
const MOUTH_K = 1.1;
const MOUTH_KY = 1.05;
/** The cup's profile (r, y): from the middle of its face out to the thick rim, then up its wall
 * to the neck inside the handle. */
const CUP: [number, number][] = [
  [0, -0.078],
  [0.062, -0.078],
  [0.067, -0.082],
  [0.073, -0.0875],
  [0.083, -0.089],
  [0.09, -0.085],
  [0.093, -0.077],
  [0.091, -0.063],
  [0.082, -0.044],
  [0.068, -0.024],
  [0.056, -0.006],
  [0.047, 0.01],
  [0.04, 0.03],
];
const FACE_Y = -0.078;
const WALL = CUP.slice(5);

function cupGeometry(k: number, ky: number) {
  return new THREE.LatheGeometry(
    CUP.map(([r, y]) => new THREE.Vector2(r * k, y * ky)),
    44,
  );
}

/** The cup's outer radius at height y (scaled for the mouthpiece by k, ky). */
function cupWallR(y: number, k: number, ky: number) {
  const yy = y / ky;
  for (let i = 0; i < WALL.length - 1; i++) {
    const [r0, y0] = WALL[i]!;
    const [r1, y1] = WALL[i + 1]!;
    if (yy <= y1 || i === WALL.length - 2) {
      const t = clamp01((yy - y0) / (y1 - y0));
      return (r0 + (r1 - r0) * t) * k;
    }
  }
  return WALL[0]![0] * k;
}

/** A point on a cup centred at x = cx: `deg` round it (0 = +x, 90 = +z), `r` out, height y. */
function cupPt(cx: number, deg: number, r: number, y: number) {
  const a = (deg * Math.PI) / 180;
  return new V3(cx + Math.cos(a) * r, y, Math.sin(a) * r);
}

/** The finger holes in the cup faces: a small cluster in the earpiece, a larger one in the mouthpiece. */
const EAR_HOLES: [number, number][] = [[0, 0], ...Array.from({ length: 6 }, (_, i): [number, number] => [Math.cos((i * Math.PI) / 3) * 0.017, Math.sin((i * Math.PI) / 3) * 0.017])];
const MOUTH_HOLES: [number, number][] = [
  [0, 0],
  ...Array.from({ length: 7 }, (_, i): [number, number] => [Math.cos((i / 7) * Math.PI * 2) * 0.021, Math.sin((i / 7) * Math.PI * 2) * 0.021]),
  ...Array.from({ length: 12 }, (_, i): [number, number] => [Math.cos(((i + 0.5) / 12) * Math.PI * 2) * 0.042, Math.sin(((i + 0.5) / 12) * Math.PI * 2) * 0.042]),
];

/** Small black discs on a cup face (facing −y). */
function holesGeometry(holes: [number, number][], r: number, y: number) {
  const pos: number[] = [];
  const n = 10;
  for (const [hx, hz] of holes) {
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2;
      const a1 = ((k + 1) / n) * Math.PI * 2;
      pos.push(hx, y, hz, hx + Math.cos(a0) * r, y, hz + Math.sin(a0) * r, hx + Math.cos(a1) * r, y, hz + Math.sin(a1) * r);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

/** The handle's centre line: a bowed bar from the earpiece cup's back to the mouthpiece cup's. */
const HANDLE = new THREE.CatmullRomCurve3(
  [
    [-0.345, -0.03],
    [-0.3, 0.035],
    [-0.2, 0.075],
    [0, 0.088],
    [0.2, 0.075],
    [0.3, 0.035],
    [0.345, -0.03],
  ].map(([x, y]) => new V3(x, y, 0)),
);
/** The handle's half thickness (in its bend) and half width (across), fuller toward the cups. */
function handleRadius(u: number): [number, number] {
  const e = Math.pow(Math.abs(2 * u - 1), 3);
  return [0.035 * (1 + 0.35 * e), 0.043 * (1 + 0.3 * e)];
}

/**
 * A tube with an elliptical, varying section swept along a curve that lies in a plane of
 * constant z (the handle, the cradle's horns).
 */
function sweepGeometry(curve: THREE.Curve<THREE.Vector3>, segs: number, radial: number, radius: (u: number) => [number, number]) {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const P = new V3();
  const T = new V3();
  const N = new V3();
  const B = new V3(0, 0, 1);
  const n = new V3();
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    curve.getPointAt(u, P);
    curve.getTangentAt(u, T);
    N.crossVectors(B, T).normalize();
    const [rn, rb] = radius(u);
    for (let k = 0; k <= radial; k++) {
      const a = (k / radial) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      pos.push(P.x + N.x * c * rn + B.x * s * rb, P.y + N.y * c * rn + B.y * s * rb, P.z + N.z * c * rn + B.z * s * rb);
      n.copy(N)
        .multiplyScalar(c / rn)
        .addScaledVector(B, s / rb)
        .normalize();
      nor.push(n.x, n.y, n.z);
      uv.push(u * 3, k / radial);
    }
  }
  const ring = radial + 1;
  for (let i = 0; i < segs; i++) {
    for (let k = 0; k < radial; k++) {
      const a = i * ring + k;
      const b = a + 1;
      const d = a + ring;
      const c = d + 1;
      idx.push(a, b, d, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** The handle's curve parameter at a given x along it (x only grows along the handle). */
function handleU(x: number) {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const m = (lo + hi) / 2;
    if (HANDLE.getPointAt(m).x < x) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

/**
 * A point on the handle's skin: `x` along it, `deg` round it (0 = the outside of the bow,
 * 90 = the +z side, 180 = the inside, the side the cups face), `lift` off the surface.
 */
function onHandle(x: number, deg: number, lift: number) {
  const u = handleU(x);
  const p = HANDLE.getPointAt(u);
  const t = HANDLE.getTangentAt(u);
  const n = new V3(-t.y, t.x, 0).normalize();
  const [rn, rb] = handleRadius(u);
  const a = (deg * Math.PI) / 180;
  return p.addScaledVector(n, Math.cos(a) * (rn + lift)).add(new V3(0, 0, Math.sin(a) * (rb + lift)));
}

/** Where the cord leaves the handset: a sleeve on the outer side of the mouthpiece cup's neck. */
const CORD_TO = new V3(0.43, 0, 0);

// ---------------------------------------------------------------------------------------------
// The cradle, the rest and the lifted pose.

/** Where the handset rests across the cradle. */
const REST = new V3(0, 0.08, -0.135);
const HOOK_X = 0.22;
const U_R = 0.064;
const U_TUBE = 0.015;
/** The forks' U hooks: centred so the handle lies in the bottom of each U. */
const HOOK_Y = (() => {
  const u = handleU(HOOK_X);
  return REST.y + HANDLE.getPointAt(u).y + (U_R - U_TUBE - handleRadius(u)[0]);
})();

/** How the whole telephone is turned to the camera: a 3/4 view from the front, dial a little left. */
const ROOT_ROT: [number, number, number] = [0.22, -0.3, 0];
const ROOT_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...ROOT_ROT));
const ROOT_QI = ROOT_Q.clone().invert();
const LIFT_S = 0.75;

/**
 * The lifted pose, worked out in view space (camera on +z) and put in the telephone's own
 * turned frame: right of the body, standing up and leaning about 17° (top to the right and a
 * little back), the cups facing the viewer, the mouthpiece at the height of the dial's top.
 */
function liftedPose() {
  const axis = new V3(0.3, 0.95, -0.12).normalize(); // mouthpiece → earpiece
  const f0 = new V3(-0.2, 0, 1);
  const face = f0.addScaledVector(axis, -f0.dot(axis)).normalize();
  const x = axis.clone().negate();
  const y = face.clone().negate();
  const z = new V3().crossVectors(x, y);
  const view = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  const dialTop = DIAL_C.clone().addScaledVector(DIAL_UP, PLATE_R).applyQuaternion(ROOT_Q);
  const mouth = new V3(0.5, dialTop.y, 0.22);
  const p = mouth.sub(new V3(MOUTH_X, -0.03, 0).applyQuaternion(view)).applyQuaternion(ROOT_QI);
  return { p, q: ROOT_QI.clone().multiply(view), view };
}
const LIFTED_POSE = liftedPose();
const LIFTED = LIFTED_POSE.p;
const LIFTED_Q = LIFTED_POSE.q;
const LIFTED_M = new THREE.Matrix4().compose(LIFTED, LIFTED_Q, new V3(1, 1, 1));
/** Which way is down in the lifted handset's frame, and in the telephone's frame. */
const DOWN = new V3(0, -1, 0).applyQuaternion(LIFTED_POSE.view.clone().invert());
const G_ROOT = new V3(0, -1, 0).applyQuaternion(ROOT_QI);
/** Round the cups, the azimuth that points downhill, and the side of the handle that is lower. */
const PHI_LOW = (Math.atan2(DOWN.z, DOWN.x) * 180) / Math.PI;
const SIDE_LOW = DOWN.z >= 0 ? 1 : -1;

// ---------------------------------------------------------------------------------------------
// Blood: out of the earpiece holes, over the face, over the rim, down the handle and round the
// mouthpiece cup to the lowest point of its rim, then off it in drops.

/** How far the streams stand off the surface (they sit half sunk, as a raised wet line). */
const LIFT = 0.0032;
/** Seconds after the Take. */
const WELL_AT = LIFT_S + 1.2;
const MAIN_AT = WELL_AT + 0.35;
const MAIN_DUR = 2.9;
const DRIPS_AT = LIFT_S + 4.5;
const DRIP_EVERY = 0.75;

function mainRunPoints() {
  const e = (r: number, y: number) => cupPt(EAR_X, PHI_LOW, r, y);
  const ew = (y: number) => cupPt(EAR_X, PHI_LOW, cupWallR(y, 1, 1) + LIFT, y);
  const mw = (y: number, deg: number) => cupPt(MOUTH_X, deg, cupWallR(y, MOUTH_K, MOUTH_KY) + LIFT, y);
  const s = SIDE_LOW;
  const handle = [-0.255, -0.215, -0.17, -0.12, -0.07, -0.02, 0.03, 0.08, 0.13, 0.18].map((x) => onHandle(x, 180 - s * (10 + 5 * Math.sin(x * 21)), LIFT));
  return [
    // across the face from the holes
    e(0.014, FACE_Y - LIFT),
    e(0.034, FACE_Y - LIFT),
    e(0.054, FACE_Y - LIFT),
    // over the thick rim
    e(0.066, -0.0815 - LIFT),
    e(0.078, -0.0895 - LIFT),
    e(0.0905 + LIFT * 0.7, -0.0858 - LIFT * 0.7),
    // down the cup's wall to where the handle leaves it
    ew(-0.076),
    ew(-0.06),
    ew(-0.042),
    ew(-0.026),
    ew(-0.012),
    // down the inside of the handle, drifting to its lower side near the mouthpiece
    ...handle,
    onHandle(0.22, 180 - s * 30, LIFT),
    onHandle(0.255, 180 - s * 52, LIFT),
    // over the mouthpiece cup's back and round its side to the lowest point of the rim
    mw(-0.006, s * 122),
    mw(-0.022, s * 100),
    mw(-0.04, s * 72),
    mw(-0.056, s * 42),
    mw(-0.068, PHI_LOW + s * 14),
    mw(-0.075, PHI_LOW),
  ];
}
const MAIN_PTS = mainRunPoints();
/** A thinner stream that splits off on the handle and stops partway down. */
const BRANCH_FROM = 14;
const BRANCH_PTS = [
  MAIN_PTS[BRANCH_FROM]!,
  ...[
    [-0.09, 14],
    [-0.05, 24],
    [0, 30],
    [0.04, 33],
    [0.07, 34],
  ].map(([x, d]) => onHandle(x!, 180 + SIDE_LOW * d!, LIFT)),
];
type Run = { line: THREE.CatmullRomCurve3; r: number; at: number; dur: number };
const RUNS: Run[] = (() => {
  const main = new THREE.CatmullRomCurve3(MAIN_PTS);
  const branch = new THREE.CatmullRomCurve3(BRANCH_PTS);
  const pace = main.getLength() / MAIN_DUR;
  const reach = new THREE.CatmullRomCurve3(MAIN_PTS.slice(0, BRANCH_FROM + 1)).getLength() / pace;
  return [
    { line: main, r: 0.0068, at: MAIN_AT, dur: MAIN_DUR },
    { line: branch, r: 0.005, at: MAIN_AT + reach, dur: (branch.getLength() / pace) * 1.6 },
  ];
})();
/** The lowest point of the mouthpiece rim, where it gathers, and the drop hanging under it. */
const GATHER = cupPt(MOUTH_X, PHI_LOW, cupWallR(-0.075, MOUTH_K, MOUTH_KY) + 0.006, -0.075);
const DRIP_LOCAL = GATHER.clone().addScaledVector(DOWN, 0.012);
const DRIP_AT = DRIP_LOCAL.clone().applyMatrix4(LIFTED_M);
/** Where the drops land: straight down (in the world) from the drip onto the table. */
const POOL_AT = DRIP_AT.clone().addScaledVector(G_ROOT, (DRIP_AT.y - TABLE_Y - 0.002) / -G_ROOT.y);
const POOL_R = 0.11;

/** 0→1 at a steady pace (blood runs at its own speed, it does not ease in); 1 for Infinity. */
function along(s: number, dur: number, delay: number) {
  if (s === Infinity) return 1;
  return Math.min(1, Math.max(0, (s - delay) / dur));
}

/** Shows each run up to where the blood has got to, with a bead at its front. */
function showRuns(s: number, geos: THREE.TubeGeometry[], beads: (THREE.Mesh | null)[]) {
  RUNS.forEach((run, i) => {
    const g = geos[i];
    if (!g) return;
    const k = along(s, run.dur, run.at);
    const { tubularSegments, radialSegments } = g.parameters;
    g.setDrawRange(0, Math.floor(tubularSegments * k) * radialSegments * 6);
    const b = beads[i];
    if (!b) return;
    b.visible = k > 0;
    if (b.visible) run.line.getPointAt(k, b.position);
  });
}

function bloodMaterial(offset: boolean) {
  return new THREE.MeshPhysicalMaterial({
    // wet, but not a mirror: a glossy clearcoat caught the studio light and read pale pink
    color: '#5a050a',
    roughness: 0.32,
    clearcoat: 0.35,
    clearcoatRoughness: 0.25,
    envMapIntensity: 0.35,
    polygonOffset: offset,
    polygonOffsetFactor: offset ? -2 : 0,
    polygonOffsetUnits: offset ? -2 : 0,
  });
}

/**
 * On the lifted handset: it wells out of each earpiece hole, spreads in a wet film over the
 * face, runs over the bottom of the rim and down the inside of the handle in a narrow stream
 * (a thinner one splits off and stops), round the mouthpiece cup, and gathers at its rim.
 */
function HandsetBlood({ since }: { since: () => number }) {
  const geos = useMemo(() => RUNS.map((r) => new THREE.TubeGeometry(r.line, Math.max(24, Math.round(r.line.getLength() * 420)), r.r, 6, false)), []);
  const blood = useMemo(() => bloodMaterial(false), []);
  const film = useMemo(() => bloodMaterial(true), []);
  useEffect(
    () => () => {
      geos.forEach((g) => g.dispose());
      blood.dispose();
      film.dispose();
    },
    [geos, blood, film],
  );
  const filmRef = useRef<THREE.Mesh>(null);
  const cap = useRef<THREE.Mesh>(null);
  const wells = useRef<(THREE.Mesh | null)[]>([]);
  const beads = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const s = since();
    wells.current.forEach((m, i) => m?.scale.setScalar(Math.max(0.01, progress(s, 0.4, WELL_AT + i * 0.05))));
    const f = progress(s, 1.1, WELL_AT + 0.2);
    if (filmRef.current) {
      filmRef.current.scale.setScalar(Math.max(0.01, f));
      // it runs a little downhill as it spreads
      filmRef.current.position.set(EAR_X + Math.cos((PHI_LOW * Math.PI) / 180) * 0.006 * f, FACE_Y - 0.0012, Math.sin((PHI_LOW * Math.PI) / 180) * 0.006 * f);
    }
    showRuns(s, geos, beads.current);
    if (cap.current) cap.current.scale.setScalar(Math.max(0.01, progress(s, 0.45, DRIPS_AT - 0.3)));
  });
  return (
    <group>
      {EAR_HOLES.map(([x, z], i) => (
        <mesh
          key={i}
          ref={(m) => {
            wells.current[i] = m;
          }}
          material={blood}
          position={[EAR_X + x, FACE_Y - 0.0008, z]}
          scale={0.01}
        >
          <sphereGeometry args={[0.0045, 10, 8]} />
        </mesh>
      ))}
      <mesh ref={filmRef} material={film} position={[EAR_X, FACE_Y - 0.0012, 0]} rotation-x={Math.PI / 2} scale={0.01}>
        <circleGeometry args={[0.06, 32]} />
      </mesh>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} material={blood} />
      ))}
      {RUNS.map((run, i) => (
        <mesh
          key={i}
          ref={(m) => {
            beads.current[i] = m;
          }}
          material={blood}
          visible={false}
        >
          <sphereGeometry args={[run.r * 1.3, 10, 8]} />
        </mesh>
      ))}
      {/* gathering at the lowest point of the mouthpiece rim */}
      <mesh ref={cap} material={blood} position={GATHER} scale={0.01}>
        <sphereGeometry args={[0.0105, 14, 10]} />
      </mesh>
    </group>
  );
}

/** An uneven round for the pool (unit size). */
function poolGeometry() {
  const s = new THREE.Shape();
  const n = 48;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 1 + 0.1 * Math.sin(3 * a + 0.5) + 0.06 * Math.sin(5 * a + 1.7) + 0.04 * Math.sin(9 * a + 0.3);
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return new THREE.ShapeGeometry(s, 1);
}

/** Moves the one falling drop and the ripple it makes (outside the component for the lint rules). */
function dripStep(s: number, drop: THREE.Mesh, ripple: THREE.Mesh) {
  const fall = DRIP_AT.distanceTo(POOL_AT);
  if (s === Infinity || s < DRIPS_AT) {
    // the end state: a drop hanging from the rim
    drop.visible = s === Infinity;
    drop.position.copy(DRIP_AT);
    drop.scale.setScalar(1);
    ripple.visible = false;
    return;
  }
  const e = s - DRIPS_AT;
  const t = (e % DRIP_EVERY) / DRIP_EVERY;
  // hangs and swells, lets go, falls (one drop every DRIP_EVERY seconds)
  const hang = Math.min(1, t / 0.45);
  const f = Math.max(0, (t - 0.45) / 0.35);
  drop.visible = t < 0.8;
  drop.position.copy(DRIP_AT).addScaledVector(G_ROOT, 0.006 * hang + Math.min(1, f * f) * fall);
  const sw = 0.55 + 0.45 * hang;
  drop.scale.set(sw, sw * (1 + Math.min(1, f) * 0.7), sw);
  let a = t - 0.8;
  if (a < 0) a += 1;
  ripple.visible = e > DRIP_EVERY * 0.8 && a < 0.6;
  ripple.scale.setScalar(0.2 + a * 1.4);
  (ripple.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - a / 0.6);
}

/** The drops falling from the mouthpiece rim onto the table, and the pool they make. */
function Drips({ since }: { since: () => number }) {
  const pool = useMemo(() => poolGeometry(), []);
  useEffect(() => () => pool.dispose(), [pool]);
  const drop = useRef<THREE.Mesh>(null);
  const ripple = useRef<THREE.Mesh>(null);
  const poolRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const s = since();
    if (drop.current && ripple.current) dripStep(s, drop.current, ripple.current);
    if (poolRef.current) poolRef.current.scale.setScalar(POOL_R * Math.max(0.02, progress(s, 7, DRIPS_AT + 0.6)));
  });
  return (
    <group>
      <mesh ref={drop} visible={false}>
        <sphereGeometry args={[0.0105, 12, 10]} />
        <meshPhysicalMaterial color="#5a050a" roughness={0.3} clearcoat={0.35} envMapIntensity={0.35} />
      </mesh>
      <mesh ref={poolRef} geometry={pool} position={POOL_AT} rotation-x={-Math.PI / 2} scale={0.01}>
        <meshPhysicalMaterial color="#3e0306" roughness={0.3} clearcoat={0.3} clearcoatRoughness={0.3} envMapIntensity={0.3} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </mesh>
      <mesh ref={ripple} position={[POOL_AT.x, POOL_AT.y + 0.001, POOL_AT.z]} rotation-x={-Math.PI / 2} visible={false}>
        <ringGeometry args={[0.022, 0.026, 32]} />
        <meshBasicMaterial color="#8a2a2a" transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// The braided cords: three strands twisted round a centre line, like a cloth rope.

const BR = { strands: 3, radial: 6, rs: 0.0056, rr: 0.0058, pitch: 0.048 };
const CORD_N = 200;
const LINE_N = 360;

function makeBraid(n: number) {
  const ring = BR.radial + 1;
  const per = (n + 1) * ring;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(per * BR.strands * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(per * BR.strands * 3), 3));
  const uv = new Float32Array(per * BR.strands * 2);
  const idx: number[] = [];
  for (let s = 0; s < BR.strands; s++) {
    for (let i = 0; i <= n; i++) {
      for (let k = 0; k <= BR.radial; k++) {
        const v = s * per + i * ring + k;
        uv[v * 2] = (i / n) * 40;
        uv[v * 2 + 1] = k / BR.radial;
        if (i < n && k < BR.radial) {
          const d = v + ring;
          idx.push(v, v + 1, d, v + 1, d + 1, d);
        }
      }
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Writes the braid's strands along a curve into its buffers. */
function writeBraid(g: THREE.BufferGeometry, curve: THREE.Curve<THREE.Vector3>, n: number) {
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const nor = g.getAttribute('normal') as THREE.BufferAttribute;
  const fr = curve.computeFrenetFrames(n, false);
  const len = curve.getLength();
  const ring = BR.radial + 1;
  const per = (n + 1) * ring;
  const P = new V3();
  const C = new V3();
  const D = new V3();
  for (let i = 0; i <= n; i++) {
    curve.getPointAt(i / n, P);
    const N = fr.normals[i]!;
    const B = fr.binormals[i]!;
    for (let s = 0; s < BR.strands; s++) {
      const phi = ((i / n) * len * Math.PI * 2) / BR.pitch + (s * Math.PI * 2) / BR.strands;
      C.copy(P)
        .addScaledVector(N, Math.cos(phi) * BR.rr)
        .addScaledVector(B, Math.sin(phi) * BR.rr);
      for (let k = 0; k <= BR.radial; k++) {
        const th = (k / BR.radial) * Math.PI * 2;
        D.copy(N)
          .multiplyScalar(Math.cos(th))
          .addScaledVector(B, Math.sin(th));
        const v = s * per + i * ring + k;
        pos.setXYZ(v, C.x + D.x * BR.rs, C.y + D.y * BR.rs, C.z + D.z * BR.rs);
        nor.setXYZ(v, D.x, D.y, D.z);
      }
    }
  }
  pos.needsUpdate = true;
  nor.needsUpdate = true;
  g.computeBoundingSphere();
  g.computeBoundingBox();
}

/** Where the handset cord goes into the body (its right side), and its line cord leaves (left). */
const CORD_FROM = new V3(hwAt(-0.36) + 0.004, -0.36, -0.12);
const LINE_FROM = new V3(-hwAt(-0.5) - 0.004, -0.5, -0.16);

/** The handset cord: out of the sleeve, a loose hanging curve, into the side of the body. */
function cordCurve(a: THREE.Vector3, aDir: THREE.Vector3) {
  const a2 = a.clone().addScaledVector(aDir, 0.05);
  const b = CORD_FROM;
  const b2 = b.clone().add(new V3(0.05, 0, 0));
  const mid = a2.clone().lerp(b2, 0.5);
  const flat = Math.hypot(a2.x - b2.x, a2.z - b2.z);
  mid.y = Math.max(TABLE_Y + 0.03, Math.min(a2.y, b2.y) - 0.05 - flat * 0.15);
  mid.x += 0.04;
  return new THREE.CatmullRomCurve3([a, a2, mid, b2, b], false, 'centripetal');
}

const AXIS_X = new V3();
/** Outside the component, so the React compiler rules see no mutation of hook values. */
function setCord(m: THREE.Mesh, end: THREE.Vector3, q: THREE.Quaternion) {
  writeBraid(m.geometry, cordCurve(end, AXIS_X.set(1, 0, 0).applyQuaternion(q)), CORD_N);
}

const LINE_CURVE = (() => {
  const T = TABLE_Y + 0.0115;
  return new THREE.CatmullRomCurve3(
    [
      LINE_FROM,
      new V3(-0.43, -0.51, -0.16),
      new V3(-0.5, -0.565, -0.12),
      new V3(-0.55, T, -0.02),
      new V3(-0.63, T, 0.17),
      new V3(-0.74, T, 0.2),
      new V3(-0.8, T, 0.04),
      new V3(-0.74, T, -0.2),
      new V3(-0.56, T, -0.42),
      new V3(-0.3, T, -0.62),
    ],
    false,
    'centripetal',
  );
})();

function lineCordGeometry() {
  const g = makeBraid(LINE_N);
  writeBraid(g, LINE_CURVE, LINE_N);
  return g;
}

/** Loose fibres where the line cord has frayed (after the Reveal). */
function fibresGeometry() {
  const r = rng(733);
  const pos: number[] = [];
  const P = new V3();
  const T = new V3();
  const d = new V3();
  for (const u of [0.42, 0.6, 0.78]) {
    LINE_CURVE.getPointAt(u, P);
    LINE_CURVE.getTangentAt(u, T);
    for (let i = 0; i < 8; i++) {
      d.set(r() - 0.5, r() * 0.8, r() - 0.5);
      d.addScaledVector(T, -d.dot(T)).normalize();
      const s = P.clone().addScaledVector(d, 0.011);
      const e = s
        .clone()
        .addScaledVector(d, 0.01 + r() * 0.014)
        .addScaledVector(T, (r() - 0.5) * 0.02);
      pos.push(s.x, s.y, s.z, e.x, e.y, e.z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

function LineCord({ haunted }: { haunted: boolean }) {
  const geo = useMemo(() => lineCordGeometry(), []);
  const fibres = useMemo(() => fibresGeometry(), []);
  useEffect(
    () => () => {
      geo.dispose();
      fibres.dispose();
    },
    [geo, fibres],
  );
  return (
    <group userData={{ extra: true }}>
      <mesh geometry={geo} material={CORD()} />
      {haunted && (
        <lineSegments geometry={fibres}>
          <lineBasicMaterial color="#4a423a" />
        </lineSegments>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// The parts.

function Body({ haunted }: { haunted: boolean }) {
  const body = useMemo(() => bodyGeometry(), []);
  const base = useMemo(() => baseGeometry(), []);
  const frame = useMemo(() => {
    const s = new THREE.Shape();
    roundRect(s, 0.066, 0.028, 0.012);
    const hole = new THREE.Path();
    roundRect(hole, 0.05, 0.0185, 0.004);
    s.holes.push(hole);
    return new THREE.ExtrudeGeometry(s, { depth: 0.005, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 6 });
  }, []);
  useEffect(
    () => () => {
      body.dispose();
      base.dispose();
      frame.dispose();
    },
    [body, base, frame],
  );
  const label = useCanvasTexture(256, 96, (g, w, h) => drawLabel(g, w, h, haunted), [haunted]);
  const scratches = useCanvasTexture(256, 256, drawScratches, []);
  return (
    <group>
      <mesh geometry={base} material={BAKELITE()} />
      <mesh geometry={body} material={BAKELITE()} />
      {/* the label window at the bottom of the front */}
      <group position={[0, -0.548, 0.35]}>
        <mesh geometry={frame} material={BAKELITE()} />
        <mesh position-z={0.003}>
          <planeGeometry args={[0.1, 0.037]} />
          <meshStandardMaterial map={label} roughness={0.75} />
        </mesh>
      </group>
      {/* the cream button, in a black bezel */}
      <group position={[0.2, -0.548, 0.35]}>
        <mesh material={BAKELITE()}>
          <torusGeometry args={[0.0225, 0.0045, 10, 32]} />
        </mesh>
        <mesh material={CREAM()} position-z={0.004} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.019, 0.019, 0.008, 28]} />
        </mesh>
        <mesh material={CREAM()} position-z={0.008} rotation-x={Math.PI / 2} scale={[1, 0.35, 1]}>
          <sphereGeometry args={[0.019, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      </group>
      {/* grommets where the cords go in */}
      <mesh material={BAKELITE()} position={CORD_FROM} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.016, 0.019, 0.022, 20]} />
      </mesh>
      <mesh material={BAKELITE()} position={LINE_FROM} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.019, 0.016, 0.022, 20]} />
      </mesh>
      {/* worn: scratches on the right side (the dial's are in Dial) */}
      {haunted && (
        <group position={[hwAt(-0.33) + 0.0016, -0.33, -0.09]} rotation-z={Math.atan(0.04 / (YS - Y0))}>
          <mesh rotation-y={Math.PI / 2}>
            <planeGeometry args={[0.18, 0.3]} />
            <meshStandardMaterial map={scratches} transparent depthWrite={false} roughness={0.9} polygonOffset polygonOffsetFactor={-2} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function roundRect(p: THREE.Path, hw: number, hh: number, r: number) {
  p.moveTo(-hw + r, -hh);
  p.lineTo(hw - r, -hh);
  p.quadraticCurveTo(hw, -hh, hw, -hh + r);
  p.lineTo(hw, hh - r);
  p.quadraticCurveTo(hw, hh, hw - r, hh);
  p.lineTo(-hw + r, hh);
  p.quadraticCurveTo(-hw, hh, -hw, hh - r);
  p.lineTo(-hw, -hh + r);
  p.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
}

/** The dial: collar, number ring, finger wheel with the number card and hub, finger stop. */
function Dial({ wheel, haunted }: { wheel: RefObject<THREE.Group | null>; haunted: boolean }) {
  const wheelGeo = useMemo(() => wheelGeometry(), []);
  const collar = useMemo(() => collarGeometry(), []);
  const stop = useMemo(() => stopGeometry(), []);
  useEffect(
    () => () => {
      wheelGeo.dispose();
      collar.dispose();
      stop.dispose();
    },
    [wheelGeo, collar, stop],
  );
  const numbers = useCanvasTexture(512, 512, (g, w, h) => drawNumbers(g, w, h, haunted), [haunted]);
  const card = useCanvasTexture(256, 256, (g, w, h) => drawCard(g, w, h, haunted), [haunted]);
  const scratches = useCanvasTexture(256, 256, drawScratches, []);
  return (
    <group position={DIAL_C} rotation-x={DIAL_TILT}>
      {haunted && (
        <mesh position-z={0.0016} rotation-z={0.4}>
          <planeGeometry args={[0.42, 0.36]} />
          <meshStandardMaterial map={scratches} transparent depthWrite={false} roughness={0.9} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      )}
      <mesh geometry={collar} material={BAKELITE()} />
      <mesh position-z={0.004}>
        <circleGeometry args={[PLATE_R, 72]} />
        <meshStandardMaterial map={numbers} roughness={0.4} />
      </mesh>
      <group ref={wheel}>
        <mesh geometry={wheelGeo} material={BAKELITE()} position-z={0.0075} />
        <mesh position-z={0.0095}>
          <circleGeometry args={[CARD_R + 0.001, 48]} />
          <meshPhysicalMaterial map={card} roughness={0.3} clearcoat={1} />
        </mesh>
        <mesh material={BAKELITE()} position-z={0.0145} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.021, 0.022, 0.01, 28]} />
        </mesh>
        <mesh material={BAKELITE()} position-z={0.0195} rotation-x={Math.PI / 2} scale={[1, 0.4, 1]}>
          <sphereGeometry args={[0.021, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      </group>
      <mesh geometry={stop} material={M.silver()} />
      <mesh material={M.silver()} position={[Math.cos(STOP_A) * 0.19, Math.sin(STOP_A) * 0.19, 0.004]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.009, 0.009, 0.006, 16]} />
      </mesh>
    </group>
  );
}

/** The cradle: a ridge across the top, two horns rising from it, each ending in a U hook. */
function Cradle() {
  const horns = useMemo(
    () =>
      [-1, 1].map((sx) => {
        const bottom = HOOK_Y - U_R;
        const line = new THREE.CatmullRomCurve3([
          new V3(sx * 0.11, TOP_Y + 0.012, REST.z),
          new V3(sx * 0.16, TOP_Y + 0.04, REST.z),
          new V3(sx * 0.2, bottom - 0.025, REST.z),
          new V3(sx * HOOK_X, bottom + 0.004, REST.z),
        ]);
        return sweepGeometry(line, 32, 16, (u) => {
          const r = 0.034 - 0.014 * u;
          return [r, r];
        });
      }),
    [],
  );
  useEffect(() => () => horns.forEach((g) => g.dispose()), [horns]);
  return (
    <group>
      <mesh material={BAKELITE()} position={[0, TOP_Y + 0.004, REST.z]} rotation-z={Math.PI / 2} scale={[0.8, 1, 1]}>
        <capsuleGeometry args={[0.042, 0.24, 8, 20]} />
      </mesh>
      {horns.map((g, i) => (
        <mesh key={i} geometry={g} material={BAKELITE()} />
      ))}
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * HOOK_X, HOOK_Y, REST.z]} rotation-y={Math.PI / 2}>
          <mesh material={BAKELITE()} rotation-z={Math.PI}>
            <torusGeometry args={[U_R, U_TUBE, 12, 28, Math.PI]} />
          </mesh>
          {[-1, 1].map((sz) => (
            <mesh key={sz} material={BAKELITE()} position-x={sz * U_R}>
              <sphereGeometry args={[U_TUBE * 1.05, 14, 10]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** The handset: a chunky bowed handle, two round cups with thick rims, the cord sleeve. */
function Handset() {
  const geo = useMemo(
    () => ({
      handle: sweepGeometry(HANDLE, 64, 20, handleRadius),
      ear: cupGeometry(1, 1),
      mouth: cupGeometry(MOUTH_K, MOUTH_KY),
      earHoles: holesGeometry(EAR_HOLES, 0.0042, FACE_Y - 0.0006),
      mouthHoles: holesGeometry(MOUTH_HOLES, 0.0045, FACE_Y * MOUTH_KY - 0.0006),
    }),
    [],
  );
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  return (
    <group>
      <mesh geometry={geo.handle} material={BAKELITE()} />
      <group position-x={EAR_X}>
        <mesh geometry={geo.ear} material={BAKELITE()} />
        <mesh geometry={geo.earHoles}>
          <meshBasicMaterial color="#000" side={THREE.DoubleSide} />
        </mesh>
      </group>
      <group position-x={MOUTH_X}>
        <mesh geometry={geo.mouth} material={BAKELITE()} />
        <mesh geometry={geo.mouthHoles}>
          <meshBasicMaterial color="#000" side={THREE.DoubleSide} />
        </mesh>
      </group>
      <mesh material={BAKELITE()} position={[0.414, 0, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.012, 0.015, 0.036, 16]} />
      </mesh>
    </group>
  );
}

/** Not drawn: the space the lifted handset, the drops and the pool reach (the product view frames it). */
const BOUNDS = (() => {
  const b = new THREE.Box3(new V3(-0.43, TABLE_Y, -0.4), new V3(0.45, 0.25, 0.42));
  for (const x of [-0.44, 0.47]) for (const y of [-0.1, 0.15]) for (const z of [-0.11, 0.11]) b.expandByPoint(new V3(x, y, z).applyMatrix4(LIFTED_M));
  b.expandByPoint(POOL_AT.clone().add(new V3(0.14, 0, 0.14)));
  b.expandByPoint(POOL_AT.clone().add(new V3(-0.14, 0, -0.14)));
  return { centre: b.getCenter(new V3()), size: b.getSize(new V3()) };
})();

/**
 * The telephone (Requirement 21): the handset rattles in its cradle while it rings. Taken, the
 * receiver is picked up by no one at the speed of a hand and held up beside the telephone the
 * way you hold it to listen, the earpiece at an ear that is not there. Blood wells out of the
 * earpiece holes, spreads over its face, runs over the rim and down the handle, round the
 * mouthpiece, and drips from its rim, drop by drop, into a pool on the table. Someone unseen
 * keeps trying the dial, a little this way, a little that way.
 */
export default function Telephone({ open = false }: { open?: boolean }) {
  const handset = useRef<THREE.Group>(null);
  const wheel = useRef<THREE.Group>(null);
  const cord = useRef<THREE.Mesh>(null);
  const lastEnd = useRef(new V3(1e9, 0, 0));
  const ringing = useFx((s) => s.cartRinging) || open;
  const haunted = useHaunted();
  const { taken, since } = useTaken('telephone');
  const cordGeo = useMemo(() => makeBraid(CORD_N), []);
  useEffect(() => () => cordGeo.dispose(), [cordGeo]);
  useFrame((st) => {
    const h = handset.current;
    if (!h) return;
    const t = st.clock.elapsedTime;
    const still = reducedMotion();
    if (wheel.current) wheel.current.rotation.z = taken ? tryDial(t, still) : 0;
    if (taken) {
      holdHandset(h, progress(since(), LIFT_S), t, still);
    } else {
      // ring pattern: two short rattles, then a pause
      const on = ringing && t % 3 < 1.4 && Math.floor(t * 18) % 2 === 0;
      h.position.set(REST.x, REST.y + (on ? 0.02 : 0), REST.z + (haunted ? 0.006 : 0));
      // haunted, it sits a little askew in the cradle, as if put down in a hurry
      h.rotation.set(0, haunted ? 0.035 : 0, on ? 0.03 : 0);
      if (ringing) st.invalidate();
    }
    // the cord follows the handset (not for the ringing rattle: too small to see)
    h.updateMatrix();
    const end = CORD_TO.clone().applyMatrix4(h.matrix);
    const first = lastEnd.current.x === 1e9;
    if (cord.current && (first || taken || !ringing) && end.distanceToSquared(lastEnd.current) > 1e-7) {
      lastEnd.current.copy(end);
      setCord(cord.current, end, h.quaternion);
    }
  });
  return (
    <group rotation={ROOT_ROT}>
      <Body haunted={haunted} />
      <Dial wheel={wheel} haunted={haunted} />
      <Cradle />
      <group ref={handset} position={REST}>
        <Handset />
        {taken && <HandsetBlood since={since} />}
      </group>
      <mesh ref={cord} geometry={cordGeo} material={CORD()} />
      <LineCord haunted={haunted} />
      {taken && <Drips since={since} />}
      <mesh position={BOUNDS.centre} userData={{ frame: true }}>
        <boxGeometry args={[BOUNDS.size.x, BOUNDS.size.y, BOUNDS.size.z]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
}

/** An unseen finger in the dial: pulls it round a little (clockwise), lets it slip back, tries again. */
function tryDial(t: number, still: boolean) {
  if (still) return -0.2;
  return -Math.max(0, Math.sin(t * 1.3) + 0.45 * Math.sin(t * 3.7 + 1.1) - 0.2) * 0.2;
}

const HOLD_Q = new THREE.Quaternion();
const BREATH_Q = new THREE.Quaternion();
const BREATH_AXIS = new V3(0, 0, 1);
/**
 * Lifting and holding the receiver: up out of the forks first at a hand's speed (k is 0→1 over
 * the lift), across and turning upright on the way, then held there with the faint rise and
 * lean of someone breathing, about one breath every four seconds.
 */
function holdHandset(h: THREE.Group, k: number, t: number, still: boolean) {
  const breath = still ? 0 : Math.sin(t * 1.5) * k;
  const rise = Math.sin(Math.PI * k) * 0.13 * (1 - k * 0.3);
  h.position.set(
    REST.x + (LIFTED.x - REST.x) * k * k,
    REST.y + (LIFTED.y - REST.y) * k + rise + breath * 0.003,
    REST.z + (LIFTED.z - REST.z) * k,
  );
  HOLD_Q.identity().slerp(LIFTED_Q, Math.pow(k, 1.4));
  h.quaternion.copy(HOLD_Q).multiply(BREATH_Q.setFromAxisAngle(BREATH_AXIS, breath * 0.01));
}
