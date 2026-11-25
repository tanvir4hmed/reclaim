import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { seeded } from '../../director/footprints';
import { reducedMotion } from '../../director/runtime';
import { useCanvasTexture } from '../../gl/canvasTex';
import { mat } from '../../gl/decay';
import { M } from '../../gl/materials';
import { progress, useTaken } from '../../gl/useTaken';
import { useHaunted } from '../../store';
import { sweep } from '../doll/shapes';

/*
 * The nutcracker guard: a turned and painted wooden soldier on a round green base. Black boots,
 * white trousers, a red coat with gold buttons, braid, belt and epaulettes, a big painted head
 * with a white fur beard and hair, a tall black shako with a gold badge and a plume, and the
 * hinged jaw worked by the lever down his back. A walnut lies on the base at his feet.
 * After the Reveal the paint is faded, dusty and crazed with cracks, his eyes are black holes,
 * the beard is grey and matted, and now and then the jaw works on its own.
 * Taken: the jaw drops by itself (the lever rises), showing a mouth of small human teeth; the
 * walnut floats up into it; the jaw snaps shut, the shell falls in two halves to the base, and
 * thin red lines run from the corners of his mouth down over the beard.
 * All sizes are in units with y = 0 at the bottom of the base; the figure is 1.49 tall.
 */

/** Seconds into the Take. */
const T = { open: 0.3, openFor: 0.7, rise: 1.0, riseFor: 1.1, snap: 2.2, snapFor: 0.05, shake: 0.32, bleed: 2.6, bleedFor: 1.25 };
/** How far the jaw goes when fully open: turn about the pin, and the slide down and forward. */
const OPEN = { rot: 0.35, drop: 0.02, fwd: 0.06 };
/** The jaw's pin, through both sides of the head. */
const PIVOT = new THREE.Vector3(0, 0.95, -0.03);
const BASE_TOP = 0.09;
const NUT_R = 0.03;
/** Where the walnut lies on the base, and where it sits between his open jaws. */
const NUT_REST = new THREE.Vector3(0.14, BASE_TOP + NUT_R * 1.03, 0.2);
const MOUTH = new THREE.Vector3(0, 0.912, 0.11);
const GRAVITY = 5;

/** Painted wood: glossy by day; after the Reveal faded, dull and dusty (the cracks are an overlay). */
const P = {
  red: () => mat('nutRed', { surface: 'ceramic', color: '#b0121c', roughness: 0.3, clearcoat: 0.8, hauntedColor: '#5c211c', matte: 0.85, decay: { age: 0.55, dust: 0.5 } }),
  white: () => mat('nutWhite', { surface: 'ceramic', color: '#f3eee4', roughness: 0.35, clearcoat: 0.6, hauntedColor: '#9a9080', matte: 0.8, decay: { age: 0.7, dust: 0.5 } }),
  black: () => mat('nutBlack', { surface: 'ceramic', color: '#141110', roughness: 0.22, clearcoat: 1, hauntedColor: '#1e1b18', matte: 0.85, decay: { age: 0.4, dust: 0.75 } }),
  flesh: () => mat('nutFlesh', { surface: 'ceramic', color: '#efc9ab', roughness: 0.4, clearcoat: 0.5, hauntedColor: '#a39380', matte: 0.7, decay: { age: 0.6, dust: 0.45 } }),
  lip: () => mat('nutLip', { surface: 'ceramic', color: '#b02a33', roughness: 0.35, clearcoat: 0.6, hauntedColor: '#4a1c1c', matte: 0.7, decay: { age: 0.3, dust: 0 } }),
  green: () => mat('nutGreen', { surface: 'wood', color: '#1f5c3a', roughness: 0.38, clearcoat: 0.7, hauntedColor: '#1d2620', matte: 0.7, decay: { age: 0.5, dust: 0.6 } }),
  beard: () => mat('nutBeard', { surface: 'fur', color: '#f7f4ee', roughness: 1, sheen: 0.8, sheenColor: '#ffffff', hauntedColor: '#7c766b', decay: { dust: 0.7, age: 0.6 } }),
  plume: () => mat('nutPlume', { surface: 'fur', color: '#c8141f', roughness: 0.9, sheen: 0.7, sheenColor: '#ff8a8a', hauntedColor: '#3d1c1a', decay: { dust: 0.6, age: 0.5 } }),
  // the mouth only shows after the Reveal: dark, wet, and no dust settles in it
  mouth: () => mat('nutMouth', { color: '#2a090b', roughness: 0.45, decay: { age: 0, dust: 0 } }),
  gum: () => mat('nutGum', { surface: 'wax', color: '#5e1218', roughness: 0.3, clearcoat: 0.8, decay: { age: 0, dust: 0 } }),
  tooth: () => mat('nutTooth', { surface: 'ceramic', color: '#e6dcc2', roughness: 0.3, clearcoat: 0.6, hauntedColor: '#d2c49e', decay: { age: 0.2, dust: 0 } }),
  shell: () => mat('nutShell', { surface: 'wood', color: '#9a6a3c', roughness: 0.75, hauntedColor: '#5f452b', decay: { age: 0.4, dust: 0.3 } }),
  kernel: () => mat('nutKernel', { surface: 'cake', color: '#d9b47c', roughness: 0.8, hauntedColor: '#a5825a', decay: { age: 0.3, dust: 0 } }),
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
/** 0 most of the time; a smooth 0→1→0 bump `len` seconds long once every `period` seconds. */
function pulse(t: number, period: number, len: number, phase: number): number {
  const k = (t + phase * period) % period;
  return k > len ? 0 : Math.sin((k / len) * Math.PI);
}

/** A curve round the body's axis at height `y`, radius `r`, from angle `a0` to `a1` (0 = front). */
function arcCurve(r: number, y: number, a0: number, a1: number, n = 16): THREE.CatmullRomCurve3 {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push(new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r));
  }
  return new THREE.CatmullRomCurve3(pts);
}

