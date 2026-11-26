import { Decal } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { seeded } from '../../director/footprints';
import { useCanvasTexture } from '../../gl/canvasTex';
import { mat } from '../../gl/decay';
import { M } from '../../gl/materials';
import { surfaceMaps } from '../../gl/surfaces';
import { progress, useTaken } from '../../gl/useTaken';
import { useHaunted } from '../../store';
import { TeddyFigure } from '../small/TeddyFigure';
import {
  EYE,
  EYE_CENTRES,
  EYE_DIRS,
  FACE,
  HEAD,
  collarGeometry,
  cuffGeometry,
  frizzGeometry,
  frontCap,
  furBall,
  furRing,
  headGeometry,
  hollyLeaf,
  lashGeometry,
  onHead,
  petticoatGeometry,
  ringlet,
  ruffleTier,
  skirtGeometry,
  snowflakeGeometry,
  soleGeometry,
  sweep,
} from './shapes';

/*
 * The porcelain doll, rebuilt to Tanvir's round 14 reference (three panels: Christmas,
 * Halloween, after the Take). She sits upright on the floor facing you, legs straight out under
 * her skirt (only the soles and toes of her brown boots show), holding the teddy (the shop's own
 * mohair bear, TeddyFigure) upright on her lap in both hands. A deep red velvet Santa hat with a
 * thick cream fur brim, the pom-pom hanging at her left side and a sprig of holly with a white
 * snowflake on the front; long glossy caramel-auburn ringlets past her shoulders; a round baby
 * face with large brown glass eyes, rosy cheeks and small pink rosebud lips; a red velvet dress
 * with a wide ruffled lace collar, a velvet bow at the throat, puffed sleeves ending in lace
 * cuffs, and tiers of cream lace petticoat spread on the floor below the hem.
 *
 * After the Reveal (Halloween) the same doll, dusty and greyer: paler porcelain, pale milky
 * blue-white irises with tiny pupils, shadows round the eyes, thin tears of blood already run
 * down from both lower lids, the hair duller, the teddy worn.
 *
 * Taken: her head gives a small jerk; her right eye slowly pushes forward out of its socket,
 * bloodshot, its iris shrinking, while her left eye sinks back into a black hollow; cracks
 * spread across the porcelain; blood runs from both eyes and her mouth down her chin onto the
 * collar; her hair frizzes out, the fur goes grey, the dress and the teddy are stained.
 */

/** Seconds into the Take: every beat ends by TAKE_END (the Director holds the Stage that long). */
const TAKE = { jerk: 0.2, eyes: 0.3, pushFor: 2.4, sinkFor: 2.0, crack: 0.3, crackFor: 3.3, bleed: 0.6, end: 3.6 };
/** The face is repainted in this many steps over the Take (cracks, blood, the mouth). */
const STEPS = 40;
/** Where her neck pivots. */
const NECK_Y = 0.53;

/**
 * Her velvet (dress, bow, sleeves, hat): deep red-burgundy, a darker red sheen at the edges.
 * After the Reveal only a little dustier: the decay shader's grey dust on upward faces and its
 * greying, and a pale sheen, are what turned it pink, so all three stay low.
 */
const velvet = () =>
  mat('dollVelvet14', { surface: 'fabric', color: '#6e0a14', roughness: 0.8, sheen: 0.7, sheenColor: '#9a1824', decay: { age: 0.14, dust: 0.08, tear: 0.05 } });
/** Warm porcelain by day; paler and greyer after the Reveal. */
const porcelain = () =>
  mat('dollPorcelain14', { surface: 'ceramic', color: '#f8e0d0', roughness: 0.3, clearcoat: 0.6, hauntedColor: '#d6d1cb', decay: { age: 0.15, dust: 0.1 } });

// ---------------------------------------------------------------------------------------------
// The painted face
// ---------------------------------------------------------------------------------------------

/** Head-frame x, y to the face texture's pixels (512 square, FACE.w × FACE.h on the head). */
const PX = (x: number) => 256 + (x / FACE.w) * 512;
const PY = (y: number) => 256 - (y / FACE.h) * 512;
/** The eyes on the face texture: [her right (your left), her left]; and their radii in pixels. */
const EYES_PX = EYE_CENTRES.map((c) => [PX(c.x), PY(c.y)] as [number, number]);
const ERX = (EYE.r / FACE.w) * 512;
const ERY = (EYE.r / FACE.h) * 512;
const MOUTH_Y = 400;

function blob(g: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, a: number) {
  const grd = g.createRadialGradient(x, y, 0, x, y, r);
  grd.addColorStop(0, `rgba(${rgb},${a})`);
  grd.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grd;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

/** A run of liquid down the face from (x, y), `len` long, wobbling, a bead at its end. */
function streak(g: CanvasRenderingContext2D, x: number, y: number, len: number, wd: number, colour: string, seed: number) {
  if (len < 2) return;
  const at = (t: number) => x + Math.sin(t * 0.05 + seed) * 3 + Math.sin(t * 0.13 + seed * 2) * 1.4 + t * 0.04 * Math.sin(seed);
  const half = (t: number) => (wd / 2) * (1 - (t / (len + 40)) * 0.5);
  g.fillStyle = colour;
  g.beginPath();
  g.moveTo(at(0) - half(0), y);
  for (let t = 0; t <= len; t += 4) g.lineTo(at(t) - half(t), y + t);
  for (let t = len; t >= 0; t -= 4) g.lineTo(at(t) + half(t), y + t);
  g.closePath();
  g.fill();
  g.beginPath();
  g.arc(at(len), y + len, half(len) * 1.4, 0, Math.PI * 2);
  g.fill();
}

/** Small closed rosebud lips: a bowed upper lip, a fuller lower lip, a little shine. */
function lips(g: CanvasRenderingContext2D, upper: string, lower: string, line: string, shine: number) {
  const y = MOUTH_Y;
  g.fillStyle = upper;
  g.beginPath();
  g.moveTo(232, y);
  g.quadraticCurveTo(241, y - 13, 251, y - 10);
  g.quadraticCurveTo(256, y - 7, 261, y - 10);
  g.quadraticCurveTo(271, y - 13, 280, y);
  g.quadraticCurveTo(256, y + 5, 232, y);
  g.fill();
  g.fillStyle = lower;
  g.beginPath();
  g.moveTo(236, y + 1);
  g.quadraticCurveTo(256, y + 19, 276, y + 1);
  g.quadraticCurveTo(256, y + 6, 236, y + 1);
  g.fill();
  g.strokeStyle = line;
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(234, y + 1);
  g.quadraticCurveTo(256, y + 5, 278, y + 1);
  g.stroke();
  if (shine > 0) {
    g.fillStyle = `rgba(255,235,235,${shine})`;
    g.beginPath();
    g.ellipse(258, y + 10, 7, 2.5, 0, 0, Math.PI * 2);
    g.fill();
  }
}

/** Soft feathered brows, a little arched, and fine lower lashes. */
function browsAndLashes(g: CanvasRenderingContext2D, brow: string, base: string, lash: string) {
  for (const [ex, ey] of EYES_PX) {
    const s = ex < 256 ? -1 : 1;
    const A = [ex - s * ERX * 0.85, ey - ERY * 1.45];
    const C = [ex + s * ERX * 0.15, ey - ERY * 1.95];
    const B = [ex + s * ERX * 1.15, ey - ERY * 1.5];
    const P = (t: number) => [(1 - t) ** 2 * A[0]! + 2 * t * (1 - t) * C[0]! + t * t * B[0]!, (1 - t) ** 2 * A[1]! + 2 * t * (1 - t) * C[1]! + t * t * B[1]!];
    g.strokeStyle = base;
    g.lineWidth = 6;
    g.lineCap = 'round';
    g.beginPath();
    for (let i = 0; i <= 12; i++) {
      const [x, y] = P(i / 12);
      if (i) g.lineTo(x!, y!);
      else g.moveTo(x!, y!);
    }
    g.stroke();
    g.strokeStyle = brow;
    g.lineWidth = 1.8;
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const [x, y] = P(t);
      const [x2, y2] = P(Math.min(1, t + 0.06));
      const ang = Math.atan2(y2! - y!, x2! - x!) - s * 0.45;
      g.beginPath();
      g.moveTo(x!, y! + 2);
      g.lineTo(x! + Math.cos(ang) * 9 * s, y! + 2 + Math.sin(ang) * 9 * s);
      g.stroke();
    }
    // lower lashes
    g.strokeStyle = lash;
    g.lineWidth = 1.5;
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.3 + (i / 6) * 0.4);
      const x0 = ex + Math.cos(a) * ERX * 1.02;
      const y0 = ey + Math.sin(a) * ERY * 1.04;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x0 + Math.cos(a) * 7 + (x0 - ex) * 0.04, y0 + Math.sin(a) * 9);
      g.stroke();
    }
  }
}

