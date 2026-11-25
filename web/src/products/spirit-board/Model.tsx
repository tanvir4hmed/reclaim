import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { seeded } from '../../director/footprints';
import { reducedMotion } from '../../director/runtime';
import { useCanvasTexture } from '../../gl/canvasTex';
import { mat } from '../../gl/decay';
import { M } from '../../gl/materials';
import { useTaken } from '../../gl/useTaken';
import { useHaunted } from '../../store';

/*
 * The Christmas Eve letter board: a walnut talking board with rounded, bevelled corners, painted
 * with YES and a sun, NO and a moon, two arched rows of letters, the numbers, GOOD BYE, holly in
 * the corners and a thin gold border; a heart-shaped wooden pointer on three felt feet, with a
 * round glass window in a brass ring, rests on it.
 * After the Reveal the board is dark, the lettering faded to bone, a scorch mark in one corner,
 * the holly gone black; the pointer drifts a hair now and then when no one is near it.
 * Taken: the pointer slides by itself and stops with its window over H, E, L, L (lifting and
 * tapping down again on the same letter), O; then it glides down to GOOD BYE and stops, and the
 * glass in its window cracks.
 * The painted face and the pointer's stops come from the same layout (LAYOUT), so the window
 * lands exactly on each letter.
 */

/** The painted face, in canvas pixels; the board is the same shape (3:2). */
const TEX = { w: 1536, h: 1024 };
const BOARD = { w: 1.5, h: 1.0, corner: 0.09, depth: 0.035, bevel: 0.012, bevelSize: 0.018 };
/** The front face of the board, in the board's own frame. */
const FACE_Z = BOARD.depth + BOARD.bevel;
/** How far the board leans back from upright, so its face reads in the picture. */
const LEAN = 0.72;
/** The pointer: window radius, heart scale, body thickness and bevel, felt feet height. */
const PL = { win: 0.05, scale: 0.0095, depth: 0.022, bevel: 0.008, feet: 0.014 };
/** Seconds into the Take: the tap on the second L, and the crack. */
const TAP = { up: 2.6, top: 2.78, down: 2.86, lift: 0.022 };
const CRACK = { at: 5.8, dur: 0.3 };

const SERIF = '"Fraunces Variable", "Iowan Old Style", Georgia, serif';

interface Glyph {
  text: string;
  /** centre of the capital letters, in canvas pixels */
  x: number;
  y: number;
  rot: number;
  size: number;
}

/** The two rows of letters arch round one centre far below the board. */
const ARC = { cx: 768, cy: 1820 };
function arcRow(chars: string, radius: number, span: number, size: number): Glyph[] {
  const list = chars.split('');
  return list.map((text, i) => {
    const a = -span + (2 * span * i) / (list.length - 1);
    return { text, x: ARC.cx + Math.sin(a) * radius, y: ARC.cy - Math.cos(a) * radius, rot: a, size };
  });
}

/** Where everything on the face is painted. */
const LAYOUT = {
  row1: arcRow('ABCDEFGHIJKLM', 1440, 0.42, 92),
  row2: arcRow('NOPQRSTUVWXYZ', 1275, 0.44, 88),
  digits: '1234567890'.split('').map((text, i): Glyph => ({ text, x: 768 + (i - 4.5) * 84, y: 762, rot: 0, size: 72 })),
  yes: { text: 'YES', x: 350, y: 150, rot: 0, size: 80 } satisfies Glyph,
  no: { text: 'NO', x: 1186, y: 150, rot: 0, size: 80 } satisfies Glyph,
  bye: { text: 'GOOD BYE', x: 768, y: 884, rot: 0, size: 76 } satisfies Glyph,
  title: { text: 'Christmas Eve', x: 768, y: 146, rot: 0, size: 52 } satisfies Glyph,
  sun: { x: 205, y: 150 },
  moon: { x: 1331, y: 150 },
  holly: [
    [74, 74, 0.785],
    [TEX.w - 74, 74, 2.356],
    [74, TEX.h - 74, -0.785],
    [TEX.w - 74, TEX.h - 74, -2.356],
  ] as const,
  scorch: { x: 1265, y: 850 },
};

