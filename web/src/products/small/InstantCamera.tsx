import { useFrame, useThree } from '@react-three/fiber';
import type { RefObject } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { reducedMotion } from '../../director/runtime';
import { drawWitchPhoto, useCanvasTexture } from '../../gl/canvasTex';
import { progress, useTaken } from '../../gl/useTaken';
import { useHaunted } from '../../store';
import { CAMERA } from './cameraTiming';

/*
 * Layout, in the body's own units (x across, y up from the slot side, z out of the front):
 * the upper block's front face is at FACE_Z, the lower block (the brown panel and the slot)
 * stands forward at LOW_Z, joined by a sloped ledge. The base is at y = -0.5, the top of the
 * flash bar at about 0.9. Everything is drawn OFF lower inside the body so it turns about its middle.
 */
const REST: [number, number, number] = [0.15, -0.45, 0];
const OFF = 0.2;
const W = 1.55;
const FACE_Z = 0.22;
const LOW_Z = 0.36;
const FACE = { x0: -0.72, w: 1.44, top: 0.7, bottom: 0.026 };
const PANEL = { top: -0.128, bottom: -0.425 };
/** The ledge between them: from the top of the lower front to the foot of the upper face. */
const LEDGE = { z: 0.2862, y: -0.0377, len: 0.16, tilt: -Math.atan2(0.759, 0.651) };
/** The print slot's height on the body. */
const SLOT_Y = -0.365;
const LENS = { x: -0.08, y: 0.4 };
const BTN = { x: -0.53, y: 0.31 };
const VIEW = { x: -0.53, y: 0.585 };
const FLASH = { x: 0.48, y: 0.585 };
const EYE = { x: 0.48, y: 0.37 };
/** The print: about half the body's width, instant-film proportions (88 × 107). */
const PRINT = { w: 0.76, h: 0.924, z: 0.372 };
/** How far it rises as it turns to you, so the print it hangs out has room below it. */
/** It does not rise: it only turns to face you and takes the picture. */
const LIFT = 0;
const STRIPES = ['#c8352e', '#e07b2c', '#e8c23a', '#3e8e4a', '#2f63a8'] as const;
const STRIPE_W = 0.032;
const STRIPE_X0 = LENS.x - (STRIPES.length * STRIPE_W) / 2;
const CREAM_NEW = '#efe4cc';
const CREAM_OLD = '#d9c9a6';
/**
 * The iris: six curved blades, each an arc of the ring round the aperture when open, pivoting
 * at one end. Swung in by `swing` they cover the whole aperture; at every angle in between they
 * stay inside radius 0.175, under the barrel's ribs, so they never show outside the lens.
 */
const IRIS = { rin: 0.112, rout: 0.175, span: (110 * Math.PI) / 180, pivot: 0.115, swing: (70 * Math.PI) / 180 };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const DOWN = new THREE.Vector3(0, -1, 0);
const tmpN = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const REST_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...REST));
const aimQ = new THREE.Quaternion();
const aimM = new THREE.Matrix4();
const aimAt = new THREE.Vector3();
const ORIGIN = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Turns the body from its resting angle toward the viewer, `k` of the way: its lens (+z) is
 * aimed at the camera that is looking at it, worked out in the body's parent space, so it
 * faces you square on however the card has turned it or the product view has been orbited.
 */
function aimBody(body: THREE.Object3D, camera: THREE.Camera, k: number) {
  const parent = body.parent;
  if (!parent) return;
  parent.updateWorldMatrix(true, false);
  aimAt.copy(camera.position);
  parent.worldToLocal(aimAt).sub(body.position);
  if (aimAt.lengthSq() < 1e-6) return;
  aimM.lookAt(aimAt, ORIGIN, UP);
  aimQ.setFromRotationMatrix(aimM);
  body.quaternion.copy(REST_Q).slerp(aimQ, k);
}

/**
 * How far the iris is shut (1 shut, 0 open). By day it is open, ready. After the Reveal it is
 * shut; now and then it opens a crack and closes again, as if something looked out. Taken, it
 * swings open and stays open.
 */
function irisShut(s: number, taken: boolean, haunted: boolean, t: number): number {
  if (!haunted) return 0;
  if (taken) return 1 - progress(s, CAMERA.coverFor, CAMERA.coverAt);
  if (reducedMotion()) return 1;
  const ph = t % 11;
  return ph < 2.4 ? 1 - Math.sin((Math.PI * ph) / 2.4) ** 2 * 0.14 : 1;
}

function setIris(blades: (THREE.Mesh | null)[], shut: number) {
  for (const b of blades) if (b) b.rotation.z = IRIS.swing * shut;
}

/** Keep only what is below the slot, wherever the camera has turned (outside the component). */
function clipAtSlot(body: THREE.Object3D, plane: THREE.Plane) {
  body.updateWorldMatrix(true, false);
  body.getWorldQuaternion(tmpQ);
  tmpN.copy(DOWN).applyQuaternion(tmpQ);
  tmpP.set(0, SLOT_Y - OFF, 0.4);
  body.localToWorld(tmpP);
  plane.setFromNormalAndCoplanarPoint(tmpN, tmpP);
}

function enableLocalClipping(gl: THREE.WebGLRenderer) {
  gl.localClippingEnabled = true;
}

function tile(t: THREE.Texture, rx: number, ry: number) {
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
}

// ---------------------------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------------------------

/** A closed outline through `[x, y, cornerRadius]` points, each corner rounded by its radius. */
function roundedPolygon(pts: readonly (readonly [number, number, number])[]): THREE.Shape {
  const s = new THREE.Shape();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [x, y, r] = pts[i]!;
    const [px, py] = pts[(i + n - 1) % n]!;
    const [nx, ny] = pts[(i + 1) % n]!;
    const lp = Math.hypot(px - x, py - y);
    const ln = Math.hypot(nx - x, ny - y);
    const ax = x + ((px - x) / lp) * r;
    const ay = y + ((py - y) / lp) * r;
    if (i === 0) s.moveTo(ax, ay);
    else s.lineTo(ax, ay);
    if (r > 0) s.quadraticCurveTo(x, y, x + ((nx - x) / ln) * r, y + ((ny - y) / ln) * r);
  }
  s.closePath();
  return s;
}