/** The cracks: [points, width, when it starts (0..1 of the spread)]. */
const CRACKS: [[number, number][], number, number][] = [
  [[[306, 22], [296, 62], [270, 92], [258, 126], [236, 148]], 2.4, 0],
  [[[270, 92], [226, 84], [190, 94], [168, 86]], 1.7, 0.2],
  [[[296, 62], [338, 74], [370, 62], [402, 70]], 1.6, 0.3],
  [[[150, 30], [170, 70], [156, 104], [166, 132]], 1.8, 0.15],
  [[[118, 284], [146, 300], [170, 330], [164, 360], [188, 392], [204, 440]], 2.2, 0.25],
  [[[170, 330], [128, 344], [100, 330]], 1.5, 0.45],
  [[[404, 276], [392, 306], [406, 340], [388, 378], [394, 410]], 1.9, 0.35],
  [[[392, 306], [430, 318]], 1.3, 0.6],
];

/** Draw the first `k` (0..1) of each crack: a dark hairline with a pale chipped edge beside it. */
function cracks(g: CanvasRenderingContext2D, k: number) {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const [pts, wd, start] of CRACKS) {
    const p = Math.min(1, Math.max(0, (k - start) / (1 - start)));
    if (p <= 0) continue;
    const segs = pts.length - 1;
    const upto = p * segs;
    for (const [col, off, w] of [
      ['rgba(255,250,240,0.35)', 1.2, wd * 0.7],
      ['rgba(30,22,20,0.92)', 0, wd],
    ] as [string, number, number][]) {
      g.strokeStyle = col;
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(pts[0]![0] + off, pts[0]![1] + off);
      for (let i = 1; i <= Math.ceil(upto); i++) {
        const a = pts[i - 1]!;
        const b = pts[i]!;
        const f = Math.min(1, upto - (i - 1));
        g.lineTo(a[0] + (b[0] - a[0]) * f + off, a[1] + (b[1] - a[1]) * f + off);
      }
      g.stroke();
    }
  }
}

/**
 * Her face. By day: rosy cheeks, soft brows, lashes, small pink rosebud lips. Haunted: greyed,
 * shadows round the eyes, pale lips, thin tears of blood from both lower lids. `k` (0..1) is how
 * far the Take has ruined it: grime, cracks spreading, the right eye red and veined, blood round
 * the empty left socket, smeared blood under both eyes, dark lips parted, blood from the mouth.
 */