function letter(ch: string): Glyph {
  const g = [...LAYOUT.row1, ...LAYOUT.row2].find((x) => x.text === ch);
  if (!g) throw new Error(`no ${ch} on the board`);
  return g;
}

/** A point on the painted face (canvas pixels) in the board's frame (units, y up). */
function onBoard(x: number, y: number): THREE.Vector2 {
  return new THREE.Vector2((x / TEX.w - 0.5) * BOARD.w, (0.5 - y / TEX.h) * BOARD.h);
}

interface Stop {
  at: THREE.Vector2;
  rot: number;
}
/** Where the pointer rests before anyone asks. */
const REST: Stop = { at: onBoard(1040, 700), rot: -0.28 };
/** Each glide: where to, how it turns, when it starts and arrives (s into the Take). */
const MOVES: (Stop & { t0: number; t1: number })[] = [
  { at: onBoard(letter('H').x, letter('H').y), rot: 0.06, t0: 0.5, t1: 0.8 },
  { at: onBoard(letter('E').x, letter('E').y), rot: 0.16, t0: 1.2, t1: 1.5 },
  { at: onBoard(letter('L').x, letter('L').y), rot: -0.18, t0: 1.9, t1: 2.2 },
  // (the second L: it lifts and taps down on the same letter, TAP)
  { at: onBoard(letter('O').x, letter('O').y), rot: 0.22, t0: 3.3, t1: 3.6 },
  { at: onBoard(LAYOUT.bye.x, LAYOUT.bye.y), rot: 0.02, t0: 4.4, t1: 5.5 },
];

const ease = (k: number) => k * k * (3 - 2 * k);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
function pulse(t: number, period: number, len: number, phase: number): number {
  const k = (t + phase * period) % period;
  return k > len ? 0 : Math.sin((k / len) * Math.PI);
}

/** Place the pointer: resting, drifting (haunted), or spelling (taken). Outside the component. */
function posePointer(o: THREE.Object3D | null, s: number, taken: boolean, drift: boolean, t: number) {
  if (!o) return;
  let x = REST.at.x;
  let y = REST.at.y;
  let rot = REST.rot;
  let lift = 0;
  let tilt = 0;
  if (taken) {
    const time = s === Infinity ? 99 : s;
    let from: Stop = REST;
    for (const m of MOVES) {
      if (time >= m.t1) {
        x = m.at.x;
        y = m.at.y;
        rot = m.rot;
        from = m;
        continue;
      }
      if (time > m.t0) {
        const k = ease((time - m.t0) / (m.t1 - m.t0));
        // a slight curve to each glide, as a hand would make
        const dx = m.at.x - from.at.x;
        const dy = m.at.y - from.at.y;
        const bow = Math.sin(k * Math.PI) * 0.04;
        x = from.at.x + dx * k - dy * bow;
        y = from.at.y + dy * k + dx * bow;
        rot = from.rot + (m.rot - from.rot) * k;
      }
      break;
    }
    // the second L: up off the letter, and a sharp tap back down onto it
    if (time > TAP.up && time < TAP.down) {
      lift = time < TAP.top ? ease((time - TAP.up) / (TAP.top - TAP.up)) * TAP.lift : TAP.lift * (1 - ((time - TAP.top) / (TAP.down - TAP.top)) ** 2);
      tilt = (lift / TAP.lift) * 0.06;
    }
    // the glass cracking: a tiny shudder through it
    const c = time - CRACK.at;
    if (c > 0 && c < 0.15) rot += Math.sin(c * 90) * 0.004 * (1 - c / 0.15);
  } else if (drift) {
    // nobody is touching it
    x += Math.sin(t * 0.29) * 0.006 * pulse(t, 9, 4, 0.3);
    y += Math.sin(t * 0.41 + 1) * 0.004 * pulse(t, 9, 4, 0.3);
    rot += pulse(t, 11, 3, 0.6) * 0.014;
  }
  o.position.set(x, y, FACE_Z + lift);
  o.rotation.set(tilt, 0, rot);
}

/** A rounded rectangle centred on the origin. */
function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x0 = -w / 2;
  const y0 = -h / 2;
  const x1 = w / 2;
  const y1 = h / 2;
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0);
  s.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x1, y1 - r);
  s.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
  s.lineTo(x0 + r, y1);
  s.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + r);
  s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** UVs from x, y across a w × h box centred on the origin (painted face, wood grain). */