/** The turned outline of the coat, (radius, height), from the hem up over the shoulders. */
const COAT: [number, number][] = [
  [0, 0.5],
  [0.155, 0.5],
  [0.163, 0.52],
  [0.158, 0.56],
  [0.146, 0.6],
  [0.14, 0.64],
  [0.147, 0.7],
  [0.154, 0.76],
  [0.152, 0.81],
  [0.136, 0.85],
  [0.1, 0.872],
  [0, 0.878],
];
/** The coat's radius at height y (for buttons and braid). */
function coatR(y: number): number {
  for (let i = 1; i < COAT.length; i++) {
    const [r0, y0] = COAT[i - 1]!;
    const [r1, y1] = COAT[i]!;
    if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
  }
  return 0;
}

/** The beard: how high it starts, how low it hangs, and how far out it stands, by angle round the head. */
const beardTop = (a: number) => 0.926 + 0.085 * smooth(0.7, 1.5, Math.abs(a));
const beardBot = (a: number) => 0.79 + 0.13 * (Math.abs(a) / 1.95) ** 1.4;
const beardR = (y: number, a: number) => 0.136 + 0.03 * smooth(0.95, 0.87, y) + 0.008 * Math.cos(a);

interface Blob {
  x: number;
  y: number;
  z: number;
  r: number;
  /** stretched downward (matted) */
  sy: number;
}

/** Many small balls merged into one shape: fluffy fur. */
function blobGeometry(list: Blob[]): THREE.BufferGeometry {
  const parts = list.map((b) => {
    const g = new THREE.SphereGeometry(1, 10, 8);
    g.scale(b.r, b.r * b.sy, b.r);
    g.translate(b.x, b.y - (b.sy - 1) * b.r * 0.6, b.z);
    return g;
  });
  const out = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  return out;
}

/** The beard, round the jaw from ear to ear and down over the chest. Haunted: thinner, matted, hanging lower. */
function beardBlobs(haunted: boolean): Blob[] {
  const r = seeded(haunted ? 77 : 41);
  const out: Blob[] = [];
  const n = haunted ? 250 : 320;
  for (let i = 0; i < n; i++) {
    const a = (r() * 2 - 1) * 1.95;
    const bot = beardBot(a) - (haunted ? r() * 0.035 : 0);
    const y = bot + Math.sqrt(r()) * (beardTop(a) - bot);
    const R = beardR(y, a) + r() * 0.008;
    out.push({
      x: Math.sin(a) * R,
      y,
      z: Math.cos(a) * R,
      r: (0.017 + r() * 0.011) * (haunted ? 0.78 : 1),
      sy: haunted ? 1.5 + r() * 0.9 : 1,
    });
  }
  return out;
}

/** His hair: round the back and sides of the head, under the hat. */
function hairBlobs(haunted: boolean): Blob[] {
  const r = seeded(haunted ? 23 : 19);
  const out: Blob[] = [];
  const n = haunted ? 120 : 150;
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    const a = side * (1.3 + r() * (Math.PI - 1.3));
    const y = 0.985 + r() * 0.155 - (haunted ? r() * 0.03 : 0);
    const R = 0.131 + r() * 0.008;
    out.push({ x: Math.sin(a) * R, y, z: Math.cos(a) * R, r: (0.016 + r() * 0.01) * (haunted ? 0.85 : 1), sy: haunted ? 1.4 + r() * 0.8 : 1 });
  }
  return out;
}