function drawFace(g: CanvasRenderingContext2D, w: number, h: number, haunted: boolean, k: number) {
  g.clearRect(0, 0, w, h);
  g.save();
  g.scale(w / 512, h / 512);
  if (!haunted) {
    for (const s of [-1, 1]) blob(g, 256 + s * 150, 322, 80, '236,124,122', 0.5);
    blob(g, 256, 292, 18, '236,150,140', 0.25);
    blob(g, 256, 456, 34, '236,150,140', 0.16);
    browsAndLashes(g, 'rgba(150,100,66,0.55)', 'rgba(160,110,72,0.25)', 'rgba(90,58,40,0.6)');
    lips(g, '#d9707a', '#cf6470', 'rgba(140,50,58,0.7)', 0.6);
    g.restore();
    return;
  }
  const r = seeded(31);
  // dust settled into the porcelain
  for (let i = 0; i < 16; i++) blob(g, r() * 512, r() * 512, 30 + r() * 60, '80,72,64', 0.05 + r() * 0.05);
  // shadows round the eyes
  for (const [ex, ey] of EYES_PX) {
    const grd = g.createRadialGradient(ex, ey + 6, ERY * 0.9, ex, ey + 6, ERY * 2.1);
    grd.addColorStop(0, 'rgba(48,38,50,0.55)');
    grd.addColorStop(1, 'rgba(48,38,50,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 512, 512);
  }
  browsAndLashes(g, 'rgba(105,92,84,0.45)', 'rgba(110,96,88,0.18)', 'rgba(60,48,44,0.55)');
  // the ruin, as far as it has got
  const kc = Math.min(1, k / 0.85);
  const kb = Math.min(1, Math.max(0, (k - 0.08) / 0.92));
  const r2 = seeded(41);
  for (let i = 0; i < 26; i++) blob(g, r2() * 512, r2() * 512, 20 + r2() * 50, '62,52,42', (0.08 + r2() * 0.12) * k);
  cracks(g, kc);
  lips(g, '#a6858a', '#9c7a80', 'rgba(80,50,54,0.7)', 0);
  // thin tears of blood already run from both lower lids
  EYES_PX.forEach(([ex, ey], side) =>
    [-1, 0, 1].forEach((j) => streak(g, ex + j * 13 + (side ? 2 : -2), ey + ERY * 0.9, 80 + ((j + 2) * 37 + side * 23) % 70, 3 + (j === 0 ? 1 : 0), 'rgba(118,8,14,0.92)', side * 3 + j)),
  );
  if (kb > 0) {
    const [rx, ry] = EYES_PX[0]!;
    const [lx, ly] = EYES_PX[1]!;
    // her right eye: red and veined round the bulging ball
    blob(g, rx, ry, ERY * 2.0, '160,24,30', 0.55 * kb);
    g.strokeStyle = `rgba(150,14,20,${0.75 * kb})`;
    g.lineWidth = 1.4;
    const rv = seeded(57);
    for (let i = 0; i < 12; i++) {
      const a = rv() * Math.PI * 2;
      let x = rx + Math.cos(a) * ERX * 1.02;
      let y = ry + Math.sin(a) * ERY * 1.02;
      g.beginPath();
      g.moveTo(x, y);
      for (let s = 0; s < 4; s++) {
        x += Math.cos(a + (rv() - 0.5)) * 7;
        y += Math.sin(a + (rv() - 0.5)) * 7;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    // her left: soot-dark round the empty hollow, and blood round its rim
    const grd = g.createRadialGradient(lx, ly, ERY * 0.9, lx, ly, ERY * 1.6);
    grd.addColorStop(0, `rgba(12,6,6,${0.9 * kb})`);
    grd.addColorStop(1, 'rgba(12,6,6,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 512, 512);
    g.strokeStyle = `rgba(104,6,10,${0.9 * kb})`;
    g.lineWidth = 7;
    g.beginPath();
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const rr = 1.08 + 0.08 * Math.sin(a * 5 + 1) + 0.05 * Math.sin(a * 11);
      const x = lx + Math.cos(a) * ERX * rr;
      const y = ly + Math.sin(a) * ERY * rr;
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.stroke();
    // smeared blood running from both eyes
    EYES_PX.forEach(([ex, ey], side) =>
      [-1, 1].forEach((j) => streak(g, ex + j * 20, ey + ERY * 0.95, (150 + side * 30 + (j + 1) * 25) * kb, 8 + (j + 1) * 2, 'rgba(92,4,8,0.95)', 9 + side + j)),
    );
    // the mouth: dark lips, parted, blood welling and running down the chin
    lips(g, `rgba(70,18,22,${kb})`, `rgba(62,14,18,${kb})`, `rgba(20,4,6,${kb})`, 0);
    g.fillStyle = `rgba(22,3,5,${kb})`;
    g.beginPath();
    g.ellipse(256, MOUTH_Y + 2, 16, 1 + 5 * kb, 0, 0, Math.PI * 2);
    g.fill();
    [-1, 0, 1].forEach((j) => streak(g, 256 + j * 11, MOUTH_Y + 6, (60 + (j + 1) * 24) * kb, 7 - Math.abs(j) * 2, 'rgba(96,4,8,0.95)', 20 + j));
  }
  g.restore();
}

/** How far the Take has ruined the face, in repaint steps. */
function ruinStep(s: number): number {
  if (s === Infinity) return STEPS;
  if (s < 0) return 0;
  return Math.min(STEPS, Math.max(0, Math.floor(((s - TAKE.crack) / TAKE.crackFor) * STEPS)));
}

/** The face decal on her porcelain, repainted in steps as the Take ruins it. */
function Face({ haunted, taken, since }: { haunted: boolean; taken: boolean; since: () => number }) {
  const [step, setStep] = useState(() => (taken ? ruinStep(since()) : 0));
  useFrame(() => {
    const next = taken ? ruinStep(since()) : 0;
    if (next !== step) setStep(next);
  });
  const k = haunted ? step / STEPS : 0;
  const tex = useCanvasTexture(512, 512, (g, w, h) => drawFace(g, w, h, haunted, k), [haunted, k]);
  return (
    <Decal position={[0, 0, HEAD.r * 0.9]} rotation={[0, 0, 0]} scale={[FACE.w, FACE.h, 0.3]}>
      <meshStandardMaterial map={tex} transparent polygonOffset polygonOffsetFactor={-10} depthWrite={false} roughness={0.35} />
    </Decal>
  );
}

// ---------------------------------------------------------------------------------------------
// The glass eyes
// ---------------------------------------------------------------------------------------------

/**
 * The iris of a glass eye, front on. By day a real-looking brown: a dark limbal ring, lighter
 * brown fibres, a darker collarette, a black pupil and a bright window catchlight. Haunted, pale
 * milky blue-white with a faint grey ring and a tiny dark pupil: no warmth at all.
 */
function drawIris(g: CanvasRenderingContext2D, w: number, h: number, ghost: boolean) {
  const c = w / 2;
  const R = w / 2;
  g.clearRect(0, 0, w, h);
  const grd = g.createRadialGradient(c, c, R * 0.12, c, c, R);
  const stops: [number, string][] = ghost
    ? [
        [0, '#eef2f3'],
        [0.5, '#d6e1e8'],
        [0.8, '#c0ced8'],
        [0.92, '#949ea5'],
        [1, '#757d82'],
      ]
    : [
        [0, '#3c2210'],
        [0.3, '#6e4521'],
        [0.55, '#9a6732'],
        [0.8, '#7d4f24'],
        [0.92, '#3a2210'],
        [1, '#1a0e06'],
      ];
  stops.forEach(([o, col]) => grd.addColorStop(o, col));
  g.fillStyle = grd;
  g.beginPath();
  g.arc(c, c, R, 0, Math.PI * 2);
  g.fill();
  const r = seeded(ghost ? 8 : 7);
  // fibres radiating from the pupil
  for (let i = 0; i < 240; i++) {
    const a = r() * Math.PI * 2;
    const r0 = R * (0.22 + r() * 0.1);
    const r1 = R * (0.6 + r() * 0.3);
    g.strokeStyle = ghost ? 'rgba(255,255,255,0.22)' : r() < 0.5 ? 'rgba(200,150,88,0.35)' : 'rgba(46,26,10,0.35)';
    g.lineWidth = 0.8 + r() * 1.2;
    const bend = (r() - 0.5) * 0.12;
    g.beginPath();
    g.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
    g.quadraticCurveTo(c + Math.cos(a + bend) * (r0 + r1) * 0.5, c + Math.sin(a + bend) * (r0 + r1) * 0.5, c + Math.cos(a) * r1, c + Math.sin(a) * r1);
    g.stroke();
  }
  if (!ghost) {
    // crypts, and the darker collarette round the pupil
    for (let i = 0; i < 18; i++) {
      const a = r() * Math.PI * 2;
      const d = R * (0.4 + r() * 0.3);
      g.fillStyle = 'rgba(40,22,10,0.35)';
      g.beginPath();
      g.ellipse(c + Math.cos(a) * d, c + Math.sin(a) * d, R * 0.05, R * 0.02, a, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = 'rgba(80,46,20,0.6)';
    g.lineWidth = R * 0.05;
    g.beginPath();
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const d = R * (0.36 + 0.025 * Math.sin(a * 9));
      if (i) g.lineTo(c + Math.cos(a) * d, c + Math.sin(a) * d);
      else g.moveTo(c + Math.cos(a) * d, c + Math.sin(a) * d);
    }
    g.stroke();
  } else {
    blob(g, c, c, R, '245,250,252', 0.35);
  }
  // the pupil
  const pr = ghost ? R * 0.09 : R * 0.27;
  const pg = g.createRadialGradient(c, c, pr * 0.7, c, c, pr * 1.15);
  pg.addColorStop(0, ghost ? '#0d0f11' : '#050302');
  pg.addColorStop(1, ghost ? 'rgba(13,15,17,0)' : 'rgba(5,3,2,0)');
  g.fillStyle = pg;
  g.beginPath();
  g.arc(c, c, pr * 1.15, 0, Math.PI * 2);
  g.fill();
  // the catchlight
  if (ghost) {
    g.fillStyle = 'rgba(232,240,245,0.6)';
    g.beginPath();
    g.arc(c - R * 0.3, c - R * 0.3, R * 0.06, 0, Math.PI * 2);
    g.fill();
  } else {
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.beginPath();
    g.ellipse(c - R * 0.3, c - R * 0.32, R * 0.16, R * 0.11, -0.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.beginPath();
    g.arc(c + R * 0.28, c + R * 0.26, R * 0.05, 0, Math.PI * 2);
    g.fill();
  }
}

/**
 * The bloodshot white of an eye, on the eyeball's sphere UVs (its front is at u 0.25, v 0.5):
 * redder away from the iris, and red veins branching in toward it.
 */
function drawVeins(g: CanvasRenderingContext2D, w: number, h: number) {
  const img = g.createImageData(w, h);
  const cx = w * 0.25;
  const cy = h / 2;
  const angOf = (x: number, y: number) => {
    const dx = ((((x - cx) / w + 1.5) % 1) - 0.5) * Math.PI * 2;
    const dy = ((y - cy) / h) * Math.PI;
    return Math.hypot(dx, dy);
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = Math.min(1, Math.max(0, (angOf(x, y) - 0.55) / 1.1));
      const i = (y * w + x) * 4;
      img.data[i] = 178;
      img.data[i + 1] = 40;
      img.data[i + 2] = 42;
      img.data[i + 3] = Math.round(255 * 0.62 * t * t * (3 - 2 * t));
    }
  g.putImageData(img, 0, 0);
  const r = seeded(61);
  g.lineCap = 'round';
  for (let v = 0; v < 46; v++) {
    const a = r() * Math.PI * 2;
    const d = 1.3 + r() * 1.0;
    let x = cx + (Math.cos(a) * d * w) / (Math.PI * 2);
    let y = cy + (Math.sin(a) * d * h) / Math.PI;
    const pts: [number, number][] = [[x, y]];
    for (let s = 0; s < 14 && angOf(x, y) > 0.62; s++) {
      const tx = cx - x;
      const ty = cy - y;
      const L = Math.hypot(tx, ty) || 1;
      x += (tx / L) * 5 + (r() - 0.5) * 5;
      y += (ty / L) * 3 + (r() - 0.5) * 4;
      pts.push([x, y]);
    }
    for (const ox of [-w, 0, w]) {
      g.strokeStyle = 'rgba(150,12,18,0.85)';
      g.lineWidth = 0.6 + r() * 1.1;
      g.beginPath();
      pts.forEach(([px, py], i) => (i ? g.lineTo(px + ox, py) : g.moveTo(px + ox, py)));
      g.stroke();
    }
  }
}

/** The iris's half-angle on the eyeball: a big doll's iris, most of the visible eye. */
const IRIS = 0.7;

/** One glass eye in its socket, the porcelain upper lid and lashes over it. */
function Eye({
  side,
  iris,
  ball,
  irisRef,
  vein,
  hollow,
}: {
  side: number;
  iris: THREE.Texture;
  ball: RefObject<THREE.Group | null>;
  irisRef?: RefObject<THREE.Group | null>;
  vein?: THREE.Material;
  hollow?: THREE.Material;
}) {
  const i = side < 0 ? 0 : 1;
  const lid = EYE.r * 1.12;
  const g = useMemo(
    () => ({
      iris: frontCap(EYE.r * 1.004, IRIS),
      cornea: frontCap(EYE.r * 1.03, 0.8),
      hollow: frontCap(EYE.r * 1.06, 1.15),
      lashes: lashGeometry(lid * Math.sin(0.72), lid * Math.cos(0.72), side),
    }),
    [lid, side],
  );
  useEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  return (
    <group position={EYE_CENTRES[i]}>
      <group ref={ball}>
        <mesh material={M.enamel()}>
          <sphereGeometry args={[EYE.r, 32, 24]} />
        </mesh>
        {vein && (
          <mesh material={vein}>
            <sphereGeometry args={[EYE.r * 1.003, 32, 24]} />
          </mesh>
        )}
        <group ref={irisRef}>
          <mesh geometry={g.iris}>
            <meshStandardMaterial map={iris} roughness={0.2} />
          </mesh>
        </group>
        {/* the glass over it */}
        <mesh geometry={g.cornea}>
          <meshPhysicalMaterial color="#ffffff" transparent opacity={0.16} roughness={0.02} clearcoat={1} depthWrite={false} />
        </mesh>
      </group>
      {hollow && <mesh geometry={g.hollow} material={hollow} />}
      {/* the upper lid over the top of the eye, the dark line along its edge, and the lashes */}
      <group rotation-x={0.12}>
        <mesh material={porcelain()}>
          <sphereGeometry args={[lid, 28, 10, 0, Math.PI * 2, 0, 0.72]} />
        </mesh>
        <mesh position-y={lid * Math.cos(0.72)} rotation-x={Math.PI / 2}>
          <torusGeometry args={[lid * Math.sin(0.72), 0.0035, 6, 32]} />
          <meshStandardMaterial color="#2a1a12" roughness={0.6} />
        </mesh>
        <mesh geometry={g.lashes}>
          <meshStandardMaterial color="#21140e" roughness={0.7} />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// Blood, hair, hat
// ---------------------------------------------------------------------------------------------

/** 0→1 over `dur` s after `delay`: a slow, steady seep; 1 for Infinity. */
function seep(s: number, dur: number, delay: number): number {
  if (s === Infinity) return 1;
  return Math.min(1, Math.max(0, (s - delay) / dur));
}

const X_AXIS = new THREE.Vector3(1, 0, 0);

/** One run of blood down the face from direction `d0`, turning `sweepAng` down, then off the chin. */
function runGeometry(d0: THREE.Vector3, sweepAng: number, drift: number, thick: number, seed: number): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const d = d0.clone().applyAxisAngle(X_AXIS, t * sweepAng);
    d.x += drift * t + Math.sin(t * 7 + seed) * 0.006;
    pts.push(onHead(d, 0.0018));
  }
  const end = pts[pts.length - 1]!;
  pts.push(end.clone().add(new THREE.Vector3(0, -0.025, 0.006)), end.clone().add(new THREE.Vector3(0.002, -0.06, 0.014)));
  return sweep(new THREE.CatmullRomCurve3(pts), (t) => thick * (0.55 + 0.45 * Math.min(1, t * 6)) * (1 - 0.25 * t) * (t > 0.96 ? 1.5 : 1) + 0.001, 72, 6);
}

/** Heavy blood running from both eyes and the mouth down the chin onto the collar (head frame). */
function BloodRuns({ since, material }: { since: () => number; material: THREE.Material }) {
  const runs = useMemo(() => {
    const out: { g: THREE.BufferGeometry; delay: number; dur: number }[] = [];
    EYE_DIRS.forEach((e, side) =>
      [0, 1, 2].forEach((j) => {
        const d0 = e.clone().applyAxisAngle(X_AXIS, 0.2);
        d0.x += (j - 1) * 0.07;
        const delay = TAKE.bleed + side * 0.12 + j * 0.3;
        out.push({ g: runGeometry(d0, 1.15 + j * 0.06, (side ? -1 : 1) * 0.02 * (j - 1), [0.0065, 0.0048, 0.0036][j]!, side * 3 + j), delay, dur: TAKE.end - delay });
      }),
    );
    [-1, 1].forEach((s, j) => {
      // from the corners of the mouth
      const mx = (s * 0.014) / HEAD.r;
      const my = -0.1 / 1.07 / HEAD.r;
      const d0 = new THREE.Vector3(mx, my, Math.sqrt(Math.max(0, 1 - mx * mx - my * my)));
      const delay = TAKE.bleed + 0.3 + j * 0.25;
      out.push({ g: runGeometry(d0, 0.55, s * 0.01, 0.0052, 11 + j), delay, dur: TAKE.end - delay });
    });
    return out;
  }, []);
  useEffect(() => () => runs.forEach((r) => r.g.dispose()), [runs]);
  useFrame(() => {
    const s = since();
    runs.forEach(({ g, delay, dur }) => g.setDrawRange(0, Math.floor(72 * seep(s, dur, delay)) * 6 * 6));
  });
  return (
    <>
      {runs.map(({ g }, i) => (
        <mesh key={i} geometry={g} material={material} />
      ))}
    </>
  );
}

/**
 * Strands of hair running along each curl (the texture's v), light and dark over a mid grey that
 * the material's colour tints: copper glints and deep brown partings (outside any component).
 */
function paintHair(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = 'rgb(176,172,168)';
  g.fillRect(0, 0, w, h);
  const r = seeded(83);
  g.lineCap = 'round';
  for (let i = 0; i < 1600; i++) {
    const x = r() * w;
    const y = r() * h;
    const len = h * (0.15 + r() * 0.35);
    const light = r() < 0.45;
    const a = light ? 0.25 + r() * 0.35 : 0.2 + r() * 0.35;
    g.strokeStyle = light ? `rgba(255,236,214,${a})` : `rgba(52,34,24,${a})`;
    g.lineWidth = 0.6 + r() * 1.6;
    const wob = (r() - 0.5) * 4;
    for (const oy of [-h, 0, h]) {
      g.beginPath();
      g.moveTo(x, y + oy);
      g.quadraticCurveTo(x + wob, y + oy + len / 2, x, y + oy + len);
      g.stroke();
    }
  }
}

let hairTex: THREE.Texture | null = null;

/** The strand texture, made once. */
function hairTexture(): THREE.Texture | null {
  if (hairTex) return hairTex;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 512;
  const g = c.getContext('2d');
  if (g) paintHair(g, c.width, c.height);
  hairTex = new THREE.CanvasTexture(c);
  hairTex.wrapS = hairTex.wrapT = THREE.RepeatWrapping;
  hairTex.repeat.set(2, 5);
  hairTex.colorSpace = THREE.SRGBColorSpace;
  return hairTex;
}

/** Give a material the strand texture as colour and bump (once). */
function withHair<T extends THREE.MeshStandardMaterial>(m: T): T {
  const t = hairTexture();
  if (t && !m.map) {
    m.map = t;
    m.bumpMap = t;
    m.bumpScale = 1.2;
    m.needsUpdate = true;
  }
  return m;
}

/**
 * Her ringlets: glossy caramel-auburn, warm brown with copper highlights (the strands' light
 * streaks and a copper sheen). After the Reveal the same colour, a little duller.
 */
const HAIR = { day: '#8a4620', ruined: '#5e4b3b' };
const hairMat = () =>
  withHair(mat('dollHair14', { color: HAIR.day, roughness: 0.4, clearcoat: 0.45, sheen: 0.6, sheenColor: '#d0743a', decay: { dust: 0.05, age: 0.12 } }));
const frizzMat = () => mat('dollFrizz14', { color: '#6e5a48', roughness: 0.95, decay: { dust: 0.1, age: 0.2 } });

/**
 * Ringlets: [angle round the head (0 = front), drop, swing out to the side, turns, forward].
 * The front ones fall in front of her shoulders onto her chest, framing her face; the rest fall
 * over and behind her shoulders.
 */
const CURLS: [number, number, number, number, number][] = [
  [0.86, 0.33, 0.03, 6.5, 0.085],
  [1.0, 0.35, 0.04, 7, 0.085],
  [1.15, 0.36, 0.05, 7, 0.075],
  [1.3, 0.36, 0.06, 7, 0.06],
  [1.48, 0.35, 0.07, 7, 0.035],
  [1.68, 0.34, 0.07, 6.5, 0.01],
  [1.9, 0.33, 0.06, 6.5, 0],
  [2.15, 0.32, 0.05, 6.5, 0],
  [2.45, 0.31, 0.04, 6, 0],
  [2.78, 0.3, 0.03, 6, 0],
  [3.08, 0.3, 0.02, 6, 0],
];

/** All the ringlets merged into one mesh (outside the component). */
function ringletsGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  let seed = 1;
  for (const s of [-1, 1]) {
    CURLS.forEach(([a, drop, swing, turns, fwd], i) => {
      // two of them at each place, the second a little further out and lower: thick hair
      for (const k of [0, 1]) {
        const ang = (a + k * 0.07) * s;
        const rad = HEAD.r * (1.0 + 0.07 * k);
        const top = new THREE.Vector3(Math.sin(ang) * rad, 0.06 - 0.035 * k - (i < 3 ? 0.01 : 0), Math.cos(ang) * rad * 0.95);
        const out = new THREE.Vector3(Math.sin(ang) * (swing + 0.015 * k), 0, Math.cos(ang) * swing * 0.5 + fwd * (1 + 0.15 * k));
        parts.push(ringlet(top, drop - 0.02 * k, out, turns, 0.02, 0.0115, seed++));
      }
    });
    // short curls at the temples, under the brim
    for (let i = 0; i < 3; i++) {
      const ang = s * (0.6 + i * 0.1);
      const top = new THREE.Vector3(Math.sin(ang) * HEAD.r * 0.97, 0.1, Math.cos(ang) * HEAD.r * 0.9);
      parts.push(ringlet(top, 0.08 + i * 0.02, new THREE.Vector3(Math.sin(ang) * 0.02, 0, 0.012), 2.5, 0.012, 0.009, 40 + i + (s > 0 ? 5 : 0)));
    }
  }
  const g = mergeGeometries(parts) ?? new THREE.BufferGeometry();
  parts.forEach((x) => x.dispose());
  return g;
}

/** The fall of hair behind her head and shoulders, so no gap shows between the ringlets. */
function backHairGeometry(): THREE.BufferGeometry {
  const pts = [
    [0.15, -0.3],
    [0.18, -0.28],
    [0.195, -0.2],
    [0.19, -0.1],
    [0.178, 0.0],
    [0.15, 0.06],
  ].map(([r, y]) => new THREE.Vector2(r!, y!));
  return new THREE.LatheGeometry(pts, 40, Math.PI / 2 + 0.25, Math.PI - 0.5);
}

/** Her hair: a cap over the crown under the hat, and long thick ringlets falling past both shoulders. */
function Hair({ material }: { material: THREE.Material }) {
  const g = useMemo(() => ({ curls: ringletsGeometry(), back: backHairGeometry() }), []);
  useEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  return (
    <group>
      <mesh material={material} position={[0, 0.012, -0.014]} rotation-x={-0.35}>
        <sphereGeometry args={[HEAD.r * 1.05, 44, 26, 0, Math.PI * 2, 0, Math.PI * 0.64]} />
      </mesh>
      <mesh geometry={g.back} material={material} />
      <mesh geometry={g.curls} material={material} />
    </group>
  );
}

/** Taken: her hair frizzes out, matted and wild, strand after strand standing out of it. */
function Frizz({ since }: { since: () => number }) {
  const geo = useMemo(() => {
    const r = seeded(77);
    const roots: THREE.Vector3[] = [];
    for (let i = 0; i < 56; i++) {
      const s = i % 2 ? 1 : -1;
      const a = s * (0.75 + r() * 2.3);
      const low = i % 3 === 0;
      const y = low ? -0.28 + r() * 0.24 : -0.04 + r() * 0.16;
      const rad = low ? HEAD.r * 1.15 + 0.02 : HEAD.r * 1.03;
      roots.push(new THREE.Vector3(Math.sin(a) * rad, y, Math.cos(a) * rad * 0.95));
    }
    return frizzGeometry(roots, 78);
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame(() => {
    const n = geo.index?.count ?? 0;
    geo.setDrawRange(0, Math.floor((n / 6) * seep(since(), 2.8, 0.5)) * 6);
  });
  return <mesh geometry={geo} material={frizzMat()} />;
}

/** The Santa hat: thick fur brim, a velvet cone bending over to her left, the pom-pom, holly and a snowflake. */
function Hat({ haunted, fur }: { haunted: boolean; fur: THREE.Material }) {
  const g = useMemo(() => {
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.0, 0.0, -0.01),
      new THREE.Vector3(0.0, 0.11, -0.03),
      new THREE.Vector3(0.06, 0.2, -0.02),
      new THREE.Vector3(0.19, 0.2, 0.0),
      new THREE.Vector3(0.27, 0.07, 0.02),
      new THREE.Vector3(0.29, -0.03, 0.03),
    ]);
    return {
      cone: sweep(path, (t) => 0.165 * (1 - t) ** 1.15 + 0.012, 64, 28),
      brim: furRing(0.19, 0.05, 3),
      pom: furBall(0.068, 4),
      leaf: hollyLeaf(),
      flake: snowflakeGeometry(),
    };
  }, []);
  useEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  return (
    <group position={[0, 0.12, -0.005]} rotation={[-0.32, 0, -0.06]}>
      <mesh geometry={g.cone} material={velvet()} />
      <mesh geometry={g.brim} material={fur} rotation-x={Math.PI / 2} scale={[1, 1, 0.9]} />
      <mesh geometry={g.pom} material={fur} position={[0.29, -0.065, 0.03]} />
      {/* holly at the front of the brim on her right: three leaves, three berries */}
      <group position={[-0.085, 0.035, 0.168]} rotation={[0.3, 0, 0]}>
        {[-0.7, 0.2, 1.1].map((a, i) => (
          <mesh key={i} geometry={g.leaf} rotation-z={a} position={[Math.sin(a) * 0.004, 0, 0.002 * i]}>
            <meshStandardMaterial color={haunted ? '#26301f' : '#1f4a22'} roughness={0.3} />
          </mesh>
        ))}
        {[
          [0.012, 0.004],
          [0.024, -0.006],
          [0.026, 0.012],
        ].map(([x, y], i) => (
          <mesh key={i} position={[x!, y!, 0.012]}>
            <sphereGeometry args={[0.01, 12, 10]} />
            <meshStandardMaterial color={haunted ? '#5a1a16' : '#c8141c'} roughness={0.22} />
          </mesh>
        ))}
        <mesh geometry={g.flake} material={M.enamel()} position={[-0.036, 0.03, 0.01]} rotation-z={0.3} />
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// The body and dress
// ---------------------------------------------------------------------------------------------

const petticoatMat = () =>
  mat('dollPetticoat', { surface: 'fabric', color: '#f1e8d6', roughness: 0.95, sheen: 0.5, hauntedColor: '#bdb29c', decay: { dust: 0.4, age: 0.3 } });

const ray = new THREE.Raycaster();
const probe = new THREE.Mesh(undefined, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));

interface Spot {
  p: THREE.Vector3;
  q: THREE.Quaternion;
  r: number;
  long: number;
}

/** Blood spots and smears on a surface, found by casting rays at it from the front (outside the component). */
function spotsOn(geo: THREE.BufferGeometry, n: number, seed: number, x: [number, number], y: [number, number]): Spot[] {
  const r = seeded(seed);
  probe.geometry = geo;
  probe.updateMatrixWorld();
  const out: Spot[] = [];
  for (let i = 0; i < n; i++) {
    const px = x[0] + r() * (x[1] - x[0]);
    const py = y[0] + r() * (y[1] - y[0]);
    ray.set(new THREE.Vector3(px, py + 0.05, 1.5), new THREE.Vector3(-px * 0.4, -0.05, -1.5).normalize());
    const h = ray.intersectObject(probe, false)[0];
    if (!h || !h.face) continue;
    const nrm = h.face.normal.clone();
    if (nrm.z < 0) nrm.negate();
    out.push({ p: h.point.addScaledVector(nrm, 0.002), q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm), r: 0.006 + r() * 0.02, long: r() < 0.4 ? 1.8 + r() * 1.2 : 1 });
  }
  return out;
}

/** Repeat a lace texture `n` times round (outside the component). */
function repeatAround(t: THREE.Texture, n: number) {
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(n, 1);
  t.needsUpdate = true;
}

/** The sleeves: from the shoulder, puffed, down to the wrist by the teddy. */
function sleevePath(s: number): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(s * 0.11, 0.51, -0.01),
    new THREE.Vector3(s * 0.168, 0.44, 0.015),
    new THREE.Vector3(s * 0.16, 0.35, 0.09),
    new THREE.Vector3(s * 0.112, 0.288, 0.18),
  ]);
}

/** Bodice, lace collar, bow, puffed sleeves with lace cuffs, hands, skirt, lace tiers, petticoat, boots. */
function Body({ lace, collarLace, cuffLace, stain }: { lace: THREE.Texture; collarLace: THREE.Texture; cuffLace: THREE.Texture; stain?: THREE.Material }) {
  const g = useMemo(() => {
    const bodice = new THREE.LatheGeometry(
      [
        [0.0, 0.33],
        [0.118, 0.335],
        [0.122, 0.4],
        [0.128, 0.46],
        [0.11, 0.51],
        [0.075, 0.545],
        [0.0, 0.55],
      ].map(([r, y]) => new THREE.Vector2(r!, y!)),
      48,
    );
    bodice.scale(1, 1, 0.75);
    const arms = [-1, 1].map((s) => {
      const path = sleevePath(s);
      const end = path.getPointAt(1);
      const tan = path.getTangentAt(1);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
      return {
        sleeve: sweep(
          path,
          (t) => {
            const cap = t < 0.12 ? Math.sqrt(1 - ((0.12 - t) / 0.12) ** 2) : 1;
            return (0.042 + 0.032 * Math.sin(Math.PI * Math.min(1, t * 1.12))) * Math.max(0.2, cap);
          },
          48,
          20,
        ),
        cuff: { at: end.clone().addScaledVector(tan, -0.014), q },
        hand: { at: end.clone().addScaledVector(tan, 0.022), q },
      };
    });
    const skirt = skirtGeometry();
    const geos = {
      bodice,
      skirt,
      petticoat: petticoatGeometry(),
      // three tiers of lace petticoat showing below the hem, the top one shortest
      tiers: [ruffleTier(0.028, 0.024, 56, 0.008, 0), ruffleTier(0.05, 0.014, 60, 0.009, 1.3), ruffleTier(0.072, 0.005, 64, 0.01, 2.1)],
      collars: [collarGeometry(0.068, 0.548, 0.205, 0.43, 24, 0.011, 0.5), collarGeometry(0.06, 0.562, 0.158, 0.48, 20, 0.009, 0)],
      cuff: cuffGeometry(),
      sole: soleGeometry(),
      sleeves: arms.map((a) => a.sleeve),
    };
    const spots = [
      ...spotsOn(skirt, 18, 91, [-0.3, 0.3], [0.13, 0.3]),
      ...spotsOn(bodice, 4, 92, [-0.1, 0.1], [0.36, 0.45]),
      ...spotsOn(geos.collars[1]!, 5, 93, [-0.05, 0.05], [0.47, 0.51]),
      ...spotsOn(geos.collars[0]!, 4, 94, [-0.12, 0.12], [0.44, 0.48]),
    ];
    return { geos, arms, spots };
  }, []);
  useEffect(
    () => () =>
      Object.values(g.geos)
        .flat()
        .forEach((x) => x.dispose()),
    [g],
  );
  const lm = (t: THREE.Texture) => <meshStandardMaterial map={t} alphaTest={0.4} side={THREE.DoubleSide} roughness={0.9} />;
  return (
    <group>
      <mesh geometry={g.geos.bodice} material={velvet()} />
      {/* the wide ruffled lace collar, two tiers */}
      {g.geos.collars.map((c, i) => (
        <mesh key={i} geometry={c}>
          {lm(collarLace)}
        </mesh>
      ))}
      {/* the red velvet bow at her throat */}
      <group position={[0, 0.493, 0.132]} rotation-x={-0.2}>
        {[-1, 1].map((s) => (
          <mesh key={s} material={velvet()} position={[s * 0.034, 0, 0]} rotation-z={s * 0.35} scale={[1.45, 0.85, 0.55]}>
            <sphereGeometry args={[0.026, 18, 12]} />
          </mesh>
        ))}
        {[-1, 1].map((s) => (
          <mesh key={`t${s}`} material={velvet()} position={[s * 0.016, -0.034, 0.0]} rotation-z={s * 0.3} scale={[1, 1, 0.45]}>
            <capsuleGeometry args={[0.009, 0.034, 4, 10]} />
          </mesh>
        ))}
        <mesh material={velvet()} scale={[1, 0.9, 0.7]}>
          <sphereGeometry args={[0.014, 14, 10]} />
        </mesh>
      </group>
      {g.geos.sleeves.map((s, i) => (
        <mesh key={i} geometry={s} material={velvet()} />
      ))}
      {g.arms.map((a, i) => (
        <group key={i}>
          <mesh geometry={g.geos.cuff} position={a.cuff.at} quaternion={a.cuff.q}>
            {lm(cuffLace)}
          </mesh>
          {/* her hand, holding the teddy */}
          <mesh material={porcelain()} position={a.hand.at} quaternion={a.hand.q} scale={[0.024, 0.03, 0.019]}>
            <sphereGeometry args={[1, 18, 14]} />
          </mesh>
        </group>
      ))}
      <mesh geometry={g.geos.skirt} material={velvet()} />
      <mesh geometry={g.geos.petticoat} material={petticoatMat()} />
      {g.geos.tiers.map((t, i) => (
        <mesh key={i} geometry={t}>
          {lm(lace)}
        </mesh>
      ))}
      {/* her boots: legs straight out, so only the soles and toes show beyond the lace */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.078, 0.004, 0.552]} rotation={[0.12, s * 0.18, -s * 0.1]}>
          <mesh material={M.leather()} position={[0, 0.08, -0.036]} scale={[0.042, 0.068, 0.05]}>
            <sphereGeometry args={[1, 24, 18]} />
          </mesh>
          <mesh geometry={g.geos.sole} material={M.leatherSole()} position-z={0.008} />
        </group>
      ))}
      {stain &&
        g.spots.map((sp, i) => (
          <mesh key={i} position={sp.p} quaternion={sp.q} material={stain} scale={[1, sp.long, 1]}>
            <circleGeometry args={[sp.r, 14]} />
          </mesh>
        ))}
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// Lace
// ---------------------------------------------------------------------------------------------