function roundedRect(w: number, h: number, r: number): THREE.Shape {
  return roundedPolygon([
    [-w / 2, -h / 2, r],
    [w / 2, -h / 2, r],
    [w / 2, h / 2, r],
    [-w / 2, h / 2, r],
  ]);
}

/**
 * A side profile (z across, y up) extruded the camera's width along x, every edge softened:
 * the profile's own corners are rounded and the bevel rounds the two ends.
 */
function extrudeAcross(profile: THREE.Shape, width: number, b: number): THREE.ExtrudeGeometry {
  const depth = width - 2 * b;
  const g = new THREE.ExtrudeGeometry(profile, { depth, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 4, curveSegments: 10 });
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2);
  return g;
}

/** The cream shell: lower block, sloped ledge, upper block (the bevel adds 0.03 all round). */
function shellGeometry() {
  return extrudeAcross(
    roundedPolygon([
      [-0.3, -0.47, 0.04],
      [0.33, -0.47, 0.04],
      [0.33, -0.115, 0.015],
      [0.19, 0.005, 0],
      [0.19, 0.745, 0],
      [-0.3, 0.745, 0],
    ]),
    W,
    0.03,
  );
}

/** The dark band capping the top, a hair larger than the shell so the two never fight. */
function bandGeometry() {
  return extrudeAcross(
    roundedPolygon([
      [-0.3, 0.74, 0],
      [0.19, 0.74, 0],
      [0.19, 0.78, 0.03],
      [-0.3, 0.78, 0.03],
    ]),
    W + 0.006,
    0.034,
  );
}

function roundedBox(w: number, h: number, d: number, r: number): THREE.ExtrudeGeometry {
  const x = w / 2 - r;
  const y = h / 2 - r;
  const c = Math.min(r, x, y) * 0.9;
  const s = roundedPolygon([
    [-x, -y, c],
    [x, -y, c],
    [x, y, c],
    [-x, y, c],
  ]);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * r, bevelEnabled: true, bevelSize: r, bevelThickness: r, bevelSegments: 4, curveSegments: 6 });
  g.translate(0, 0, -(d - 2 * r) / 2);
  return g;
}

/** A raised rectangular frame (a window's surround): a rounded rectangle with a hole. */
function frameGeometry(w: number, h: number, border: number, r: number, depth: number): THREE.ExtrudeGeometry {
  const outer = roundedRect(w, h, r);
  const inner = roundedRect(w - 2 * border, h - 2 * border, Math.max(0.003, r - border * 0.6));
  outer.holes.push(new THREE.Path(inner.getPoints(8)));
  return new THREE.ExtrudeGeometry(outer, { depth, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 8 });
}

/** A lathe from `[radius, height]` points, turned to stand out of the front (+z). */
function lathe(p: readonly (readonly [number, number])[], seg = 96): THREE.LatheGeometry {
  const g = new THREE.LatheGeometry(
    p.map(([r, z]) => new THREE.Vector2(r, z)),
    seg,
  );
  g.rotateX(Math.PI / 2);
  return g;
}

/** The lens's cream outer ring, raised and rounded. */
const RING: [number, number][] = [
  [0.27, 0],
  [0.272, 0.018],
  [0.266, 0.04],
  [0.252, 0.054],
  [0.232, 0.06],
  [0.214, 0.057],
  [0.204, 0.046],
  [0.2, 0.03],
  [0.2, 0],
];

/** The black barrel: fine concentric ribs stepping in and down to the aperture. */
function barrelProfile(): [number, number][] {
  const pts: [number, number][] = [
    [0.19, 0],
    [0.19, 0.046],
    [0.186, 0.052],
  ];
  for (let k = 0; k < 7; k++) {
    const r0 = 0.182 - k * 0.01;
    const z0 = 0.05 - k * 0.0037;
    pts.push([r0, z0], [r0 - 0.006, z0 - 0.0006], [r0 - 0.0068, z0 - 0.0034]);
  }
  pts.push([IRIS.rin, 0.024], [IRIS.rin, 0.003]);
  return pts;
}

const BEZEL: [number, number][] = [
  [0.1, 0],
  [0.102, 0.012],
  [0.097, 0.022],
  [0.086, 0.026],
  [0.079, 0.021],
  [0.077, 0],
];
const BUTTON: [number, number][] = [
  [0.071, 0],
  [0.072, 0.022],
  [0.068, 0.036],
  [0.056, 0.045],
  [0.032, 0.049],
  [0, 0.05],
];
const EYE_RING: [number, number][] = [
  [0.05, 0],
  [0.052, 0.008],
  [0.047, 0.015],
  [0.039, 0.013],
  [0.036, 0.004],
];
const EYE_DOME: [number, number][] = [
  [0.037, 0.002],
  [0.035, 0.01],
  [0.024, 0.016],
  [0, 0.019],
];

/** The front glass: a shallow dome with flat (planar) texture coordinates for its reflection. */
function domeGeometry(r: number, h: number): THREE.RingGeometry {
  const g = new THREE.RingGeometry(0.0005, r, 64, 8);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const d = Math.hypot(p.getX(i), p.getY(i)) / r;
    p.setZ(i, h * (1 - d * d));
  }
  g.computeVertexNormals();
  return g;
}

/** One iris blade, drawn open (an arc of the ring round the aperture), its pivot at the origin. */
function bladeGeometry(): THREE.ShapeGeometry {
  const s = new THREE.Shape();
  const n = 28;
  const at = (rad: number, k: number): [number, number] => {
    const a = (IRIS.span * k) / n;
    return [rad * Math.cos(a) - IRIS.pivot, rad * Math.sin(a)];
  };
  for (let k = 0; k <= n; k++) {
    const [x, y] = at(IRIS.rout, k);
    if (k === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  for (let k = n; k >= 0; k--) s.lineTo(...at(IRIS.rin, k));
  s.closePath();
  return new THREE.ShapeGeometry(s);
}

/** The print, hung from its top edge, curling very slightly at the sides as film does. */
function printGeometry(): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(PRINT.w, PRINT.h, 16, 1);
  g.translate(0, -PRINT.h / 2, 0);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / (PRINT.w / 2);
    p.setZ(i, 0.01 * u * u);
  }
  g.computeVertexNormals();
  return g;
}