/** His painted face, wrapped round the head (front at the middle of the canvas, top of the head at the top). */
function drawFace(g: CanvasRenderingContext2D, w: number, h: number, haunted: boolean) {
  const cx = w / 2;
  g.fillStyle = haunted ? '#958874' : '#efc9ab';
  g.fillRect(0, 0, w, h);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const eyes = [-1, 1].map((s) => [cx + s * 60, 110] as const);
  const moustache = (fill: string, hair: string) => {
    for (const s of [-1, 1]) {
      g.fillStyle = fill;
      g.beginPath();
      g.moveTo(cx, 206);
      g.bezierCurveTo(cx + s * 26, 194, cx + s * 62, 198, cx + s * 84, 212);
      g.bezierCurveTo(cx + s * 100, 222, cx + s * 114, 206, cx + s * 106, 190);
      g.bezierCurveTo(cx + s * 122, 212, cx + s * 98, 240, cx + s * 70, 236);
      g.bezierCurveTo(cx + s * 44, 233, cx + s * 18, 236, cx, 228);
      g.closePath();
      g.fill();
      g.strokeStyle = hair;
      g.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        g.beginPath();
        g.moveTo(cx + s * 6, 210 + i * 3);
        g.quadraticCurveTo(cx + s * (40 + i * 4), 204 + i * 4, cx + s * (76 + i * 3), 220 + i * 2);
        g.stroke();
      }
    }
  };
  if (!haunted) {
    // rosy cheeks
    for (const s of [-1, 1]) {
      const grd = g.createRadialGradient(cx + s * 84, 160, 0, cx + s * 84, 160, 46);
      grd.addColorStop(0, 'rgba(226,88,84,0.62)');
      grd.addColorStop(1, 'rgba(226,88,84,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
    }
    // bold black brows
    g.strokeStyle = '#1b1311';
    g.lineWidth = 10;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx + s * 28, 82);
      g.quadraticCurveTo(cx + s * 60, 56, cx + s * 96, 78);
      g.stroke();
    }
    // round painted eyes: white, a dark blue iris, a black pupil, a highlight, lashes
    for (const [x, y] of eyes) {
      g.fillStyle = '#fbf7ee';
      g.beginPath();
      g.ellipse(x, y, 21, 13, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#22305a';
      g.beginPath();
      g.arc(x, y, 10.5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#060606';
      g.beginPath();
      g.arc(x, y, 5.5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(x - 3.5, y - 3.5, 3, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#1b1311';
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(x, y, 21, 13, 0, 0, Math.PI * 2);
      g.stroke();
      g.lineWidth = 5;
      g.beginPath();
      g.ellipse(x, y, 21, 13, 0, Math.PI * 1.08, Math.PI * 1.92);
      g.stroke();
      g.lineWidth = 2.5;
      const out = x < cx ? -1 : 1;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.moveTo(x + out * (10 + i * 5), y - 12 + i * 1.5);
        g.lineTo(x + out * (14 + i * 7), y - 20 + i * 2);
        g.stroke();
      }
    }
    moustache('#f7f3ec', 'rgba(170,160,146,0.8)');
    // the upper lip, along the bottom edge where the jaw meets the head
    g.fillStyle = '#b52a32';
    g.beginPath();
    g.ellipse(cx, 254, 64, 7, 0, 0, Math.PI * 2);
    g.fill();
    return;
  }
  // haunted: grime settled into the old paint
  const r = seeded(63);
  for (let i = 0; i < 28; i++) {
    const x = r() * w;
    const y = r() * h;
    const grd = g.createRadialGradient(x, y, 0, x, y, 20 + r() * 60);
    grd.addColorStop(0, `rgba(58,46,34,${0.14 + r() * 0.16})`);
    grd.addColorStop(1, 'rgba(58,46,34,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  }
  // what is left of the cheeks
  for (const s of [-1, 1]) {
    const grd = g.createRadialGradient(cx + s * 84, 160, 0, cx + s * 84, 160, 40);
    grd.addColorStop(0, 'rgba(120,58,48,0.22)');
    grd.addColorStop(1, 'rgba(120,58,48,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  }
  // paint flaked off down to the wood
  for (let i = 0; i < 16; i++) {
    g.fillStyle = 'rgba(122,92,62,0.85)';
    const x = r() * w;
    const y = 30 + r() * (h - 40);
    g.beginPath();
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const rr = (3 + r() * 9) * (0.6 + r() * 0.6);
      if (k) g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7);
      else g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7);
    }
    g.closePath();
    g.fill();
  }
  // brows, chipped and faded
  g.strokeStyle = 'rgba(40,30,26,0.55)';
  g.lineWidth = 7;
  g.setLineDash([16, 6, 5, 9]);
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + s * 28, 84);
    g.quadraticCurveTo(cx + s * 60, 62, cx + s * 96, 82);
    g.stroke();
  }
  g.setLineDash([]);
  // the eyes are gone: two black holes in dark, sunken sockets, and a grey stain under each
  for (const [x, y] of eyes) {
    const halo = g.createRadialGradient(x, y, 8, x, y, 56);
    halo.addColorStop(0, 'rgba(12,7,6,0.9)');
    halo.addColorStop(0.45, 'rgba(30,22,18,0.45)');
    halo.addColorStop(1, 'rgba(30,22,18,0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(40,34,30,0.35)';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(x + 3, y + 16);
    g.quadraticCurveTo(x - 2, y + 50, x + 4, y + 82);
    g.stroke();
    const hole = g.createRadialGradient(x, y, 0, x, y, 22);
    hole.addColorStop(0, '#000000');
    hole.addColorStop(0.8, '#050303');
    hole.addColorStop(1, '#1a1210');
    g.fillStyle = hole;
    g.beginPath();
    g.ellipse(x, y, 22, 17, 0, 0, Math.PI * 2);
    g.fill();
  }
  // cracks through the paint: across the brow, down past an eye, over a cheek
  g.strokeStyle = 'rgba(24,16,11,0.9)';
  const crack = (pts: [number, number][], wd: number) => {
    g.lineWidth = wd;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
  };
  crack([[cx - 150, 40], [cx - 110, 66], [cx - 92, 98], [cx - 104, 140], [cx - 88, 176], [cx - 96, 214]], 2.6);
  crack([[cx - 110, 66], [cx - 70, 52], [cx - 30, 60]], 1.8);
  crack([[cx + 40, 26], [cx + 52, 60], [cx + 96, 94], [cx + 120, 150], [cx + 112, 196]], 2.2);
  crack([[cx + 120, 150], [cx + 160, 162]], 1.6);
  crack([[cx - 20, 150], [cx + 8, 170], [cx + 2, 196]], 1.5);
  moustache('#a39a88', 'rgba(58,50,40,0.75)');
  g.fillStyle = '#4a1c1c';
  g.beginPath();
  g.ellipse(cx, 254, 62, 6, 0, 0, Math.PI * 2);
  g.fill();
}

/** Old paint after the Reveal: a fine network of cracks and flakes gone down to bare wood (transparent elsewhere). */
function drawCraquelure(g: CanvasRenderingContext2D, w: number, h: number) {
  g.clearRect(0, 0, w, h);
  const r = seeded(17);
  for (let i = 0; i < 46; i++) {
    const x = r() * w;
    const y = r() * h;
    const s = 4 + r() * 14;
    g.fillStyle = `rgba(${150 + Math.floor(r() * 30)},${112 + Math.floor(r() * 20)},74,0.8)`;
    g.beginPath();
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const rr = s * (0.5 + r() * 0.7);
      if (k) g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7);
      else g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7);
    }
    g.closePath();
    g.fill();
  }
  g.strokeStyle = 'rgba(18,10,8,0.72)';
  g.lineWidth = 1.3;
  g.lineJoin = 'round';
  for (let i = 0; i < 150; i++) {
    let x = r() * w;
    let y = r() * h;
    let a = r() * Math.PI * 2;
    g.beginPath();
    g.moveTo(x, y);
    const n = 3 + Math.floor(r() * 5);
    for (let k = 0; k < n; k++) {
      a += (r() - 0.5) * 1.4;
      const len = 6 + r() * 18;
      x += Math.cos(a) * len;
      y += Math.sin(a) * len;
      g.lineTo(x, y);
    }
    g.stroke();
  }
}