type LaceKind = 'day' | 'dusty' | 'ruined';

/** Lace: scalloped edge, rows of little holes and flowers, on a transparent ground. Ruined: torn, grey, dirty. */
function drawLace(g: CanvasRenderingContext2D, w: number, h: number, kind: LaceKind) {
  g.clearRect(0, 0, w, h);
  g.fillStyle = kind === 'day' ? '#f6efdf' : kind === 'dusty' ? '#ddd3bf' : '#a59a85';
  const sc = 16;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(w, 0);
  g.lineTo(w, h * 0.7);
  for (let i = sc; i >= 0; i--) {
    const x = (i / sc) * w;
    g.quadraticCurveTo(x + w / sc / 2, h * 1.02, x, h * 0.7);
  }
  g.closePath();
  g.fill();
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 3 * sc; i++) {
    const x = ((i % sc) + 0.5) * (w / sc);
    const y = h * (0.18 + Math.floor(i / sc) * 0.2);
    g.beginPath();
    g.arc(x, y, h * 0.06, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < sc; i++) {
    const x = (i + 0.5) * (w / sc);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      g.beginPath();
      g.arc(x + Math.cos(a) * h * 0.06, h * 0.82 + Math.sin(a) * h * 0.05, h * 0.03, 0, Math.PI * 2);
      g.fill();
    }
  }
  const r = seeded(5);
  if (kind === 'ruined') {
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      g.ellipse(r() * w, h * (0.5 + r() * 0.5), w * (0.02 + r() * 0.04), h * 0.4, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalCompositeOperation = 'source-atop';
  if (kind !== 'day') {
    const n = kind === 'ruined' ? 30 : 10;
    for (let i = 0; i < n; i++) {
      g.fillStyle = `rgba(60,46,34,${(kind === 'ruined' ? 0.15 : 0.06) + r() * (kind === 'ruined' ? 0.2 : 0.08)})`;
      g.beginPath();
      g.arc(r() * w, r() * h, h * (0.05 + r() * 0.15), 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalCompositeOperation = 'source-over';
}

// ---------------------------------------------------------------------------------------------
// The Take, frame by frame (outside the component)
// ---------------------------------------------------------------------------------------------

interface Fx {
  vein: THREE.MeshStandardMaterial;
  hollow: THREE.MeshBasicMaterial;
  stain: THREE.MeshStandardMaterial;
  blood: THREE.MeshStandardMaterial;
  hatFur: THREE.MeshPhysicalMaterial;
  hair: THREE.MeshPhysicalMaterial;
}

const FUR_HALLOWEEN = new THREE.Color('#d2c9b6');
const FUR_RUINED = new THREE.Color('#8f8574');
const HAIR_DAY = new THREE.Color(HAIR.day);
const HAIR_RUINED = new THREE.Color(HAIR.ruined);

/** A small jerk of the head at 0.2 s, settling back upright within half a second. */
function jerkHead(h: THREE.Object3D, s: number) {
  const t = s - TAKE.jerk;
  if (s === Infinity || t < 0 || t > 0.7) {
    h.rotation.set(0, 0, 0);
    return;
  }
  const amp = t < 0.05 ? t / 0.05 : Math.exp(-(t - 0.05) * 9) * Math.cos((t - 0.05) * 24);
  h.rotation.set(-0.08 * amp, 0.03 * amp, 0.06 * amp);
}

/**
 * Her right eye (your left) pushes forward out of its socket and swells, bloodshot, its iris
 * shrinking; her left sinks back and the socket fills with black. Stains and grey fur creep in.
 */
function playTake(s: number, ballR: THREE.Object3D | null, irisR: THREE.Object3D | null, ballL: THREE.Object3D | null, fx: Fx) {
  const push = progress(s, TAKE.pushFor, TAKE.eyes);
  if (ballR) {
    ballR.position.z = push * EYE.r * 0.8;
    ballR.scale.setScalar(1 + 0.35 * push);
  }
  if (irisR) {
    const k = 1 - 0.42 * push;
    irisR.scale.set(k, k, 1);
    irisR.position.z = (Math.sqrt(1 - (k * Math.sin(IRIS)) ** 2) - Math.cos(IRIS)) * EYE.r;
  }
  fx.vein.opacity = progress(s, 1.6, TAKE.eyes + 0.1);
  const sink = progress(s, TAKE.sinkFor, TAKE.eyes);
  if (ballL) {
    ballL.position.z = -sink * EYE.r * 1.1;
    ballL.scale.setScalar(1 - 0.35 * sink);
    ballL.visible = sink < 0.999;
  }
  fx.hollow.opacity = progress(s, 1.8, TAKE.eyes + 0.05);
  fx.stain.opacity = 0.92 * progress(s, 2.8, 0.7);
  fx.hatFur.color.copy(FUR_HALLOWEEN).lerp(FUR_RUINED, progress(s, 3, 0.5));
  // her hair dries out into a matted, greyer brown, its gloss gone
  const dry = progress(s, 3, 0.5);
  fx.hair.color.copy(HAIR_DAY).lerp(HAIR_RUINED, dry);
  fx.hair.roughness = 0.42 + 0.48 * dry;
  fx.hair.clearcoat = 0.4 * (1 - dry);
}

function makeFx(veins: THREE.Texture): Fx {
  const fur = surfaceMaps('fur');
  return {
    vein: new THREE.MeshStandardMaterial({ map: veins, transparent: true, opacity: 0, depthWrite: false, roughness: 0.2 }),
    hollow: new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0, depthWrite: false }),
    stain: new THREE.MeshStandardMaterial({ color: '#3a0306', roughness: 0.4, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }),
    blood: new THREE.MeshStandardMaterial({ color: '#5a0508', roughness: 0.16 }),
    hatFur: new THREE.MeshPhysicalMaterial({
      color: FUR_HALLOWEEN,
      roughness: 1,
      sheen: 0.6,
      sheenColor: new THREE.Color('#e8e2d6'),
      map: fur?.map ?? null,
      bumpMap: fur?.bumpMap ?? null,
      bumpScale: fur?.bumpScale ?? 1,
    }),
    hair: withHair(new THREE.MeshPhysicalMaterial({ color: HAIR_DAY, roughness: 0.42, clearcoat: 0.4, sheen: 0.5, sheenColor: new THREE.Color('#b8683a') })),
  };
}

/**
 * The doll (Requirement 15), rebuilt to the round 14 reference: Christmas by day, Halloween
 * after the Reveal, ruined by the Take (see the top of the file). The Take lasts TAKE.end
 * (3.6 s); on reload or under reduced motion she is shown ruined at once.
 */
export default function Doll() {
  const haunted = useHaunted();
  const { taken, since } = useTaken('doll');
  const head = useRef<THREE.Group>(null);
  const ballR = useRef<THREE.Group>(null);
  const irisR = useRef<THREE.Group>(null);
  const ballL = useRef<THREE.Group>(null);
  // the lace is torn and grey from halfway through the Take
  const [late, setLate] = useState(() => taken && since() === Infinity);
  const irisDay = useCanvasTexture(256, 256, (g, w, h) => drawIris(g, w, h, false), []);
  const irisGhost = useCanvasTexture(256, 256, (g, w, h) => drawIris(g, w, h, true), []);
  const veins = useCanvasTexture(256, 128, drawVeins, []);
  const laceKind: LaceKind = !haunted ? 'day' : taken && late ? 'ruined' : 'dusty';
  const lace = useCanvasTexture(512, 64, (g, w, h) => drawLace(g, w, h, laceKind), [laceKind]);
  const collarLace = useCanvasTexture(512, 64, (g, w, h) => drawLace(g, w, h, laceKind), [laceKind]);
  const cuffLace = useCanvasTexture(512, 64, (g, w, h) => drawLace(g, w, h, laceKind), [laceKind]);
  useEffect(() => {
    repeatAround(lace, 6);
    repeatAround(collarLace, 3);
    repeatAround(cuffLace, 1.5);
  }, [lace, collarLace, cuffLace]);
  const fx = useMemo(() => makeFx(veins), [veins]);
  useEffect(() => () => Object.values(fx).forEach((m) => m.dispose()), [fx]);
  const headGeo = useMemo(() => headGeometry(), []);
  useEffect(() => () => headGeo.dispose(), [headGeo]);
  useFrame(() => {
    const s = taken ? since() : -1;
    if (head.current) jerkHead(head.current, s);
    playTake(s, ballR.current, irisR.current, ballL.current, fx);
    if (taken && !late && s >= 1.8) setLate(true);
    if (!taken && late) setLate(false);
  });
  const iris = haunted ? irisGhost : irisDay;
  return (
    <group position-y={-0.56} scale={1.15}>
      <Body lace={lace} collarLace={collarLace} cuffLace={cuffLace} stain={taken ? fx.stain : undefined} />
      {/* the teddy on her lap, sitting up, held in both hands */}
      <group position={[0, 0.336, 0.17]} rotation-x={-0.08} scale={0.2}>
        <TeddyFigure stain={taken ? fx.stain : undefined} />
      </group>
      <group ref={head} position-y={NECK_Y}>
        <group position-y={HEAD.y - NECK_Y}>
          {/* the neck */}
          <mesh material={porcelain()} position-y={-0.15}>
            <cylinderGeometry args={[0.045, 0.055, 0.08, 20]} />
          </mesh>
          <mesh geometry={headGeo} material={porcelain()}>
            <Face haunted={haunted} taken={taken} since={since} />
          </mesh>
          <Eye side={-1} iris={iris} ball={ballR} irisRef={irisR} vein={taken ? fx.vein : undefined} />
          <Eye side={1} iris={iris} ball={ballL} hollow={taken ? fx.hollow : undefined} />
          <Hair material={taken ? fx.hair : hairMat()} />
          {taken && <Frizz since={since} />}
          <Hat haunted={haunted} fur={haunted ? fx.hatFur : M.dollFur()} />
          {taken && <BloodRuns since={since} material={fx.blood} />}
        </group>
      </group>
    </group>
  );
}