function makeParts() {
  return {
    shell: shellGeometry(),
    band: bandGeometry(),
    bar: roundedBox(0.5, 0.09, 0.26, 0.03),
    ring: lathe(RING),
    barrel: lathe(barrelProfile()),
    dome: domeGeometry(IRIS.rin, 0.015),
    blade: bladeGeometry(),
    bezel: lathe(BEZEL, 64),
    button: lathe(BUTTON, 64),
    eyeRing: lathe(EYE_RING, 48),
    eyeDome: lathe(EYE_DOME, 48),
    flashFrame: frameGeometry(0.19, 0.19, 0.016, 0.014, 0.012),
    viewFrame: frameGeometry(0.25, 0.135, 0.022, 0.024, 0.014),
    lip: new THREE.CapsuleGeometry(0.017, 0.86, 4, 16).rotateZ(Math.PI / 2),
    print: printGeometry(),
  };
}
type Parts = ReturnType<typeof makeParts>;

function disposeAll(o: Record<string, { dispose: () => void }>) {
  for (const v of Object.values(o)) v.dispose();
}

// ---------------------------------------------------------------------------------------------
// Painted surfaces (seeded, so every visitor sees the same cracks)
// ---------------------------------------------------------------------------------------------

type Rng = () => number;
function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type G = CanvasRenderingContext2D;
const c255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Per-pixel grain: a plastic's mottle, or with `pebble` a leatherette's pebbled grain. */
function grain(g: G, w: number, h: number, amp: number, pebble: boolean, seed: number) {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  let s = seed >>> 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      let n = (s / 4294967296 - 0.5) * amp;
      if (pebble) n += Math.sin(x * 0.9 + Math.sin(y * 0.7) * 2.2) * Math.sin(y * 0.95 + Math.sin(x * 0.55) * 2.2) * amp * 0.9;
      const i = (y * w + x) * 4;
      d[i] = c255(d[i]! + n);
      d[i + 1] = c255(d[i + 1]! + n);
      d[i + 2] = c255(d[i + 2]! + n);
    }
  }
  g.putImageData(img, 0, 0);
}