/** The round painted base, gold-lined, with a ring of gold dots. */
function Base() {
  const g = useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          [0, 0],
          [0.33, 0],
          [0.346, 0.008],
          [0.352, 0.03],
          [0.347, 0.055],
          [0.336, 0.074],
          [0.322, 0.086],
          [0.31, 0.09],
          [0, 0.09],
        ].map(([r, y]) => new THREE.Vector2(r!, y!)),
        72,
      ),
    [],
  );
  useEffect(() => () => g.dispose(), [g]);
  return (
    <group>
      <mesh geometry={g} material={P.green()} />
      <mesh material={M.gilt()} position-y={0.072} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.338, 0.005, 8, 96]} />
      </mesh>
      <mesh material={M.gilt()} position-y={0.0905} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.3, 0.0035, 6, 96]} />
      </mesh>
      {Array.from({ length: 28 }, (_, i) => {
        const a = (i / 28) * Math.PI * 2;
        return (
          <mesh key={i} material={M.gilt()} position={[Math.sin(a) * 0.351, 0.034, Math.cos(a) * 0.351]} scale={[1, 1, 0.5]} rotation-y={a}>
            <sphereGeometry args={[0.0075, 10, 8]} />
          </mesh>
        );
      })}
    </group>
  );
}

/** White trousers and tall black boots with rounded toes. */
function Legs() {
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s} position-x={s * 0.072}>
          <mesh material={P.white()} position-y={0.41}>
            <cylinderGeometry args={[0.062, 0.064, 0.24, 32]} />
          </mesh>
          <mesh material={P.black()} position-y={0.2}>
            <cylinderGeometry args={[0.066, 0.064, 0.22, 32]} />
          </mesh>
          <mesh material={P.black()} position-y={0.305}>
            <cylinderGeometry args={[0.071, 0.071, 0.022, 32]} />
          </mesh>
          <mesh material={P.black()} position={[0, 0.118, 0.05]} scale={[0.06, 0.032, 0.095]}>
            <sphereGeometry args={[1, 24, 16]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** A gold epaulette: a domed plate with a fringe hanging round it. */
function Epaulette({ side }: { side: number }) {
  const fringe = useMemo(() => {
    const parts = Array.from({ length: 16 }, (_, i) => {
      const a = (i / 16) * Math.PI * 2;
      const g = new THREE.CylinderGeometry(0.0045, 0.004, 0.036, 6);
      g.translate(Math.cos(a) * 0.046, -0.022, Math.sin(a) * 0.046);
      return g;
    });
    const out = mergeGeometries(parts);
    parts.forEach((g) => g.dispose());
    return out;
  }, []);
  useEffect(() => () => fringe.dispose(), [fringe]);
  return (
    <group position={[side * 0.128, 0.846, 0]} rotation-z={-side * 0.55}>
      <mesh material={M.gilt()} scale={[1, 0.35, 1]}>
        <sphereGeometry args={[0.05, 24, 12]} />
      </mesh>
      <mesh geometry={fringe} material={M.gilt()} />
    </group>
  );
}

/** The red coat: hem trim, gold belt and buckle, two rows of buttons with braid, the collar. */
function Coat({ haunted, cracks }: { haunted: boolean; cracks: THREE.Texture }) {
  const g = useMemo(() => {
    const braid = [0.67, 0.71, 0.75].map((y) => new THREE.TubeGeometry(arcCurve(coatR(y) + 0.002, y, -0.34, 0.34), 24, 0.0042, 6));
    return {
      body: new THREE.LatheGeometry(
        COAT.map(([r, y]) => new THREE.Vector2(r, y)),
        64,
      ),
      braid,
    };
  }, []);
  useEffect(
    () => () => {
      g.body.dispose();
      g.braid.forEach((b) => b.dispose());
    },
    [g],
  );
  const beltR = coatR(0.635) + 0.004;
  return (
    <group>
      <mesh geometry={g.body} material={P.red()} />
      {haunted && (
        <mesh geometry={g.body} scale={1.004}>
          <meshStandardMaterial map={cracks} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-2} roughness={0.9} />
        </mesh>
      )}
      <mesh material={M.gilt()} position-y={0.503} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.157, 0.006, 8, 72]} />
      </mesh>
      <mesh material={M.gilt()} position-y={0.635}>
        <cylinderGeometry args={[beltR, beltR, 0.032, 64, 1, true]} />
      </mesh>
      <group position={[0, 0.635, beltR + 0.003]}>
        <mesh material={M.gilt()}>
          <boxGeometry args={[0.054, 0.044, 0.01]} />
        </mesh>
        <mesh material={P.red()} position-z={0.004}>
          <boxGeometry args={[0.032, 0.024, 0.006]} />
        </mesh>
      </group>
      {g.braid.map((b, i) => (
        <mesh key={i} geometry={b} material={M.gilt()} />
      ))}
      {[0.67, 0.71, 0.75].flatMap((y) =>
        [-1, 1].map((s) => {
          const a = s * 0.34;
          const r = coatR(y) + 0.004;
          return (
            <mesh key={`${y}${s}`} material={M.brass()} position={[Math.sin(a) * r, y, Math.cos(a) * r]} rotation-y={a} scale={[1, 1, 0.55]}>
              <sphereGeometry args={[0.012, 14, 10]} />
            </mesh>
          );
        }),
      )}
      <mesh material={M.gilt()} position-y={0.862}>
        <cylinderGeometry args={[0.112, 0.128, 0.03, 48]} />
      </mesh>
      <Epaulette side={-1} />
      <Epaulette side={1} />
    </group>
  );
}