function boxUV(g: THREE.BufferGeometry, w: number, h: number) {
  const p = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
  uv.needsUpdate = true;
}

/** A rounded-rectangle path on the canvas. */
function roundPath(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** One painted letter (or word), centred on its capitals, turned to follow its arc. */
function paintGlyph(g: CanvasRenderingContext2D, gl: Glyph, fill: string, stroke: string, italic = false) {
  g.save();
  g.translate(gl.x, gl.y);
  g.rotate(gl.rot);
  g.font = `${italic ? 'italic 500' : '600'} ${gl.size}px ${SERIF}`;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.lineJoin = 'round';
  g.lineWidth = gl.size * 0.045;
  g.strokeStyle = stroke;
  g.strokeText(gl.text, 0, gl.size * 0.35);
  g.fillStyle = fill;
  g.fillText(gl.text, 0, gl.size * 0.35);
  g.restore();
}

/** A sprig of holly: three spiky leaves and three berries. Haunted: blackened and shrivelled. */
function paintHolly(g: CanvasRenderingContext2D, x: number, y: number, rot: number, haunted: boolean) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  const leaf = (a: number) => {
    g.save();
    g.rotate(a);
    const len = 74;
    const pts: [number, number][] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const w = Math.sin(t * Math.PI) * 17 + (i % 2 ? 7 : 0);
      pts.push([w, -t * len]);
    }
    g.beginPath();
    g.moveTo(0, 0);
    pts.forEach(([px, py]) => g.lineTo(px, py));
    for (let i = pts.length - 1; i >= 0; i--) g.lineTo(-pts[i]![0], pts[i]![1]);
    g.closePath();
    g.fillStyle = haunted ? '#15130f' : '#2f6b33';
    g.fill();
    g.strokeStyle = haunted ? '#2b241b' : '#1c4420';
    g.lineWidth = 2.5;
    g.stroke();
    g.beginPath();
    g.moveTo(0, -4);
    g.lineTo(0, -len + 6);
    g.strokeStyle = haunted ? 'rgba(60,52,40,0.6)' : 'rgba(170,210,140,0.55)';
    g.lineWidth = 2;
    g.stroke();
    g.restore();
  };
  leaf(-0.75);
  leaf(0.75);
  leaf(Math.PI);
  const berries: [number, number][] = [
    [-9, 6],
    [9, 6],
    [0, -6],
  ];
  for (const [bx, by] of berries) {
    const r = haunted ? 7 : 10;
    const grd = g.createRadialGradient(bx - 3, by - 3, 1, bx, by, r);
    grd.addColorStop(0, haunted ? '#4a1a1a' : '#ff6a6a');
    grd.addColorStop(0.4, haunted ? '#2d0f10' : '#c8141c');
    grd.addColorStop(1, haunted ? '#160808' : '#6e0a0e');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(bx, by, r, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/** The sun beside YES: a round face with rays. */
function paintSun(g: CanvasRenderingContext2D, x: number, y: number, ink: string, line: string) {
  g.save();
  g.translate(x, y);
  g.fillStyle = ink;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const long = i % 2 ? 54 : 64;
    g.beginPath();
    g.moveTo(Math.cos(a - 0.1) * 38, Math.sin(a - 0.1) * 38);
    g.lineTo(Math.cos(a) * long, Math.sin(a) * long);
    g.lineTo(Math.cos(a + 0.1) * 38, Math.sin(a + 0.1) * 38);
    g.closePath();
    g.fill();
  }
  g.beginPath();
  g.arc(0, 0, 36, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = line;
  g.lineWidth = 3;
  g.stroke();
  g.fillStyle = line;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.arc(s * 12, -6, 3.5, 0, Math.PI * 2);
    g.fill();
  }
  g.beginPath();
  g.arc(0, 4, 15, 0.2 * Math.PI, 0.8 * Math.PI);
  g.stroke();
  g.restore();
}

/** The moon beside NO: a crescent, and a small star in its arms. */
function paintMoon(g: CanvasRenderingContext2D, x: number, y: number, ink: string, line: string) {
  g.save();
  g.translate(x, y);
  g.save();
  g.beginPath();
  g.arc(0, 0, 46, 0, Math.PI * 2);
  g.arc(-20, -8, 40, 0, Math.PI * 2);
  g.clip('evenodd');
  g.beginPath();
  g.arc(0, 0, 46, 0, Math.PI * 2);
  g.fillStyle = ink;
  g.fill();
  g.strokeStyle = line;
  g.lineWidth = 3;
  g.stroke();
  g.restore();
  g.fillStyle = ink;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? 5 : 12;
    if (i) g.lineTo(-18 + Math.cos(a) * r, -4 + Math.sin(a) * r);
    else g.moveTo(-18 + Math.cos(a) * r, -4 + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  g.restore();
}

/** The whole painted face of the board. */
function drawBoard(g: CanvasRenderingContext2D, w: number, h: number, haunted: boolean) {
  const r = seeded(haunted ? 13 : 3);
  // walnut: warm and figured by day; after the Reveal near black
  const bg = g.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, haunted ? '#2b1e16' : '#7d4c29');
  bg.addColorStop(0.5, haunted ? '#1c140f' : '#5e371b');
  bg.addColorStop(1, haunted ? '#251a13' : '#6e4223');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    const y0 = r() * h;
    const amp = 6 + r() * 14;
    const ph = r() * 6;
    g.strokeStyle = haunted ? `rgba(0,0,0,${0.06 + r() * 0.1})` : `rgba(40,20,8,${0.05 + r() * 0.1})`;
    g.lineWidth = 1 + r() * 2.5;
    g.beginPath();
    g.moveTo(0, y0);
    for (let x = 0; x <= w; x += 48) g.lineTo(x, y0 + Math.sin(x * 0.004 + ph) * amp + Math.sin(x * 0.013 + ph * 2) * amp * 0.2);
    g.stroke();
  }
  // a light varnish sheen in the middle, darker toward the edges
  const vig = g.createRadialGradient(w / 2, h * 0.45, h * 0.15, w / 2, h / 2, w * 0.65);
  vig.addColorStop(0, haunted ? 'rgba(60,48,36,0.12)' : 'rgba(255,214,160,0.16)');
  vig.addColorStop(1, 'rgba(0,0,0,0.38)');
  g.fillStyle = vig;
  g.fillRect(0, 0, w, h);

  const gold = haunted ? 'rgba(178,164,134,0.6)' : '#e0b85a';
  const red = haunted ? 'rgba(216,204,176,0.72)' : '#c0222c';
  const bone = 'rgba(216,204,176,0.72)';
  const dark = haunted ? 'rgba(10,6,4,0.55)' : '#5a1010';
  // the thin gold border, double
  g.strokeStyle = gold;
  g.lineWidth = 4;
  roundPath(g, 26, 26, w - 52, h - 52, 70);
  g.stroke();
  g.lineWidth = 1.6;
  roundPath(g, 40, 40, w - 80, h - 80, 58);
  g.stroke();
  for (const [x, y, a] of LAYOUT.holly) paintHolly(g, x, y, a, haunted);

  paintSun(g, LAYOUT.sun.x, LAYOUT.sun.y, haunted ? 'rgba(190,176,146,0.55)' : '#e3b94f', haunted ? 'rgba(20,12,8,0.6)' : '#7a4a10');
  paintMoon(g, LAYOUT.moon.x, LAYOUT.moon.y, haunted ? 'rgba(190,176,146,0.55)' : '#ecd28a', haunted ? 'rgba(20,12,8,0.6)' : '#7a5a20');
  paintGlyph(g, LAYOUT.yes, haunted ? bone : red, haunted ? dark : '#e3be62');
  paintGlyph(g, LAYOUT.no, haunted ? bone : red, haunted ? dark : '#e3be62');
  paintGlyph(g, LAYOUT.title, haunted ? 'rgba(200,188,160,0.4)' : '#d8434b', haunted ? 'rgba(0,0,0,0)' : 'rgba(90,16,16,0.5)', true);
  // the letters: gold, outlined in dark red; haunted, faded to bone, some more worn than others
  for (const gl of [...LAYOUT.row1, ...LAYOUT.row2]) {
    const fill = haunted ? `rgba(216,204,176,${0.62 + r() * 0.2})` : gold;
    paintGlyph(g, gl, fill, dark);
  }
  for (const gl of LAYOUT.digits) paintGlyph(g, gl, haunted ? bone : red, haunted ? dark : '#e3be62');
  // a rule with a diamond between the numbers and GOOD BYE, and a star each side of it
  g.strokeStyle = gold;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(520, 822);
  g.lineTo(1016, 822);
  g.stroke();
  g.fillStyle = gold;
  g.beginPath();
  g.moveTo(768, 812);
  g.lineTo(778, 822);
  g.lineTo(768, 832);
  g.lineTo(758, 822);
  g.closePath();
  g.fill();
  for (const sx of [530, 1006]) {
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rr = i % 2 ? 4 : 13;
      if (i) g.lineTo(sx + Math.cos(a) * rr, LAYOUT.bye.y + Math.sin(a) * rr);
      else g.moveTo(sx + Math.cos(a) * rr, LAYOUT.bye.y + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  }
  paintGlyph(g, LAYOUT.bye, haunted ? bone : red, haunted ? dark : '#e3be62');
  if (!haunted) return;
  // a scorch mark: burnt into the corner, ragged at its edge, over the holly and the last numbers
  const sc = LAYOUT.scorch;
  for (let i = 0; i < 34; i++) {
    const x = sc.x + (r() - 0.5) * 190;
    const y = sc.y + (r() - 0.5) * 120;
    const rad = 40 + r() * 90;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, 'rgba(6,4,2,0.42)');
    grd.addColorStop(0.7, 'rgba(40,20,8,0.18)');
    grd.addColorStop(1, 'rgba(60,30,10,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  }
  const core = g.createRadialGradient(sc.x + 20, sc.y + 14, 0, sc.x + 20, sc.y + 14, 70);
  core.addColorStop(0, 'rgba(0,0,0,0.85)');
  core.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = core;
  g.fillRect(0, 0, w, h);
  // scratches, and the ring a cup once left
  for (let i = 0; i < 40; i++) {
    const x = r() * w;
    const y = r() * h;
    const a = r() * Math.PI;
    const len = 30 + r() * 140;
    g.strokeStyle = `rgba(210,190,160,${0.05 + r() * 0.07})`;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 7;
  g.beginPath();
  g.arc(300, 610, 70, 0, Math.PI * 2);
  g.stroke();
}

interface CrackPattern {
  rays: [number, number][][];
  rings: { a: [number, number]; m: [number, number]; b: [number, number]; at: number }[];
  steps: number;
}

/** Where the glass will crack: jagged lines out from one point to the ring, and some joining them. */
function crackPattern(): CrackPattern {
  const r = seeded(29);
  const C = 128;
  const RAD = 124;
  const ix = 112;
  const iy = 104;
  const n = 9;
  const rays: [number, number][][] = [];
  for (let i = 0; i < n; i++) {
    let a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.5;
    let x = ix;
    let y = iy;
    const pts: [number, number][] = [[x, y]];
    while (Math.hypot(x - C, y - C) < RAD + 4 && pts.length < 30) {
      a += (r() - 0.5) * 0.5;
      const step = 10 + r() * 10;
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
      pts.push([x, y]);
    }
    rays.push(pts);
  }
  const rings: CrackPattern['rings'] = [];
  for (const k of [2, 4, 6]) {
    for (let i = 0; i < n; i++) {
      const p = rays[i]![k];
      const q = rays[(i + 1) % n]![k];
      if (!p || !q || r() < 0.3) continue;
      rings.push({ a: p, b: q, m: [(p[0] + q[0]) / 2 + (r() - 0.5) * 10, (p[1] + q[1]) / 2 + (r() - 0.5) * 10], at: k });
    }
  }
  return { rays, rings, steps: Math.max(...rays.map((p) => p.length)) - 1 };
}

/** Draw the crack grown to k (0..1) into the window's texture (outside the component). */
function paintCrack(tex: THREE.CanvasTexture, pat: CrackPattern, k: number) {
  const c = tex.image as HTMLCanvasElement;
  const g = c.getContext('2d');
  if (!g) return;
  g.clearRect(0, 0, c.width, c.height);
  if (k > 0) {
    g.save();
    g.beginPath();
    g.arc(128, 128, 124, 0, Math.PI * 2);
    g.clip();
    const reach = k * pat.steps;
    const strokeAll = (style: string, width: number) => {
      g.strokeStyle = style;
      g.lineWidth = width;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      for (const ray of pat.rays) {
        g.beginPath();
        ray.forEach(([x, y], i) => {
          if (i > reach + 1) return;
          if (i === 0) {
            g.moveTo(x, y);
            return;
          }
          const prev = ray[i - 1]!;
          const f = Math.min(1, reach - (i - 1));
          if (f <= 0) return;
          g.lineTo(prev[0] + (x - prev[0]) * f, prev[1] + (y - prev[1]) * f);
        });
        g.stroke();
      }
      for (const ring of pat.rings) {
        if (reach < ring.at + 0.5) continue;
        g.beginPath();
        g.moveTo(ring.a[0], ring.a[1]);
        g.quadraticCurveTo(ring.m[0], ring.m[1], ring.b[0], ring.b[1]);
        g.stroke();
      }
    };
    strokeAll('rgba(10,10,10,0.35)', 2.8);
    strokeAll('rgba(236,234,226,0.9)', 1.2);
    // the chipped point where it gave
    const p0 = pat.rays[0]![0]!;
    const chip = g.createRadialGradient(p0[0], p0[1], 0, p0[0], p0[1], 7);
    chip.addColorStop(0, 'rgba(240,238,230,0.85)');
    chip.addColorStop(1, 'rgba(240,238,230,0)');
    g.fillStyle = chip;
    g.fillRect(p0[0] - 8, p0[1] - 8, 16, 16);
    g.restore();
  }
  tex.needsUpdate = true;
}

/** The crack across the pointer's glass, growing out from one point in a third of a second. */
function WindowCrack({ since, z }: { since: () => number; z: number }) {
  const pattern = useMemo(() => crackPattern(), []);
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  const last = useRef(-1);
  useFrame(() => {
    const s = since();
    const k = s === Infinity ? 1 : 1 - (1 - clamp01((s - CRACK.at) / CRACK.dur)) ** 2;
    if (k === last.current) return;
    last.current = k;
    paintCrack(tex, pattern, k);
  });
  return (
    <mesh position-z={z}>
      <circleGeometry args={[PL.win, 48]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} />
    </mesh>
  );
}

/** The heart outline (point toward the top of the board), centred on the window. */
function heartPoints(inset = 1): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const n = 96;
  // the window sits at hy = -3 on the classic heart curve, in the wide part toward the point
  const cy = -2 * PL.scale;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const hx = 16 * Math.sin(t) ** 3;
    const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const x = hx * PL.scale;
    const y = (-hy - 3) * PL.scale;
    pts.push(new THREE.Vector2(x * inset, cy + (y - cy) * inset));
  }
  return pts;
}

/** The heart-shaped pointer: wood, a gold inlay line, three felt feet, the glass window in its brass ring. */
function Pointer({ haunted, taken, since }: { haunted: boolean; taken: boolean; since: () => number }) {
  const g = useMemo(() => {
    const shape = new THREE.Shape(heartPoints());
    const hole = new THREE.Path();
    hole.absarc(0, 0, PL.win + 0.002, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const body = new THREE.ExtrudeGeometry(shape, {
      depth: PL.depth,
      bevelEnabled: true,
      bevelThickness: PL.bevel,
      bevelSize: PL.bevel,
      bevelSegments: 4,
      curveSegments: 32,
    });
    boxUV(body, 0.32, 0.32);
    const inlay = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(
        heartPoints(0.84).map((p) => new THREE.Vector3(p.x, p.y, 0)),
        true,
      ),
      160,
      0.0022,
      6,
      true,
    );
    return { body, inlay };
  }, []);
  useEffect(
    () => () => {
      g.body.dispose();
      g.inlay.dispose();
    },
    [g],
  );
  const felt = mat('boardFelt', { surface: 'fabric', color: '#2d4a30', roughness: 1, hauntedColor: '#24221d', decay: { dust: 0.5 } });
  const bottom = PL.feet;
  const top = PL.feet + PL.depth + 2 * PL.bevel;
  const feet: [number, number][] = [
    [-0.09, -0.09],
    [0.09, -0.09],
    [0, 0.095],
  ];
  return (
    <group>
      <mesh geometry={g.body} material={M.woodLight()} position-z={bottom + PL.bevel} />
      <mesh geometry={g.inlay} material={M.gilt()} position-z={top + 0.0005} />
      {feet.map(([x, y], i) => (
        <mesh key={i} material={felt} position={[x, y, bottom / 2]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.017, 0.017, bottom, 16]} />
        </mesh>
      ))}
      {/* the brass lining of the window and the ring round it */}
      <mesh material={M.brass()} position-z={(bottom + top) / 2} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[PL.win + 0.002, PL.win + 0.002, top - bottom, 48, 1, true]} />
      </mesh>
      <mesh material={M.brass()} position-z={top}>
        <torusGeometry args={[PL.win + 0.004, 0.0065, 12, 56]} />
      </mesh>
      {/* the glass: thin and clear, so the letter under it reads; dusty after the Reveal */}
      <mesh position-z={top - 0.004}>
        <circleGeometry args={[PL.win + 0.002, 48]} />
        <meshPhysicalMaterial color={haunted ? '#cfc6b4' : '#ffffff'} transparent opacity={haunted ? 0.24 : 0.14} roughness={0.04} clearcoat={1} depthWrite={false} />
      </mesh>
      {taken && <WindowCrack since={since} z={top - 0.003} />}
    </group>
  );
}