/** A brown stain: a few overlapping soft blots with a faint tide line round them. */
function stain(g: G, r: Rng, x: number, y: number, size: number, rgb: string, a: number) {
  for (let k = 0; k < 6; k++) {
    const cx = x + (r() - 0.5) * size;
    const cy = y + (r() - 0.5) * size * 0.7;
    const rad = size * (0.3 + r() * 0.5);
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
    gr.addColorStop(0, `rgba(${rgb},${a})`);
    gr.addColorStop(0.7, `rgba(${rgb},${a * 0.5})`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(cx, cy, rad, rad * (0.6 + r() * 0.4), r() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = `rgba(${rgb},${a * 0.6})`;
  g.lineWidth = 1;
  g.beginPath();
  g.ellipse(x, y, size * 0.55, size * 0.38, r() * Math.PI, 0, Math.PI * 2);
  g.stroke();
}

/** Rust that has run down from a metal part and dried on the plastic. */
function streak(g: G, r: Rng, x: number, y: number, len: number, wid: number, rgb: string, a: number) {
  const gr = g.createLinearGradient(0, y, 0, y + len);
  gr.addColorStop(0, `rgba(${rgb},${a})`);
  gr.addColorStop(0.6, `rgba(${rgb},${a * 0.45})`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(x - wid / 2, y);
  g.quadraticCurveTo(x - wid * 0.3 + (r() - 0.5) * wid, y + len * 0.5, x + (r() - 0.5) * wid * 0.4, y + len);
  g.quadraticCurveTo(x + wid * 0.3 + (r() - 0.5) * wid, y + len * 0.5, x + wid / 2, y);
  g.closePath();
  g.fill();
}

/** A hairline crack: a wandering dark line with a light lip along it, branching now and then. */
function crack(g: G, r: Rng, x: number, y: number, len: number, ang: number, wid: number, depth = 0) {
  let cx = x;
  let cy = y;
  let a = ang;
  const pts: [number, number][] = [[cx, cy]];
  const steps = Math.max(3, Math.round(len / 6));
  for (let i = 0; i < steps; i++) {
    a += (r() - 0.5) * 0.7;
    cx += (Math.cos(a) * len) / steps;
    cy += (Math.sin(a) * len) / steps;
    pts.push([cx, cy]);
    if (depth < 2 && r() < 0.12) crack(g, r, cx, cy, len * (0.25 + r() * 0.3), a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.6), wid * 0.7, depth + 1);
  }
  const path = (dx: number, dy: number) => {
    g.beginPath();
    pts.forEach(([px, py], i) => (i ? g.lineTo(px + dx, py + dy) : g.moveTo(px + dx, py + dy)));
  };
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = wid;
  g.strokeStyle = 'rgba(255,248,230,0.35)';
  path(0.8, 1);
  g.stroke();
  g.strokeStyle = 'rgba(48,32,20,0.8)';
  path(0, 0);
  g.stroke();
}

function scratches(g: G, r: Rng, n: number, box: [number, number, number, number], rgb: string, a: number, maxLen: number) {
  const [x0, y0, bw, bh] = box;
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * bw;
    const y = y0 + r() * bh;
    const len = maxLen * (0.2 + r() * 0.8);
    const an = (r() - 0.5) * 1.2 + (r() < 0.3 ? Math.PI / 2 : 0);
    g.strokeStyle = `rgba(${rgb},${a * (0.4 + r() * 0.6)})`;
    g.lineWidth = 0.6 + r() * 0.9;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(an) * len * 0.5 + (r() - 0.5) * 3, y + Math.sin(an) * len * 0.5 + (r() - 0.5) * 3, x + Math.cos(an) * len, y + Math.sin(an) * len);
    g.stroke();
  }
}

function specks(g: G, r: Rng, n: number, w: number, h: number, rgb: string, a: number) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(${rgb},${a * (0.3 + r() * 0.7)})`;
    g.beginPath();
    g.arc(r() * w, r() * h, 0.4 + r() * 1.4, 0, Math.PI * 2);
    g.fill();
  }
}

/** Dirt worked into the edges, thickest along the bottom where hands and dust collect. */
function edgeGrime(g: G, w: number, h: number, rgb: string, a: number, size: number) {
  const band = (x0: number, y0: number, x1: number, y1: number, k: number) => {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, `rgba(${rgb},${a * k})`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  };
  band(0, 0, size, 0, 1);
  band(w, 0, w - size, 0, 1);
  band(0, 0, 0, size, 0.8);
  band(0, h, 0, h - size * 1.5, 1.4);
}

function roundRectPath(g: G, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Front-face x (body units) to canvas x, for the three front decals (all FACE.w wide). */
const fx = (x: number, w: number) => ((x - FACE.x0) / FACE.w) * w;
const fy = (y: number, h: number) => ((FACE.top - y) / (FACE.top - FACE.bottom)) * h;

/** The rainbow: five bands side by side, from `y0` down to the bottom of the canvas. */
function rainbow(g: G, w: number, y0: number, y1: number, aged: boolean, r: Rng) {
  STRIPES.forEach((c, i) => {
    const xa = fx(STRIPE_X0 + i * STRIPE_W, w);
    const xb = fx(STRIPE_X0 + (i + 1) * STRIPE_W, w);
    g.fillStyle = c;
    g.fillRect(xa, y0, xb - xa + 0.6, y1 - y0);
  });
  if (!aged) return;
  const xa = fx(STRIPE_X0, w);
  const sw = fx(STRIPE_X0 + STRIPES.length * STRIPE_W, w) - xa;
  // faded by the sun, and the paint flaked off here and there down to the cream
  g.fillStyle = 'rgba(217,201,166,0.16)';
  g.fillRect(xa, y0, sw, y1 - y0);
  for (let i = 0; i < 22; i++) {
    const x = xa + r() * sw;
    const y = y0 + r() * (y1 - y0);
    const s = 1.5 + r() * 4;
    g.fillStyle = 'rgba(224,210,178,0.9)';
    g.beginPath();
    g.moveTo(x, y - s);
    g.lineTo(x + s * (0.6 + r()), y - s * 0.2);
    g.lineTo(x + s * 0.3, y + s * (0.6 + r() * 0.5));
    g.lineTo(x - s * (0.5 + r() * 0.5), y + s * 0.3);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(70,45,25,0.35)';
    g.lineWidth = 0.6;
    g.stroke();
  }
}

/** The upper front: cream plastic and the top of the rainbow; after the Reveal cracked and stained. */
function paintFace(g: G, w: number, h: number, aged: boolean) {
  const r = seeded(31);
  g.fillStyle = aged ? CREAM_OLD : CREAM_NEW;
  g.fillRect(0, 0, w, h);
  grain(g, w, h, aged ? 10 : 4, false, 11);
  rainbow(g, w, fy(LENS.y, h), h, aged, r);
  if (!aged) {
    edgeGrime(g, w, h, '140,115,80', 0.08, 30);
    return;
  }
  const yellow = g.createRadialGradient(w * 0.45, h * 0.45, h * 0.2, w / 2, h / 2, w * 0.6);
  yellow.addColorStop(0, 'rgba(150,110,60,0)');
  yellow.addColorStop(1, 'rgba(150,110,60,0.2)');
  g.fillStyle = yellow;
  g.fillRect(0, 0, w, h);
  edgeGrime(g, w, h, '82,58,32', 0.4, 40);
  // rust run down from the flash window's frame and from the photocell's ring
  const fb = fy(FLASH.y - 0.097, h);
  for (const [dx, len, wid] of [
    [-0.06, 220, 12],
    [0.01, 160, 16],
    [0.065, 250, 10],
  ] as const) {
    streak(g, r, fx(FLASH.x + dx, w), fb, len, wid, '122,62,24', 0.45);
  }
  const eb = fy(EYE.y - 0.05, h);
  streak(g, r, fx(EYE.x - 0.015, w), eb, 120, 9, '122,62,24', 0.5);
  streak(g, r, fx(EYE.x + 0.025, w), eb, 90, 7, '122,62,24', 0.4);
  // old stains
  for (const [x, y, s, a] of [
    [-0.62, 0.12, 70, 0.28],
    [0.62, 0.66, 50, 0.24],
    [0.22, 0.08, 90, 0.26],
    [-0.3, 0.66, 40, 0.22],
    [0.68, 0.22, 60, 0.3],
    [-0.68, 0.45, 45, 0.2],
  ] as const) {
    stain(g, r, fx(x, w), fy(y, h), s, '125,80,40', a);
  }
  // stress cracks running out from the lens mount, and in from the corners
  for (const a of [-2.6, -0.4, 0.5, 2.25, 3.4]) {
    const sx = fx(LENS.x + Math.cos(a) * 0.272, w);
    const sy = fy(LENS.y + Math.sin(a) * 0.272, h);
    crack(g, r, sx, sy, 60 + r() * 60, -a, 1.3);
  }
  crack(g, r, 0, h * 0.9, 90, -0.3, 1.4);
  crack(g, r, w, h * 0.15, 70, Math.PI + 0.2, 1.3);
  crack(g, r, w * 0.5, h, 50, -Math.PI / 2 - 0.2, 1.2);
  crack(g, r, w * 0.82, 0, 60, Math.PI / 2 + 0.3, 1.1);
  scratches(g, r, 50, [0, 0, w, h], '255,248,232', 0.4, 40);
  scratches(g, r, 24, [0, 0, w, h], '70,50,30', 0.35, 30);
  specks(g, r, 500, w, h, '60,45,30', 0.35);
}

/** The sloped ledge: the rainbow running over it; dust settles on it after the Reveal. */
function paintLedge(g: G, w: number, h: number, aged: boolean) {
  const r = seeded(43);
  g.fillStyle = aged ? CREAM_OLD : CREAM_NEW;
  g.fillRect(0, 0, w, h);
  grain(g, w, h, aged ? 10 : 4, false, 12);
  rainbow(g, w, 0, h, aged, r);
  if (!aged) return;
  const dust = g.createLinearGradient(0, 0, 0, h);
  dust.addColorStop(0, 'rgba(110,85,55,0.4)');
  dust.addColorStop(1, 'rgba(110,85,55,0.08)');
  g.fillStyle = dust;
  g.fillRect(0, 0, w, h);
  edgeGrime(g, w, h, '82,58,32', 0.35, 40);
  specks(g, r, 600, w, h, '70,55,35', 0.4);
  specks(g, r, 200, w, h, '235,225,205', 0.3);
  stain(g, r, w * 0.78, h * 0.5, 50, '125,80,40', 0.25);
  crack(g, r, w * 0.3, 0, 60, 1.2, 1.2);
}

/** The brown leatherette panel with its inset frame line and the print slot near the bottom. */
function paintPanel(g: G, w: number, h: number, aged: boolean) {
  const r = seeded(57);
  const base = g.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, '#7a4020');
  base.addColorStop(0.5, '#8a4a22');
  base.addColorStop(1, '#6a3519');
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  const side = g.createLinearGradient(0, 0, w, 0);
  side.addColorStop(0, 'rgba(60,28,10,0.6)');
  side.addColorStop(0.12, 'rgba(60,28,10,0)');
  side.addColorStop(0.88, 'rgba(60,28,10,0)');
  side.addColorStop(1, 'rgba(60,28,10,0.6)');
  g.fillStyle = side;
  g.fillRect(0, 0, w, h);
  edgeGrime(g, w, h, '58,28,12', aged ? 0.7 : 0.35, 26);
  grain(g, w, h, aged ? 22 : 15, true, 5);
  // the inset frame line, pressed into the leather, with a light edge beside it
  roundRectPath(g, 18, 14, w - 36, h - 28, 10);
  g.strokeStyle = 'rgba(255,190,140,0.16)';
  g.lineWidth = 1.5;
  g.save();
  g.translate(1.5, 2);
  g.stroke();
  g.restore();
  g.strokeStyle = 'rgba(35,14,4,0.78)';
  g.lineWidth = 3;
  roundRectPath(g, 18, 14, w - 36, h - 28, 10);
  g.stroke();
  // the slot: dark inside, a shadow under its upper lip
  const sy = ((PANEL.top - SLOT_Y) / (PANEL.top - PANEL.bottom)) * h;
  const sh = (0.05 / (PANEL.top - PANEL.bottom)) * h;
  const sx = fx(-0.45, w);
  const sw = fx(0.45, w) - sx;
  roundRectPath(g, sx, sy - sh / 2, sw, sh, sh / 2);
  g.fillStyle = '#0b0604';
  g.fill();
  if (!aged) {
    const sheen = g.createLinearGradient(0, 0, 0, h);
    sheen.addColorStop(0.2, 'rgba(255,220,180,0)');
    sheen.addColorStop(0.35, 'rgba(255,220,180,0.07)');
    sheen.addColorStop(0.5, 'rgba(255,220,180,0)');
    g.fillStyle = sheen;
    g.fillRect(0, 0, w, h);
    return;
  }
  // worn patches where thumbs rubbed it, scuffs, scratches, dirt
  for (let i = 0; i < 9; i++) {
    const x = r() * w;
    const y = r() * h;
    const rad = 20 + r() * 50;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(168,112,72,0.26)');
    gr.addColorStop(1, 'rgba(168,112,72,0)');
    g.fillStyle = gr;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 5; i++) stain(g, r, r() * w, r() * h, 30 + r() * 40, '38,18,6', 0.3);
  scratches(g, r, 80, [0, 0, w, h], '214,160,110', 0.45, 60);
  scratches(g, r, 30, [0, 0, w, h], '30,12,4', 0.4, 40);
  specks(g, r, 300, w, h, '30,14,6', 0.4);
}

/** The rest of the shell (top, sides, back, the lens ring): plain cream, aged after the Reveal. */
function paintShell(g: G, w: number, h: number, aged: boolean) {
  const r = seeded(71);
  g.fillStyle = aged ? CREAM_OLD : CREAM_NEW;
  g.fillRect(0, 0, w, h);
  grain(g, w, h, aged ? 10 : 4, false, 13);
  if (!aged) return;
  for (let i = 0; i < 12; i++) {
    const x = r() * w;
    const y = r() * h;
    const rad = 40 + r() * 90;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(150,110,60,0.14)');
    gr.addColorStop(1, 'rgba(150,110,60,0)');
    g.fillStyle = gr;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 6; i++) stain(g, r, r() * w, r() * h, 30 + r() * 50, '125,80,40', 0.25);
  for (let i = 0; i < 4; i++) crack(g, r, r() * w, r() * h, 50 + r() * 60, r() * Math.PI * 2, 1.2);
  scratches(g, r, 40, [0, 0, w, h], '255,248,232', 0.35, 30);
  specks(g, r, 700, w, h, '60,45,30', 0.35);
}

/** The flash bar on top: brown plastic by day; rusty brown, pitted, after the Reveal. */
function paintBar(g: G, w: number, h: number, aged: boolean) {
  const r = seeded(83);
  g.fillStyle = aged ? '#7a3f1f' : '#6a371d';
  g.fillRect(0, 0, w, h);
  grain(g, w, h, aged ? 18 : 8, true, 7);
  if (!aged) return;
  for (let i = 0; i < 25; i++) {
    const x = r() * w;
    const y = r() * h;
    const rad = 4 + r() * 16;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(176,96,42,0.45)');
    gr.addColorStop(1, 'rgba(176,96,42,0)');
    g.fillStyle = gr;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  specks(g, r, 300, w, h, '30,14,6', 0.5);
  scratches(g, r, 20, [0, 0, w, h], '200,140,90', 0.35, 20);
}

/** The lens's front glass: deep and dark, a window reflected warm in it (cracked after the Reveal). */
function paintLensGlass(g: G, w: number, h: number, aged: boolean) {
  const r = seeded(97);
  g.clearRect(0, 0, w, h);
  const base = g.createRadialGradient(w * 0.42, h * 0.4, 0, w / 2, h / 2, w / 2);
  base.addColorStop(0, 'rgba(22,26,32,0.3)');
  base.addColorStop(1, 'rgba(4,5,8,0.7)');
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  // the window: four panes, bowed by the glass, up to the left
  const pane = aged ? 'rgba(255,190,118,0.85)' : 'rgba(250,246,236,0.75)';
  g.save();
  g.translate(w * 0.34, h * 0.33);
  g.rotate(-0.25);
  g.shadowColor = pane;
  g.shadowBlur = 10;
  g.fillStyle = pane;
  for (const [x, y] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    roundRectPath(g, x > 0 ? 3 : -25, y > 0 ? 4 : -30, 22, 26, 4);
    g.fill();
  }
  g.restore();
  // a faint rim of light round the lower right
  g.strokeStyle = aged ? 'rgba(255,200,150,0.22)' : 'rgba(255,255,255,0.22)';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(w / 2, h / 2, w * 0.44, 0.1, 1.4);
  g.stroke();
  if (!aged) return;
  specks(g, r, 120, w, h, '220,210,190', 0.25);
  g.strokeStyle = 'rgba(230,225,210,0.45)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(w * 0.62, h * 0.06);
  g.lineTo(w * 0.55, h * 0.34);
  g.lineTo(w * 0.6, h * 0.52);
  g.lineTo(w * 0.52, h * 0.8);
  g.moveTo(w * 0.55, h * 0.34);
  g.lineTo(w * 0.78, h * 0.42);
  g.stroke();
}

/** The flash window: a ribbed silver reflector by day; after the Reveal dark, a warm light inside. */
function paintFlash(g: G, w: number, h: number, aged: boolean) {
  const r = seeded(101);
  const base = g.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, aged ? '#1a120c' : '#e2e2de');
  base.addColorStop(1, aged ? '#0d0906' : '#a8a9a5');
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  const glow = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.55);
  glow.addColorStop(0, aged ? 'rgba(255,176,86,0.95)' : 'rgba(255,255,255,0.8)');
  glow.addColorStop(0.45, aged ? 'rgba(200,110,40,0.45)' : 'rgba(255,255,255,0.25)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  // the ribs of the fresnel cover
  for (let y = 3; y < h; y += 6) {
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(0, y, w, 1.5);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(0, y + 2, w, 1.5);
  }
  if (aged) specks(g, r, 80, w, h, '20,10,4', 0.5);
}

/** The viewfinder's glass; after the Reveal, deep in it, a pale point, like an eye looking out. */
function paintView(g: G, w: number, h: number, aged: boolean) {
  const base = g.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, '#1d2430');
  base.addColorStop(1, '#06080b');
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.12)';
  g.beginPath();
  g.moveTo(w * 0.1, 0);
  g.lineTo(w * 0.3, 0);
  g.lineTo(w * 0.12, h);
  g.lineTo(0, h);
  g.closePath();
  g.fill();
  if (!aged) return;
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.fillRect(0, 0, w, h);
  const eye = g.createRadialGradient(w * 0.66, h * 0.52, 0, w * 0.66, h * 0.52, 7);
  eye.addColorStop(0, 'rgba(232,226,210,0.55)');
  eye.addColorStop(0.35, 'rgba(232,226,210,0.12)');
  eye.addColorStop(1, 'rgba(232,226,210,0)');
  g.fillStyle = eye;
  g.fillRect(0, 0, w, h);
}

let photoCache: HTMLCanvasElement | null = null;
/** Her photograph (the letter's), painted once and kept. */
function witchPhoto(size: number): HTMLCanvasElement {
  if (photoCache && photoCache.width === size) return photoCache;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  if (g) drawWitchPhoto(g, size, size, 0.02);
  photoCache = c;
  return c;
}

/**
 * The print: an aged instant-film frame, her photograph in the window and "you, tonight" in
 * dark pen on the wide bottom strip. While it develops the picture is a murky dark that clears.
 */
function paintPrint(g: G, w: number, h: number, dev: number) {
  const r = seeded(113);
  g.fillStyle = '#e4d7b8';
  g.fillRect(0, 0, w, h);
  grain(g, w, h, 8, false, 3);
  const b = Math.round(w * 0.068);
  const s = w - 2 * b;
  g.drawImage(witchPhoto(s), b, b, s, s);
  const k = clamp01(dev);
  g.fillStyle = `rgba(24,28,22,${Math.pow(1 - k, 1.1) * 0.98})`;
  g.fillRect(b, b, s, s);
  g.fillStyle = `rgba(40,80,70,${Math.sin(Math.PI * k) * 0.22})`;
  g.fillRect(b, b, s, s);
  g.strokeStyle = 'rgba(60,45,30,0.5)';
  g.lineWidth = 2;
  g.strokeRect(b, b, s, s);
  // the caption, written on the strip in dark pen: big enough to read on the card
  g.save();
  g.translate(w / 2, b + s + (h - b - s) / 2 + 2);
  g.rotate(-0.035);
  g.fillStyle = '#1a1210';
  g.font = `bold ${Math.round(w * 0.135)}px "Segoe Script", "Brush Script MT", cursive`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('you, tonight', 0, 0);
  g.restore();
  edgeGrime(g, w, h, '110,80,45', 0.35, 26);
  stain(g, r, w * 0.84, h * 0.93, 40, '140,100,50', 0.22);
  stain(g, r, w * 0.12, h * 0.05, 26, '140,100,50', 0.18);
  specks(g, r, 120, w, h, '80,60,40', 0.3);
}

// ---------------------------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------------------------

function useLook(haunted: boolean) {
  const shellTex = useCanvasTexture(512, 512, (g, w, h) => paintShell(g, w, h, haunted), [haunted]);
  const barTex = useCanvasTexture(256, 128, (g, w, h) => paintBar(g, w, h, haunted), [haunted]);
  useEffect(() => tile(shellTex, 1, 1), [shellTex]);
  useEffect(() => tile(barTex, 2, 2), [barTex]);
  const look = useMemo(
    () => ({
      cream: new THREE.MeshPhysicalMaterial({
        map: shellTex,
        roughness: haunted ? 0.72 : 0.38,
        clearcoat: haunted ? 0 : 0.5,
        clearcoatRoughness: 0.4,
        side: THREE.DoubleSide,
      }),
      band: new THREE.MeshStandardMaterial({ color: haunted ? '#231914' : '#1a1411', roughness: haunted ? 0.8 : 0.45 }),
      bar: new THREE.MeshStandardMaterial({ map: barTex, roughness: haunted ? 0.85 : 0.5 }),
      barrel: new THREE.MeshStandardMaterial({
        color: haunted ? '#15130f' : '#0d0c0b',
        roughness: haunted ? 0.62 : 0.32,
        metalness: 0.2,
        flatShading: true,
        side: THREE.DoubleSide,
      }),
      chrome: new THREE.MeshStandardMaterial({ color: haunted ? '#4a3d30' : '#5d5c5a', metalness: 0.85, roughness: haunted ? 0.65 : 0.3, side: THREE.DoubleSide }),
      blade: new THREE.MeshStandardMaterial({ color: haunted ? '#1c1814' : '#1f1e1d', metalness: 0.55, roughness: haunted ? 0.6 : 0.42 }),
      blade2: new THREE.MeshStandardMaterial({ color: haunted ? '#231e19' : '#282624', metalness: 0.55, roughness: haunted ? 0.6 : 0.42 }),
      gloss: new THREE.MeshPhysicalMaterial({ color: '#050505', roughness: 0.1, clearcoat: 1, side: THREE.DoubleSide }),
    }),
    [haunted, shellTex, barTex],
  );
  useEffect(() => () => disposeAll(look), [look]);
  return look;
}
type Look = ReturnType<typeof useLook>;

/** The cream shell, the dark band round the top and the rusty flash bar on it. */
function Shell({ parts, look }: { parts: Parts; look: Look }) {
  return (
    <>
      <mesh geometry={parts.shell} material={look.cream} />
      <mesh geometry={parts.band} material={look.band} />
      <mesh geometry={parts.bar} material={look.bar} position={[0, 0.859, -0.04]} />
    </>
  );
}

/** The painted fronts: the upper face, the sloped ledge and the brown panel. */
function Front({ haunted }: { haunted: boolean }) {
  const face = useCanvasTexture(1024, 480, (g, w, h) => paintFace(g, w, h, haunted), [haunted]);
  const ledge = useCanvasTexture(1024, 128, (g, w, h) => paintLedge(g, w, h, haunted), [haunted]);
  const panel = useCanvasTexture(1024, 224, (g, w, h) => paintPanel(g, w, h, haunted), [haunted]);
  const rough = haunted ? 0.72 : 0.38;
  const coat = haunted ? 0 : 0.5;
  return (
    <>
      <mesh position={[0, (FACE.top + FACE.bottom) / 2, FACE_Z + 0.0015]}>
        <planeGeometry args={[FACE.w, FACE.top - FACE.bottom]} />
        <meshPhysicalMaterial map={face} roughness={rough} clearcoat={coat} clearcoatRoughness={0.4} />
      </mesh>
      <mesh position={[0, LEDGE.y + 0.759 * 0.0015, LEDGE.z + 0.651 * 0.0015]} rotation-x={LEDGE.tilt}>
        <planeGeometry args={[FACE.w, LEDGE.len]} />
        <meshPhysicalMaterial map={ledge} roughness={rough} clearcoat={coat} clearcoatRoughness={0.4} />
      </mesh>
      <mesh position={[0, (PANEL.top + PANEL.bottom) / 2, LOW_Z + 0.0015]}>
        <planeGeometry args={[FACE.w, PANEL.top - PANEL.bottom]} />
        <meshPhysicalMaterial map={panel} roughness={haunted ? 0.82 : 0.6} clearcoat={haunted ? 0 : 0.2} clearcoatRoughness={0.6} />
      </mesh>
    </>
  );
}

/** Six blades in the barrel, overlapping a hair apart, turned by `setIris`. */
function Iris({ parts, look, blades }: { parts: Parts; look: Look; blades: RefObject<(THREE.Mesh | null)[]> }) {
  return (
    <>
      {Array.from({ length: 6 }, (_, i) => (
        <group key={i} rotation-z={(i * Math.PI) / 3}>
          <mesh
            ref={(m) => {
              blades.current[i] = m;
            }}
            geometry={parts.blade}
            material={i % 2 ? look.blade2 : look.blade}
            position={[IRIS.pivot, 0, 0.008 + i * 0.0008]}
          />
        </group>
      ))}
    </>
  );
}

/** The big lens: cream ring, dark gap, ribbed black barrel, the iris, the deep glass. */
function Lens({ parts, look, haunted, blades }: { parts: Parts; look: Look; haunted: boolean; blades: RefObject<(THREE.Mesh | null)[]> }) {
  const glass = useCanvasTexture(256, 256, (g, w, h) => paintLensGlass(g, w, h, haunted), [haunted]);
  return (
    <group position={[LENS.x, LENS.y, FACE_Z + 0.002]}>
      <mesh geometry={parts.ring} material={look.cream} />
      <mesh position-z={0.004}>
        <ringGeometry args={[0.186, 0.204, 96]} />
        <meshStandardMaterial color="#070605" roughness={0.9} />
      </mesh>
      <mesh geometry={parts.barrel} material={look.barrel} />
      {/* the dark inside, the rim of an inner element far down in it */}
      <mesh position-z={0.002}>
        <circleGeometry args={[IRIS.rin + 0.002, 64]} />
        <meshStandardMaterial color="#020203" roughness={0.3} />
      </mesh>
      <mesh position-z={0.0025}>
        <ringGeometry args={[0.052, 0.058, 64]} />
        <meshStandardMaterial color="#1b1d22" roughness={0.25} metalness={0.6} />
      </mesh>
      <Iris parts={parts} look={look} blades={blades} />
      <mesh geometry={parts.dome} position-z={0.02}>
        <meshPhysicalMaterial map={glass} transparent depthWrite={false} roughness={0.04} clearcoat={1} metalness={0} />
      </mesh>
    </group>
  );
}

/** Viewfinder, shutter button, flash window (and its light), photocell eye. */
function Controls({
  parts,
  look,
  haunted,
  win,
  light,
}: {
  parts: Parts;
  look: Look;
  haunted: boolean;
  win: RefObject<THREE.MeshBasicMaterial | null>;
  light: RefObject<THREE.PointLight | null>;
}) {
  const flash = useCanvasTexture(128, 128, (g, w, h) => paintFlash(g, w, h, haunted), [haunted]);
  const view = useCanvasTexture(128, 64, (g, w, h) => paintView(g, w, h, haunted), [haunted]);
  return (
    <>
      <mesh geometry={parts.viewFrame} position={[VIEW.x, VIEW.y, FACE_Z + 0.003]} material={look.band} />
      <mesh position={[VIEW.x, VIEW.y, FACE_Z + 0.005]}>
        <planeGeometry args={[0.206, 0.091]} />
        <meshStandardMaterial map={view} roughness={0.08} metalness={0.1} />
      </mesh>
      <mesh geometry={parts.bezel} position={[BTN.x, BTN.y, FACE_Z + 0.0015]} material={look.cream} />
      <mesh geometry={parts.button} position={[BTN.x, BTN.y, FACE_Z + 0.0015]}>
        <meshPhysicalMaterial color={haunted ? '#b9431f' : '#d9481f'} roughness={haunted ? 0.55 : 0.25} clearcoat={haunted ? 0.1 : 0.8} />
      </mesh>
      <mesh geometry={parts.flashFrame} position={[FLASH.x, FLASH.y, FACE_Z + 0.003]} material={look.chrome} />
      <mesh position={[FLASH.x, FLASH.y, FACE_Z + 0.006]}>
        <planeGeometry args={[0.158, 0.158]} />
        <meshBasicMaterial ref={win} map={flash} color="#cccccc" toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[FLASH.x, FLASH.y, FACE_Z + 0.5]} color="#f4f6ff" distance={5} intensity={0} />
      <mesh geometry={parts.eyeRing} position={[EYE.x, EYE.y, FACE_Z + 0.0015]} material={look.chrome} />
      <mesh geometry={parts.eyeDome} position={[EYE.x, EYE.y, FACE_Z + 0.0015]} material={look.gloss} />
    </>
  );
}

/** The slot's two rounded lips; the print comes out from between them. */
function Slot({ parts, look }: { parts: Parts; look: Look }) {
  return (
    <>
      <mesh geometry={parts.lip} material={look.band} position={[0, SLOT_Y + 0.021, LOW_Z + 0.008]} />
      <mesh geometry={parts.lip} material={look.band} position={[0, SLOT_Y - 0.021, LOW_Z + 0.012]} />
    </>
  );
}

/** The print (only once taken), developing on an interval; black on the back, as film is. */
function Print({ parts, group, plane, since }: { parts: Parts; group: RefObject<THREE.Group | null>; plane: THREE.Plane; since: () => number }) {
  const [dev, setDev] = useState(() => (since() === Infinity ? 1 : 0));
  useEffect(() => {
    const id = setInterval(() => {
      const d = clamp01((since() - CAMERA.printFrom) / CAMERA.developFor);
      setDev(d);
      if (d >= 1) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, [since]);
  const photo = useCanvasTexture(512, 623, (g, w, h) => paintPrint(g, w, h, dev), [dev]);
  return (
    <group ref={group} visible={false}>
      <mesh geometry={parts.print}>
        <meshStandardMaterial map={photo} roughness={0.5} clippingPlanes={[plane]} />
      </mesh>
      <mesh geometry={parts.print} position-z={-0.0015}>
        <meshStandardMaterial color="#141210" roughness={0.7} side={THREE.BackSide} clippingPlanes={[plane]} />
      </mesh>
    </group>
  );
}

/**
 * Instant camera, the 1970s kind that prints its picture: a cream body with a dark band round
 * the top and a rusty flash bar on it; on the front the big ribbed lens, a viewfinder, a red
 * shutter button, a square flash window and a photocell eye, a rainbow stripe running down over
 * the ledge, and below a brown leatherette panel with the print slot. By day it is new and clean,
 * its iris open. After the Reveal it is cracked, stained and rust-streaked; the iris is shut,
 * and now and then opens a crack. Taken: whatever way it was turned (or you have turned it), it
 * rises and comes round to face you square on, the iris swings open, it flashes once, and the
 * print slides out of the slot and develops: her photograph, and under it, "you, tonight".
 */
export function InstantCamera() {
  const haunted = useHaunted();
  const { taken, since } = useTaken('instant-camera');
  const body = useRef<THREE.Group>(null);
  const print = useRef<THREE.Group>(null);
  const flashLight = useRef<THREE.PointLight>(null);
  const flashWin = useRef<THREE.MeshBasicMaterial>(null);
  const blades = useRef<(THREE.Mesh | null)[]>([]);
  const parts = useMemo(() => makeParts(), []);
  useEffect(() => () => disposeAll(parts), [parts]);
  const look = useLook(haunted);
  const gl = useThree((s) => s.gl);
  const [slotPlane] = useState(() => new THREE.Plane());
  useEffect(() => enableLocalClipping(gl), [gl]);
  useFrame((st) => {
    const s = since();
    const k = taken ? progress(s, CAMERA.turnFor, CAMERA.turnFrom) : 0;
    if (body.current) {
      body.current.position.y = LIFT * k;
      // it comes round to look straight at you before it takes the picture, and keeps doing so
      aimBody(body.current, st.camera, k);
    }
    setIris(blades.current, irisShut(s, taken, haunted, st.clock.elapsedTime));
    // One flash, a quarter of a second, once it is looking at you and the iris is open.
    const f = taken && s !== Infinity && s > CAMERA.flashAt && s < CAMERA.flashAt + 0.25 ? 1 - (s - CAMERA.flashAt) / 0.25 : 0;
    if (flashLight.current) flashLight.current.intensity = f * 30;
    if (flashWin.current) flashWin.current.color.setScalar(0.8 + f * 6);
    if (print.current) {
      const out = taken ? progress(s, CAMERA.printFor, CAMERA.printFrom) : 0;
      print.current.visible = out > 0;
      // It starts inside the body and slides down out of the slot until its top edge is just
      // inside the slot; everything of it above the slot is cut away, so only what has come out shows.
      print.current.position.set(0, SLOT_Y + 0.012 + PRINT.h * (1 - out), PRINT.z);
      print.current.rotation.x = -0.05 * out * out;
      if (body.current) clipAtSlot(body.current, slotPlane);
    }
  });
  return (
    <group position-y={-0.025} scale={0.85}>
      <group ref={body} rotation={REST}>
        <group position-y={-OFF}>
          <Shell parts={parts} look={look} />
          <Front haunted={haunted} />
          <Lens parts={parts} look={look} haunted={haunted} blades={blades} />
          <Controls parts={parts} look={look} haunted={haunted} win={flashWin} light={flashLight} />
          <Slot parts={parts} look={look} />
          {taken && <Print parts={parts} group={print} plane={slotPlane} since={since} />}
          {/* where the print hangs once it is out, so the product view frames it after the Take */}
          <mesh position={[0, SLOT_Y - PRINT.h / 2 - 0.01, 0.385]} userData={{ frame: true }}>
            <boxGeometry args={[0.82, PRINT.h + 0.06, 0.08]} />
            <meshBasicMaterial visible={false} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