/** Arms straight down at his sides: red sleeves, gold cuffs, white gloves. */
function Arms() {
  const sleeves = useMemo(
    () =>
      [-1, 1].map((s) =>
        sweep(
          new THREE.CatmullRomCurve3([
            new THREE.Vector3(s * 0.14, 0.835, -0.005),
            new THREE.Vector3(s * 0.178, 0.78, 0),
            new THREE.Vector3(s * 0.19, 0.68, 0.02),
            new THREE.Vector3(s * 0.186, 0.6, 0.035),
          ]),
          (t) => 0.044 - 0.008 * t,
          32,
          20,
        ),
      ),
    [],
  );
  useEffect(() => () => sleeves.forEach((g) => g.dispose()), [sleeves]);
  return (
    <group>
      {sleeves.map((g, i) => (
        <mesh key={i} geometry={g} material={P.red()} />
      ))}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh material={M.gilt()} position={[s * 0.186, 0.594, 0.036]}>
            <cylinderGeometry args={[0.04, 0.041, 0.03, 32]} />
          </mesh>
          <mesh material={P.white()} position={[s * 0.186, 0.555, 0.04]} scale={[0.9, 1.1, 0.95]}>
            <sphereGeometry args={[0.034, 20, 16]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** The tall black shako: gold bands, a badge on the front, a peak, and the plume (it droops after the Reveal). */
function Hat({ haunted, cracks }: { haunted: boolean; cracks: THREE.Texture }) {
  const g = useMemo(() => {
    const body = new THREE.LatheGeometry(
      [
        [0, 1.13],
        [0.131, 1.13],
        [0.134, 1.16],
        [0.142, 1.3],
        [0.147, 1.37],
        [0.148, 1.38],
        [0.141, 1.387],
        [0, 1.39],
      ].map(([r, y]) => new THREE.Vector2(r!, y!)),
      64,
    );
    const star = new THREE.Shape();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 ? 0.016 : 0.034;
      if (i) star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      else star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    star.closePath();
    const badge = new THREE.ExtrudeGeometry(star, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2 });
    const plumePath = haunted
      ? [
          [0, 1.375, 0.112],
          [0.025, 1.42, 0.14],
          [0.07, 1.432, 0.15],
          [0.104, 1.4, 0.142],
        ]
      : [
          [0, 1.375, 0.112],
          [0, 1.43, 0.118],
          [-0.004, 1.47, 0.104],
          [-0.006, 1.492, 0.084],
        ];
    const plume = sweep(
      new THREE.CatmullRomCurve3(plumePath.map(([x, y, z]) => new THREE.Vector3(x!, y!, z!))),
      (t) => 0.008 + 0.022 * Math.sin(Math.PI * Math.min(1, t * 1.1)) * (haunted ? 0.75 : 1),
      40,
      16,
    );
    return { body, badge, plume };
  }, [haunted]);
  useEffect(
    () => () => {
      g.body.dispose();
      g.badge.dispose();
      g.plume.dispose();
    },
    [g],
  );
  return (
    <group>
      <mesh geometry={g.body} material={P.black()} />
      {haunted && (
        <mesh geometry={g.body} scale={[1.004, 1, 1.004]}>
          <meshStandardMaterial map={cracks} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-2} roughness={0.9} />
        </mesh>
      )}
      <mesh material={M.gilt()} position-y={1.143} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.1335, 0.011, 10, 72]} />
      </mesh>
      <mesh material={M.gilt()} position-y={1.372} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.1475, 0.009, 10, 72]} />
      </mesh>
      {/* the peak over his eyes */}
      <mesh material={P.black()} position-y={1.134} rotation-x={0.14}>
        <cylinderGeometry args={[0.168, 0.168, 0.01, 32, 1, false, -1.1, 2.2]} />
      </mesh>
      {/* the badge: a gold rosette with a star on it */}
      <group position={[0, 1.255, 0.142]} rotation-x={-0.035}>
        <mesh material={M.gilt()} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.042, 0.042, 0.006, 32]} />
        </mesh>
        <mesh geometry={g.badge} material={M.brass()} position-z={0.003} />
      </group>
      <mesh material={M.gilt()} position={[0, 1.375, 0.112]}>
        <cylinderGeometry args={[0.014, 0.012, 0.03, 16]} />
      </mesh>
      <mesh geometry={g.plume} material={P.plume()} />
    </group>
  );
}

/** The head: the painted face, nose, hair, the pins of the jaw, the throat behind the jaw, the hat. */
function Head({ haunted, cracks }: { haunted: boolean; cracks: THREE.Texture }) {
  const face = useCanvasTexture(1024, 256, (g, w, h) => drawFace(g, w, h, haunted), [haunted]);
  const faceMat = useMemo(() => new THREE.MeshStandardMaterial({ map: face, roughness: 0.4 }), [face]);
  useEffect(() => () => faceMat.dispose(), [faceMat]);
  const mats = useMemo(() => [faceMat, P.flesh(), P.mouth()], [faceMat]);
  const g = useMemo(
    () => ({
      // the front of the face is the middle of the texture
      head: new THREE.CylinderGeometry(0.125, 0.127, 0.2, 72, 1, false, Math.PI, Math.PI * 2),
      throat: new THREE.CylinderGeometry(0.124, 0.124, 0.09, 40, 1, false, Math.PI / 2, Math.PI),
      gum: new THREE.TubeGeometry(arcCurve(0.108, 0.948, -0.8, 0.8), 32, 0.0105, 8),
      hair: blobGeometry(hairBlobs(haunted)),
    }),
    [haunted],
  );
  useEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  return (
    <group>
      <mesh geometry={g.head} material={mats} position-y={1.05} />
      <mesh material={P.flesh()} position={[0, 1.035, 0.121]} scale={[0.85, 1.25, 1.1]}>
        <sphereGeometry args={[0.024, 20, 16]} />
      </mesh>
      <mesh geometry={g.throat} material={P.flesh()} position-y={0.905} />
      {/* the back of the mouth, seen only when the jaw is down */}
      <mesh material={P.mouth()} position={[0, 0.905, 0.001]}>
        <planeGeometry args={[0.248, 0.09]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={M.brass()} position={[s * 0.131, PIVOT.y, PIVOT.z]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.013, 0.013, 0.012, 16]} />
        </mesh>
      ))}
      <mesh geometry={g.hair} material={P.beard()} />
      {haunted && (
        <>
          <mesh geometry={g.gum} material={P.gum()} />
          <Teeth upper />
        </>
      )}
      <Hat haunted={haunted} cracks={cracks} />
    </group>
  );
}