/**
 * The talking board (product 'spirit-board'). Day: the Christmas Eve letter board. Haunted: the
 * same board gone dark, the pointer drifting a hair now and then. Taken: from 0.5 s the pointer
 * spells H-E-L-L-O, about 0.7 s a letter (0.3 s glide, 0.4 s hold; on the second L it lifts and
 * taps down on the same letter at 2.6–2.86 s), holds on O until 4.4 s, glides down to GOOD BYE
 * (4.4–5.5 s), and at 5.8 s the glass in its window cracks (grown over 0.3 s). Reload or reduced
 * motion: the pointer on GOOD BYE, its glass cracked.
 */
export default function SpiritBoard() {
  const haunted = useHaunted();
  const { taken, since } = useTaken('spirit-board');
  const face = useCanvasTexture(TEX.w, TEX.h, (g, w, h) => drawBoard(g, w, h, haunted), [haunted]);
  const g = useMemo(() => {
    const shape = roundedRect(BOARD.w, BOARD.h, BOARD.corner);
    const body = new THREE.ExtrudeGeometry(shape, {
      depth: BOARD.depth,
      bevelEnabled: true,
      bevelThickness: BOARD.bevel,
      bevelSize: BOARD.bevelSize,
      bevelSegments: 5,
      curveSegments: 16,
    });
    boxUV(body, BOARD.w, BOARD.h);
    const top = new THREE.ShapeGeometry(shape, 16);
    boxUV(top, BOARD.w, BOARD.h);
    return { body, top };
  }, []);
  useEffect(
    () => () => {
      g.body.dispose();
      g.top.dispose();
    },
    [g],
  );
  const pointer = useRef<THREE.Group>(null);
  useFrame((st) => posePointer(pointer.current, since(), taken, haunted && !reducedMotion(), st.clock.elapsedTime));
  return (
    <group position={[0, -0.62, 0.12]} rotation-y={-0.12}>
      {/* leaning back from its bottom edge, which rests on the table */}
      <group rotation-x={-LEAN}>
        <group position={[0, BOARD.h / 2 + BOARD.bevelSize, BOARD.bevel]}>
          <mesh geometry={g.body} material={M.wood()} />
          <mesh geometry={g.top} position-z={FACE_Z + 0.0006}>
            <meshPhysicalMaterial map={face} roughness={haunted ? 0.85 : 0.42} clearcoat={haunted ? 0 : 0.6} clearcoatRoughness={0.3} polygonOffset polygonOffsetFactor={-1} />
          </mesh>
          <group ref={pointer} position={[REST.at.x, REST.at.y, FACE_Z]} rotation-z={REST.rot}>
            <Pointer haunted={haunted} taken={taken} since={since} />
          </group>
        </group>
      </group>
    </group>
  );
}