interface Tooth {
  a: number;
  w: number;
  l: number;
  tilt: number;
}

/** A row of small human teeth along the gum: incisors in the middle, then canines, then premolars. */
function teethSpec(upper: boolean): Tooth[] {
  const r = seeded(upper ? 5 : 8);
  const n = 12;
  const span = upper ? 0.72 : 0.66;
  return Array.from({ length: n }, (_, i) => {
    const c = Math.abs(i - (n - 1) / 2);
    const w = (c < 1 ? 1.3 : c < 2 ? 1.0 : c < 3 ? 0.82 : 1.15) * (upper ? 1 : 0.82);
    const l = (c < 1 ? 1.0 : c < 2 ? 0.9 : c < 3 ? 1.18 : 0.75) * (0.9 + r() * 0.25);
    return { a: -span + (i * 2 * span) / (n - 1), w, l, tilt: (r() - 0.5) * 0.24 };
  });
}

/** The teeth: upper ones hang from the roof of the mouth, lower ones stand on the jaw. */
function Teeth({ upper = false }: { upper?: boolean }) {
  const geo = useMemo(() => new THREE.CapsuleGeometry(0.0062, 0.01, 4, 10), []);
  useEffect(() => () => geo.dispose(), [geo]);
  const spec = useMemo(() => teethSpec(upper), [upper]);
  const R = upper ? 0.106 : 0.098;
  const gumY = upper ? 0.946 : 0.951;
  return (
    <>
      {spec.map(({ a, w, l, tilt }, i) => (
        <group key={i} position={[Math.sin(a) * R, gumY, Math.cos(a) * R]} rotation-y={a}>
          <mesh geometry={geo} material={P.tooth()} position-y={(upper ? -1 : 1) * 0.011 * l} rotation-z={tilt} scale={[w, l, 0.62]} />
        </group>
      ))}
    </>
  );
}

/** The jaw: the chin block, the lower lip, the beard, and (after the Reveal) gums, teeth and tongue. */
function Jaw({ haunted }: { haunted: boolean }) {
  const g = useMemo(
    () => ({
      block: new THREE.CylinderGeometry(0.128, 0.128, 0.088, 48, 1, false, -Math.PI / 2, Math.PI),
      lip: new THREE.TubeGeometry(arcCurve(0.127, 0.946, -0.78, 0.78), 32, 0.0045, 8),
      gum: new THREE.TubeGeometry(arcCurve(0.098, 0.951, -0.75, 0.75), 32, 0.0105, 8),
      beard: blobGeometry(beardBlobs(haunted)),
    }),
    [haunted],
  );
  useEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  // the sides of the chin, the floor of the mouth on top, the underside
  const mats = useMemo(() => [P.flesh(), P.mouth(), P.flesh()], []);
  return (
    <group>
      <mesh geometry={g.block} material={mats} position-y={0.904} />
      <mesh geometry={g.lip} material={P.lip()} />
      {haunted && (
        <>
          <mesh geometry={g.gum} material={P.gum()} />
          <Teeth />
          <mesh material={P.gum()} position={[0, 0.944, 0.045]} scale={[1, 0.25, 0.8]}>
            <sphereGeometry args={[0.055, 20, 12]} />
          </mesh>
        </>
      )}
      <mesh geometry={g.beard} material={P.beard()} />
    </group>
  );
}

/** Thin red lines from both corners of the mouth down over the beard, and a drop at the end of each. */
function BloodRuns({ since }: { since: () => number }) {
  const runs = useMemo(() => {
    const out: { g: THREE.BufferGeometry; delay: number; dur: number; end: THREE.Vector3; main: boolean }[] = [];
    for (const s of [-1, 1]) {
      const a0 = s * 0.74;
      const main: THREE.Vector3[] = [new THREE.Vector3(Math.sin(a0) * 0.13, 0.946, Math.cos(a0) * 0.13)];
      const bot = beardBot(a0) - 0.02;
      for (let i = 1; i <= 16; i++) {
        const t = i / 16;
        const y = 0.936 - t * (0.936 - bot);
        const a = a0 - s * 0.05 * t + Math.sin(t * 6 + s) * 0.02;
        const R = beardR(y, a) + 0.026;
        main.push(new THREE.Vector3(Math.sin(a) * R, y, Math.cos(a) * R));
      }
      out.push({
        g: sweep(new THREE.CatmullRomCurve3(main), (t) => 0.0032 * (1 - 0.3 * t) + 0.0012, 40, 6),
        delay: T.bleed + (s > 0 ? 0.15 : 0),
        dur: T.bleedFor,
        end: main[main.length - 1]!.clone().add(new THREE.Vector3(0, -0.006, 0)),
        main: true,
      });
      // a thinner branch off each, outward and not so far
      const from = main[6]!;
      const branch: THREE.Vector3[] = [from.clone()];
      const fa = Math.atan2(from.x, from.z);
      for (let i = 1; i <= 8; i++) {
        const t = i / 8;
        const y = from.y - t * 0.05;
        const a = fa + s * 0.14 * t;
        const R = beardR(y, a) + 0.025;
        branch.push(new THREE.Vector3(Math.sin(a) * R, y, Math.cos(a) * R));
      }
      out.push({
        g: sweep(new THREE.CatmullRomCurve3(branch), (t) => 0.0022 * (1 - 0.4 * t) + 0.0008, 40, 6),
        delay: T.bleed + 0.55 + (s > 0 ? 0.1 : 0),
        dur: 0.75,
        end: branch[branch.length - 1]!.clone(),
        main: false,
      });
    }
    return out;
  }, []);
  useEffect(() => () => runs.forEach((r) => r.g.dispose()), [runs]);
  const drops = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const s = since();
    runs.forEach(({ g, delay, dur }, i) => {
      const k = progress(s, dur, delay);
      g.setDrawRange(0, Math.floor(40 * k) * 6 * 6);
      const d = drops.current[i];
      if (d) d.scale.setScalar(Math.max(0.001, smooth(0.9, 1, k)));
    });
  });
  return (
    <>
      {runs.map(({ g, end, main }, i) => (
        <group key={i}>
          <mesh geometry={g}>
            <meshStandardMaterial color={main ? '#4f0408' : '#360205'} roughness={0.18} />
          </mesh>
          <mesh
            ref={(m) => {
              drops.current[i] = m;
            }}
            position={end}
            scale={0.001}
          >
            <sphereGeometry args={[main ? 0.0052 : 0.0036, 10, 8]} />
            <meshStandardMaterial color="#4f0408" roughness={0.15} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** Half a walnut shell: wrinkled, a ridge along the seam, a little point at the top. `side` 0 is the z ≥ 0 half. */
function walnutHalf(side: 0 | 1): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(NUT_R, 36, 24, side * Math.PI, Math.PI);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).divideScalar(NUT_R);
    const ridge = Math.exp(-((v.z / 0.12) ** 2)) * 0.07;
    const wr = Math.sin(v.x * 11 + v.y * 4) * Math.sin(v.y * 9 - v.z * 7) * 0.045 + Math.sin(v.x * 23 + v.z * 17 + v.y * 5) * 0.015;
    const tip = v.y > 0 ? v.y ** 6 * 0.12 : 0;
    const k = NUT_R * (1 + ridge + wr * (1 - ridge * 10) + tip);
    p.setXYZ(i, v.x * k, v.y * k * 1.12, v.z * k);
  }
  g.computeVertexNormals();
  return g;
}

/** One half of the walnut, with the kernel showing on its cut face. */
function NutHalf({ side }: { side: 0 | 1 }) {
  const shell = useMemo(() => walnutHalf(side), [side]);
  useEffect(() => () => shell.dispose(), [shell]);
  // the cut face looks along -z for the front half, +z for the back half
  const face = side === 0 ? -1 : 1;
  return (
    <group>
      <mesh geometry={shell} material={P.shell()} />
      <group position-z={face * 0.0004} rotation-y={side === 0 ? Math.PI : 0} scale={[1, 1.12, 1]}>
        <mesh material={P.kernel()}>
          <circleGeometry args={[NUT_R * 0.84, 28]} />
        </mesh>
        <mesh material={P.shell()}>
          <ringGeometry args={[NUT_R * 0.83, NUT_R * 1.05, 28]} />
        </mesh>
      </group>
    </group>
  );
}

const NUT_PATH = new THREE.CatmullRomCurve3([
  NUT_REST.clone(),
  new THREE.Vector3(0.13, 0.4, 0.33),
  new THREE.Vector3(0.06, 0.76, 0.33),
  new THREE.Vector3(0, 0.912, 0.25),
  MOUTH.clone(),
]);
const Q_REST = new THREE.Quaternion().setFromEuler(new THREE.Euler(1.35, 0.4, 0));
/** In his mouth the seam stands upright, so the two halves fall left and right. */
const Q_MOUTH = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.15, Math.PI / 2, 0));

interface Fall {
  v: THREE.Vector3;
  land: number;
  at: THREE.Vector3;
  q: THREE.Quaternion;
  spin: number;
}

/** A half thrown out of the mouth at velocity v, landing at height `restY` lying as `yaw`. */
function fall(vx: number, vy: number, vz: number, restY: number, yaw: number, spin: number): Fall {
  const t = (vy + Math.sqrt(vy * vy + 2 * GRAVITY * (MOUTH.y - restY))) / GRAVITY;
  return {
    v: new THREE.Vector3(vx, vy, vz),
    land: t,
    at: new THREE.Vector3(MOUTH.x + vx * t, restY, MOUTH.z + vz * t),
    q: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, yaw)),
    spin,
  };
}
/** The front half lands cut side up (kernel showing), the back half shell side up. */
const FALLS = [fall(0.2, 0.35, 0.22, BASE_TOP + NUT_R * 1.08, 0.6, 1), fall(-0.22, 0.3, 0.22, BASE_TOP + 0.001, -0.9, -1)];

const tmpQ = new THREE.Quaternion();
const tumble = new THREE.Quaternion();
const AXIS_X = new THREE.Vector3(1, 0, 0);

/** Where the two halves of the walnut are: together on the base, floating up, or thrown down in two (outside the component). */
function placeNut(halves: (THREE.Group | null)[], s: number, taken: boolean) {
  const whole = !taken || s < T.snap;
  halves.forEach((h, i) => {
    if (!h) return;
    if (whole) {
      const k = taken ? progress(s, T.riseFor, T.rise) : 0;
      NUT_PATH.getPointAt(k, h.position);
      h.quaternion.copy(Q_REST).slerp(Q_MOUTH, k);
      return;
    }
    const f = FALLS[i]!;
    const t = s - T.snap;
    if (t >= f.land) {
      h.position.copy(f.at);
      h.quaternion.copy(f.q);
      return;
    }
    const e = t / f.land;
    h.position.set(MOUTH.x + f.v.x * t, MOUTH.y + f.v.y * t - (GRAVITY / 2) * t * t, MOUTH.z + f.v.z * t);
    tmpQ.copy(Q_MOUTH).slerp(f.q, e);
    tumble.setFromAxisAngle(AXIS_X, f.spin * Math.PI * 2 * e);
    h.quaternion.copy(tmpQ).multiply(tumble);
  });
}

/** How open the jaw is (0 shut, 1 open) during the Take: drops, holds trembling, snaps, bounces once. */
function jawOpen(s: number): number {
  if (s === Infinity || s < 0) return 0;
  if (s < T.snap) {
    const k = progress(s, T.openFor, T.open);
    return k + (s > T.open + T.openFor ? Math.sin(s * 19) * 0.02 : 0);
  }
  const k = Math.min(1, (s - T.snap) / T.snapFor);
  const back = s - T.snap - T.snapFor;
  const rebound = back > 0 && back < 0.16 ? Math.sin((back / 0.16) * Math.PI) * 0.06 : 0;
  return 1 - k * k + rebound;
}

/** After the Reveal, before the Take: now and then the jaw works by itself, a little, like chewing. */
function chew(t: number): number {
  return pulse(t, 9, 1.4, 0.35) * (0.5 + 0.5 * Math.sin(t * 11)) * 0.1;
}

/** Set the jaw (and the lever on it) for an opening of k (outside the component). */
function poseJaw(j: THREE.Group | null, k: number) {
  if (!j) return;
  j.rotation.x = OPEN.rot * k;
  j.position.set(PIVOT.x, PIVOT.y - OPEN.drop * k, PIVOT.z + OPEN.fwd * k);
}

/** The small judder of the whole figure when the jaw snaps shut (outside the component). */
function poseJudder(g: THREE.Group | null, s: number) {
  if (!g) return;
  const d = s - T.snap;
  if (s === Infinity || d < 0 || d > T.shake) {
    g.rotation.set(0, 0, 0);
    g.position.y = 0;
    return;
  }
  const amp = 1 - d / T.shake;
  g.rotation.set(Math.sin(d * 60 + 1) * 0.006 * amp, 0, Math.sin(d * 75) * 0.012 * amp);
  g.position.y = -Math.abs(Math.sin(d * 75)) * 0.004 * amp;
}

/** The lever down his back, part of the jaw: when the jaw drops, it swings up and out. */
function Lever() {
  const g = useMemo(
    () =>
      sweep(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0.935, -0.02),
          new THREE.Vector3(0, 0.93, -0.15),
          new THREE.Vector3(0, 0.88, -0.174),
          new THREE.Vector3(0, 0.75, -0.18),
          new THREE.Vector3(0, 0.6, -0.177),
          new THREE.Vector3(0, 0.545, -0.17),
        ]),
        () => 0.015,
        48,
        14,
      ),
    [],
  );
  useEffect(() => () => g.dispose(), [g]);
  return (
    <group scale={[1.8, 1, 1]}>
      <mesh geometry={g} material={M.woodLight()} />
      <mesh material={M.woodLight()} position={[0, 0.545, -0.17]}>
        <sphereGeometry args={[0.019, 16, 12]} />
      </mesh>
    </group>
  );
}

/**
 * The nutcracker (product 'nutcracker'). Day: the painted guard. Haunted: the same figure gone
 * old and wrong; his jaw works now and then by itself. Taken: 0.3–1.0 s the jaw drops on its own
 * (the lever rises) and shows small human teeth in dark red gums; 1.0–2.1 s the walnut floats up
 * into his mouth; at 2.2 s the jaw snaps shut, the figure judders, and the broken shell drops to
 * the base in two halves; 2.6–4.0 s thin red lines run down from the corners of his mouth over
 * the beard. Reload or reduced motion: jaw shut, red on the beard, the halves on the base.
 */
export default function Nutcracker() {
  const haunted = useHaunted();
  const { taken, since } = useTaken('nutcracker');
  const cracks = useCanvasTexture(512, 512, drawCraquelure, []);
  const judder = useRef<THREE.Group>(null);
  const jaw = useRef<THREE.Group>(null);
  const halves = useRef<(THREE.Group | null)[]>([]);
  useFrame((st) => {
    const s = since();
    const k = taken ? jawOpen(s) : haunted && !reducedMotion() ? chew(st.clock.elapsedTime) : 0;
    poseJaw(jaw.current, k);
    poseJudder(judder.current, taken ? s : -1);
    placeNut(halves.current, s, taken);
  });
  return (
    <group position-y={-0.62} rotation-y={-0.3}>
      <group ref={judder}>
        <Base />
        <Legs />
        <Coat haunted={haunted} cracks={cracks} />
        <Arms />
        <Head haunted={haunted} cracks={cracks} />
        <group ref={jaw} position={PIVOT}>
          <group position={[-PIVOT.x, -PIVOT.y, -PIVOT.z]}>
            <Jaw haunted={haunted} />
            <Lever />
            {taken && <BloodRuns since={since} />}
          </group>
        </group>
        {([0, 1] as const).map((side) => (
          <group
            key={side}
            ref={(g) => {
              halves.current[side] = g;
            }}
            position={NUT_REST}
            quaternion={Q_REST}
          >
            <NutHalf side={side} />
          </group>
        ))}
      </group>
      {/* not drawn: the space the walnut floats through, so the product view frames it */}
      <mesh position={[0, 0.75, 0.04]} userData={{ frame: true }}>
        <boxGeometry args={[0.72, 1.5, 0.74]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
}
