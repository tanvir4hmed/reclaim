import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type Ref } from 'react';
import * as THREE from 'three';
import { seeded } from '../../director/footprints';
import { reducedMotion } from '../../director/runtime';
import { useCanvasTexture } from '../../gl/canvasTex';
import { M } from '../../gl/materials';
import { progress, useTaken } from '../../gl/useTaken';
import { useHaunted } from '../../store';
import { springGeometry } from '../small/spring';

/*
 * The box stands on y = 0 of its own space: four ball feet, a tin body with rolled gold edges,
 * painted panels on its four sides, and a lid hinged along the back edge of the top. The crank
 * sticks out of the right side (+x). The jack's spring stands on the floor inside the box.
 */
const S = 0.75;
const H = S / 2;
const FOOT_H = 0.035;
const BODY_H = 0.68;
const TOP = FOOT_H + BODY_H;
const LID_T = 0.05;
const MID_Y = FOOT_H + BODY_H / 2;
const CRANK_Y = 0.42;
/** Where the spring stands, inside the box. */
const FLOOR_IN = 0.055;
/** The spring squashed in the box, and at rest once it is out. */
const SPRING_IN = 0.1;
const SPRING_OUT = 0.86;
/** Seconds after the Take. */
const JACK = { wound: 2.0, pop: 2.04, settled: 3.0, tilt: 3.15, tilted: 4.45 };

const TAU = Math.PI * 2;

/** A box with every edge rounded: a rounded rectangle extruded with a bevel. */
function roundedBox(w: number, h: number, d: number, r: number): THREE.ExtrudeGeometry {
  const x = w / 2 - r;
  const y = h / 2 - r;
  const c = r * 0.5;
  const s = new THREE.Shape();
  s.moveTo(-x + c, -y);
  s.lineTo(x - c, -y);
  s.quadraticCurveTo(x, -y, x, -y + c);
  s.lineTo(x, y - c);
  s.quadraticCurveTo(x, y, x - c, y);
  s.lineTo(-x + c, y);
  s.quadraticCurveTo(-x, y, -x, y - c);
  s.lineTo(-x, -y + c);
  s.quadraticCurveTo(-x, -y, -x + c, -y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * r, bevelEnabled: true, bevelSize: r, bevelThickness: r, bevelSegments: 4, curveSegments: 6 });
  g.translate(0, 0, -(d - 2 * r) / 2);
  return g;
}

/** A tube along a curve that tapers: `rad(t)` is its radius at t (0..1 along it). */
function taper(curve: THREE.Curve<THREE.Vector3>, segs: number, radial: number, rad: (t: number) => number): THREE.BufferGeometry {
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
    if (i === 0) N.crossVectors(T, Math.abs(T.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize();
    else N.addScaledVector(T, -T.dot(N)).normalize();
    B.crossVectors(T, N).normalize();
    const r = rad(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * TAU;
      V.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a));
      nor.push(V.x, V.y, V.z);
      pos.push(P.x + V.x * r, P.y + V.y * r, P.z + V.z * r);
      uv.push(t, j / radial);
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

const curve = (pts: [number, number, number][]) => new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));

function smoothLathe(p: [number, number][], n: number, seg: number): THREE.LatheGeometry {
  const c = curve(p.map(([r, y]) => [r, y, 0]));
  return new THREE.LatheGeometry(
    c.getPoints(n).map((v) => new THREE.Vector2(Math.max(0, v.x), v.y)),
    seg,
  );
}

/** The ruff: a ring of pleated cloth round the neck, the pleats fanning out and in. */
function ruffGeometry(): THREE.BufferGeometry {
  const R = 0.085;
  const g = new THREE.TorusGeometry(R, 0.034, 12, 120);
  g.rotateX(Math.PI / 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    const cx = Math.cos(a) * R;
    const cz = Math.sin(a) * R;
    const k = 1 + 0.42 * Math.sin(a * 22);
    p.setXYZ(i, cx + (x - cx) * k, y * k * 0.72, cz + (z - cz) * k);
  }
  g.computeVertexNormals();
  return g;
}

/** The jack's tunic: a short bell of cloth, its hem torn into points. */
function tunicGeometry(): THREE.LatheGeometry {
  const g = smoothLathe(
    [
      [0.118, 0.0],
      [0.112, 0.03],
      [0.094, 0.08],
      [0.072, 0.12],
      [0.056, 0.145],
    ],
    20,
    48,
  );
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y > 0.04) continue;
    const a = Math.atan2(p.getX(i), p.getZ(i));
    // ragged: uneven tatters, longer on one side
    const cut = Math.abs(Math.sin(a * 5 + 0.4)) * (0.6 + 0.4 * Math.sin(a * 2.3)) * 0.045;
    p.setY(i, y + Math.max(0, 0.04 - y) * (cut / 0.04));
  }
  g.computeVertexNormals();
  return g;
}

/** Point on the head (unit sphere, before its scale) at a longitude and latitude in degrees. */
function onHead(lon: number, lat: number, out = 1): THREE.Vector3 {
  const lo = (lon * Math.PI) / 180;
  const la = (lat * Math.PI) / 180;
  return new THREE.Vector3(Math.sin(lo) * Math.cos(la) * out, Math.sin(la) * out, Math.cos(lo) * Math.cos(la) * out);
}
const HEAD_R: [number, number, number] = [0.114, 0.126, 0.11];
const EYE_LON = 22;
const EYE_LAT = 10;

/** The three points of the hat, from the cap out: left, right (torn short), and one at the back. */
const HAT_POINTS: { pts: [number, number, number][]; r0: number; torn?: boolean }[] = [
  {
    pts: [
      [-0.05, 0.1, 0.0],
      [-0.13, 0.17, 0.0],
      [-0.21, 0.15, 0.02],
      [-0.25, 0.07, 0.04],
      [-0.25, 0.02, 0.05],
    ],
    r0: 0.052,
  },
  {
    pts: [
      [0.05, 0.1, 0.0],
      [0.12, 0.16, 0.0],
      [0.17, 0.14, 0.02],
      [0.19, 0.1, 0.03],
    ],
    r0: 0.052,
    torn: true,
  },
  {
    pts: [
      [0.0, 0.11, -0.03],
      [0.01, 0.22, -0.06],
      [0.06, 0.28, -0.08],
      [0.11, 0.25, -0.08],
      [0.13, 0.19, -0.07],
    ],
    r0: 0.05,
  },
];

function buildJack() {
  const hat = HAT_POINTS.map((h) => {
    const c = curve(h.pts);
    return {
      geo: taper(c, 40, 16, (t) => (h.torn ? h.r0 * (1 - 0.7 * t) : h.r0 * (1 - t) ** 0.85 + 0.004)),
      tip: c.getPoint(1),
      dir: c.getTangent(1).normalize(),
      torn: h.torn === true,
    };
  });
  return {
    body: roundedBox(S, BODY_H, S, 0.03),
    lid: roundedBox(S + 0.03, LID_T, S + 0.03, 0.016),
    knob: smoothLathe(
      [
        [0.0, 0.0],
        [0.014, 0.003],
        [0.019, 0.02],
        [0.015, 0.045],
        [0.021, 0.066],
        [0.013, 0.082],
        [0.0, 0.085],
      ],
      24,
      24,
    ),
    spring: springGeometry(12, 0.075, 1, 0.01),
    ruff: ruffGeometry(),
    tunic: tunicGeometry(),
    sphere: new THREE.SphereGeometry(1, 40, 28),
    small: new THREE.SphereGeometry(1, 14, 10),
    capL: new THREE.SphereGeometry(1, 24, 10, -Math.PI / 2, Math.PI, 0, Math.PI / 2),
    capR: new THREE.SphereGeometry(1, 24, 10, Math.PI / 2, Math.PI, 0, Math.PI / 2),
    hat,
  };
}

let jackGeo: ReturnType<typeof buildJack> | null = null;
function parts() {
  jackGeo ??= buildJack();
  return jackGeo;
}

/* ------------------------------------------------------------------------------------------ */
/* Paint                                                                                     */
/* ------------------------------------------------------------------------------------------ */

function star(g: CanvasRenderingContext2D, x: number, y: number, r: number, rot = -Math.PI / 2) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.42 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

/** Red and green harlequin diamonds outlined in gold, gold stars in the green ones, a gold border. */
function paintHarlequin(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = '#a8202a';
  g.fillRect(0, 0, w, h);
  const n = 4;
  const dw = w / n;
  const dh = h / n;
  for (let j = -1; j <= n * 2 + 1; j++)
    for (let i = -1; i <= n + 1; i++) {
      const x = i * dw + (j % 2 ? dw / 2 : 0);
      const y = (j * dh) / 2;
      g.beginPath();
      g.moveTo(x, y - dh / 2);
      g.lineTo(x + dw / 2, y);
      g.lineTo(x, y + dh / 2);
      g.lineTo(x - dw / 2, y);
      g.closePath();
      const green = Math.abs(j % 2) === 1;
      g.fillStyle = green ? '#2c6538' : '#b0222c';
      g.fill();
      g.strokeStyle = '#d9b25a';
      g.lineWidth = 3;
      g.stroke();
      if (green) {
        g.fillStyle = '#e8c45c';
        star(g, x, y, dw * 0.13);
      }
    }
  g.strokeStyle = '#d9b25a';
  g.lineWidth = 18;
  g.strokeRect(9, 9, w - 18, h - 18);
  g.strokeStyle = '#5a0f14';
  g.lineWidth = 3;
  g.strokeRect(22, 22, w - 44, h - 44);
}

/** The jolly jester in a gold medallion, painted on the front. */
function paintMedallion(g: CanvasRenderingContext2D, w: number, h: number, haunted: boolean) {
  const cx = w / 2;
  const cy = h / 2;
  const ring = g.createRadialGradient(cx - 40, cy - 50, 20, cx, cy, 160);
  ring.addColorStop(0, '#f6dc8a');
  ring.addColorStop(0.7, '#c8962e');
  ring.addColorStop(1, '#8a6420');
  g.fillStyle = ring;
  g.beginPath();
  g.arc(cx, cy, 160, 0, TAU);
  g.fill();
  g.fillStyle = '#f3e6c8';
  g.beginPath();
  g.arc(cx, cy, 136, 0, TAU);
  g.fill();
  // ruff collar under the face: scallops
  g.fillStyle = '#fbf6ea';
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    g.arc(cx - 80 + i * 20, cy + 78, 16, 0, TAU);
    g.fill();
  }
  // the hat: a red point to the left and a green one to the right, gold bells on the tips
  g.fillStyle = '#b0222c';
  g.beginPath();
  g.moveTo(cx - 10, cy - 50);
  g.quadraticCurveTo(cx - 70, cy - 120, cx - 112, cy - 70);
  g.quadraticCurveTo(cx - 70, cy - 80, cx - 52, cy - 30);
  g.closePath();
  g.fill();
  g.fillStyle = '#2c6538';
  g.beginPath();
  g.moveTo(cx + 10, cy - 50);
  g.quadraticCurveTo(cx + 70, cy - 120, cx + 112, cy - 70);
  g.quadraticCurveTo(cx + 70, cy - 80, cx + 52, cy - 30);
  g.closePath();
  g.fill();
  g.fillStyle = '#e8c45c';
  for (const s of [-1, 1]) {
    g.beginPath();
    g.arc(cx + s * 114, cy - 66, 11, 0, TAU);
    g.fill();
  }
  // the face
  g.fillStyle = '#f4d6bc';
  g.beginPath();
  g.ellipse(cx, cy + 10, 58, 64, 0, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(214,90,90,0.45)';
  for (const s of [-1, 1]) {
    g.beginPath();
    g.arc(cx + s * 32, cy + 26, 13, 0, TAU);
    g.fill();
  }
  g.strokeStyle = '#3a2418';
  g.lineWidth = 5;
  g.lineCap = 'round';
  for (const s of [-1, 1]) {
    // happy closed eyes
    g.beginPath();
    g.arc(cx + s * 22, cy + 2, 10, Math.PI * 1.1, Math.PI * 1.9);
    g.stroke();
  }
  g.beginPath();
  g.arc(cx, cy + 26, 26, Math.PI * 0.15, Math.PI * 0.85);
  g.stroke();
  g.fillStyle = '#c42030';
  g.beginPath();
  g.arc(cx, cy + 16, 9, 0, TAU);
  g.fill();
  g.fillStyle = '#e8c45c';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    star(g, cx + Math.cos(a) * 148, cy + Math.sin(a) * 148, 7, a);
  }
  if (haunted) {
    // someone has scratched his eyes out, and scraped at the smile
    const r = seeded(19);
    g.strokeStyle = 'rgba(30,20,14,0.85)';
    g.lineWidth = 2;
    for (const s of [-1, 1])
      for (let k = 0; k < 14; k++) {
        const x = cx + s * 22 + (r() - 0.5) * 26;
        const y = cy + (r() - 0.5) * 20;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (r() - 0.5) * 22, y + (r() - 0.5) * 22);
        g.stroke();
      }
    g.strokeStyle = 'rgba(200,190,170,0.5)';
    for (let k = 0; k < 6; k++) {
      g.beginPath();
      g.moveTo(cx - 30 + k * 10, cy + 40 + r() * 6);
      g.lineTo(cx - 20 + k * 10, cy + 52 + r() * 6);
      g.stroke();
    }
  }
}

/** The big gold star and small ones on the lid. */
function paintLidTop(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = '#245a31';
  g.fillRect(0, 0, w, h);
  const r = seeded(5);
  g.fillStyle = '#e8c45c';
  star(g, w / 2, h / 2 + 6, w * 0.24);
  for (let i = 0; i < 22; i++) {
    const a = r() * TAU;
    const d = w * (0.33 + r() * 0.12);
    star(g, w / 2 + Math.cos(a) * d * 0.95, h / 2 + Math.sin(a) * d * 0.95, 6 + r() * 7, r() * TAU);
  }
  g.strokeStyle = '#d9b25a';
  g.lineWidth = 18;
  g.strokeRect(9, 9, w - 18, h - 18);
}

/**
 * Years in the dark: the paint faded and browned, grime gathered low, flakes of it peeled off to
 * the bare tin (dark, rusty, each flake's curled edge catching the light), scratches through it.
 */
function weather(g: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  const r = seeded(seed);
  g.save();
  g.globalCompositeOperation = 'saturation';
  g.fillStyle = 'rgba(128,128,128,0.62)';
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = '#9a8868';
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
  const grime = g.createLinearGradient(0, 0, 0, h);
  grime.addColorStop(0, 'rgba(20,14,10,0.15)');
  grime.addColorStop(0.6, 'rgba(20,14,10,0.05)');
  grime.addColorStop(1, 'rgba(20,14,10,0.45)');
  g.fillStyle = grime;
  g.fillRect(0, 0, w, h);
  // peeling flakes
  for (let k = 0; k < 16; k++) {
    const x = r() * w;
    const y = r() * h;
    const R = 10 + r() * 40;
    const pts: [number, number][] = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      const rr = R * (0.55 + r() * 0.6);
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8]);
    }
    const path = () => {
      g.beginPath();
      pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
      g.closePath();
    };
    path();
    g.fillStyle = '#4f4a42';
    g.fill();
    for (let i = 0; i < 10; i++) {
      g.fillStyle = `rgba(110,58,26,${0.3 + r() * 0.4})`;
      g.beginPath();
      g.arc(x + (r() - 0.5) * R, y + (r() - 0.5) * R * 0.8, 2 + r() * 6, 0, TAU);
      g.fill();
    }
    g.strokeStyle = 'rgba(15,10,8,0.8)';
    g.lineWidth = 2;
    path();
    g.stroke();
    // the curled edge of the paint, lit from above
    g.strokeStyle = 'rgba(220,206,176,0.55)';
    g.lineWidth = 1.5;
    g.beginPath();
    pts.slice(8, 13).forEach(([px, py], i) => (i ? g.lineTo(px, py - 2) : g.moveTo(px, py - 2)));
    g.stroke();
  }
  // rust run down from the top edge, and scratches
  for (let k = 0; k < 9; k++) {
    const x = r() * w;
    const run = g.createLinearGradient(0, 0, 0, h * (0.2 + r() * 0.4));
    run.addColorStop(0, 'rgba(96,48,20,0.55)');
    run.addColorStop(1, 'rgba(96,48,20,0)');
    g.fillStyle = run;
    g.fillRect(x, 0, 3 + r() * 6, h);
  }
  g.strokeStyle = 'rgba(210,200,180,0.35)';
  g.lineWidth = 1;
  for (let k = 0; k < 24; k++) {
    const x = r() * w;
    const y = r() * h;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 80, y + (r() - 0.5) * 30);
    g.stroke();
  }
  g.restore();
}

/** The jack's face, on its sphere (u 0.25 is the front): chalk white, cracked, a grin too wide. */
function paintClown(g: CanvasRenderingContext2D, w: number, h: number) {
  const r = seeded(31);
  g.fillStyle = '#e2ddd2';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 300; i++) {
    g.fillStyle = r() < 0.5 ? `rgba(120,110,90,${0.04 + r() * 0.08})` : `rgba(160,150,120,${0.04 + r() * 0.08})`;
    g.beginPath();
    g.ellipse(r() * w, r() * h, 4 + r() * 30, 3 + r() * 16, r() * 3, 0, TAU);
    g.fill();
  }
  const cx = w * 0.25;
  const cy = h * 0.5;
  const d = w / 360;
  // the eyes: sunk in a bruise-grey hollow, ringed in black that has run down the cheeks
  for (const s of [-1, 1]) {
    const ex = cx + s * EYE_LON * d;
    const ey = cy - EYE_LAT * d;
    const hollow = g.createRadialGradient(ex, ey, 0, ex, ey, 30 * d);
    hollow.addColorStop(0, 'rgba(60,40,52,0.7)');
    hollow.addColorStop(1, 'rgba(60,40,52,0)');
    g.fillStyle = hollow;
    g.fillRect(ex - 30 * d, ey - 30 * d, 60 * d, 60 * d);
    g.fillStyle = '#0a0606';
    g.beginPath();
    g.ellipse(ex, ey, 9 * d, 11.5 * d, s * 0.15, 0, TAU);
    g.fill();
    g.beginPath();
    g.moveTo(ex - 3 * d, ey + 8 * d);
    g.quadraticCurveTo(ex - s * 1 * d, ey + 20 * d, ex + s * 0.5 * d, ey + 27 * d);
    g.quadraticCurveTo(ex + 2 * d, ey + 18 * d, ex + 3.5 * d, ey + 8 * d);
    g.fill();
    g.fillStyle = '#bdb399';
    g.beginPath();
    g.ellipse(ex, ey + d, 3.2 * d, 3.6 * d, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#000';
    g.beginPath();
    g.arc(ex - s * 0.4 * d, ey + d, 1.3 * d, 0, TAU);
    g.fill();
    // brows painted high, slanting in
    g.strokeStyle = '#120c0a';
    g.lineWidth = 1.4 * d;
    g.beginPath();
    g.moveTo(ex - s * 9 * d, ey - 13 * d);
    g.quadraticCurveTo(ex + s * 2 * d, ey - 24 * d, ex + s * 11 * d, ey - 14 * d);
    g.stroke();
  }
  // the grin: far too wide, the ends dragged up the cheeks, red smeared round it
  const half = 40 * d;
  const top = (x: number) => cy + 16 * d - 15 * d * (x / half) ** 2;
  const thick = (x: number) => 9 * d * Math.max(0, 1 - (x / half) ** 2) ** 0.6 + 1.6 * d;
  const band = (grow: number, dx = 0, dy = 0) => {
    g.beginPath();
    for (let x = -half - grow; x <= half + grow; x += 2) g.lineTo(cx + x + dx, top(x) - grow * 0.5 + dy);
    for (let x = half + grow; x >= -half - grow; x -= 2) g.lineTo(cx + x + dx, top(x) + thick(x) + grow + dy);
    g.closePath();
  };
  for (let k = 0; k < 7; k++) {
    g.fillStyle = 'rgba(140,22,28,0.28)';
    band(5 * d + r() * 3 * d, (r() - 0.5) * 5 * d, (r() - 0.5) * 4 * d);
    g.fill();
  }
  g.fillStyle = '#8a141b';
  band(2.5 * d);
  g.fill();
  g.fillStyle = '#1b0505';
  band(0);
  g.fill();
  // yellowed teeth along the middle of it
  g.fillStyle = '#c8b886';
  for (let x = -half * 0.62; x <= half * 0.62; x += 4.6 * d) {
    const y = top(x) + 0.8 * d;
    g.fillRect(cx + x - 1.8 * d, y, 3.6 * d, thick(x) * 0.42);
    g.fillRect(cx + x - 1.8 * d, y + thick(x) * 0.58, 3.6 * d, thick(x) * 0.36);
  }
  // red runs down from the corners
  g.fillStyle = 'rgba(120,16,22,0.8)';
  for (const s of [-1, 1]) {
    const x = cx + s * half * 0.96;
    g.fillRect(x - d, top(s * half * 0.96) + 2 * d, 1.6 * d, 10 * d + r() * 8 * d);
  }
  // the paint has cracked all over, like an old plate
  g.strokeStyle = 'rgba(70,62,52,0.75)';
  g.lineWidth = 1.2;
  for (let k = 0; k < 40; k++) {
    let x = cx + (r() - 0.5) * 90 * d;
    let y = cy + (r() - 0.5) * 70 * d;
    g.beginPath();
    g.moveTo(x, y);
    for (let i = 0; i < 6; i++) {
      x += (r() - 0.5) * 9 * d;
      y += (r() - 0.5) * 9 * d;
      g.lineTo(x, y);
    }
    g.stroke();
  }
}

/** The jack's tunic: faded red and green diamonds, grubby. */
function paintTunic(g: CanvasRenderingContext2D, w: number, h: number) {
  paintHarlequin(g, w, h);
  weather(g, w, h, 63);
}

/* ------------------------------------------------------------------------------------------ */
/* The box                                                                                   */
/* ------------------------------------------------------------------------------------------ */

function Panels({ haunted }: { haunted: boolean }) {
  const side = useCanvasTexture(
    512,
    512,
    (g, w, h) => {
      paintHarlequin(g, w, h);
      if (haunted) weather(g, w, h, 11);
    },
    [haunted],
  );
  const front = useCanvasTexture(
    512,
    512,
    (g, w, h) => {
      paintHarlequin(g, w, h);
      paintMedallion(g, w, h, haunted);
      if (haunted) weather(g, w, h, 23);
    },
    [haunted],
  );
  const paint = (map: THREE.Texture) => <meshStandardMaterial map={map} roughness={haunted ? 0.85 : 0.38} metalness={haunted ? 0.1 : 0.25} />;
  const pw = S - 0.11;
  const ph = BODY_H - 0.11;
  const o = H + 0.0015;
  return (
    <group position-y={MID_Y}>
      <mesh position-z={o}>
        <planeGeometry args={[pw, ph]} />
        {paint(front)}
      </mesh>
      <mesh position-z={-o} rotation-y={Math.PI}>
        <planeGeometry args={[pw, ph]} />
        {paint(side)}
      </mesh>
      <mesh position-x={o} rotation-y={Math.PI / 2}>
        <planeGeometry args={[pw, ph]} />
        {paint(side)}
      </mesh>
      <mesh position-x={-o} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[pw, ph]} />
        {paint(side)}
      </mesh>
    </group>
  );
}

/** The rolled gold edging along all twelve edges of the body, with a bead at each corner. */
function Trim() {
  const g = parts();
  const e = H - 0.012;
  const lo = FOOT_H + 0.015;
  const hi = TOP - 0.015;
  const gilt = M.gilt();
  const len = S - 0.05;
  return (
    <group>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <group key={`${sx}${sz}`}>
            <mesh material={gilt} position={[sx * e, MID_Y, sz * e]}>
              <cylinderGeometry args={[0.02, 0.02, BODY_H - 0.03, 14]} />
            </mesh>
            {[lo, hi].map((y) => (
              <mesh key={y} geometry={g.small} material={gilt} position={[sx * e, y, sz * e]} scale={0.024} />
            ))}
          </group>
        )),
      )}
      {[lo, hi].map((y) =>
        [-1, 1].map((s) => (
          <group key={`${y}${s}`}>
            <mesh material={gilt} position={[0, y, s * e]} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.02, 0.02, len, 14]} />
            </mesh>
            <mesh material={gilt} position={[s * e, y, 0]} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.02, 0.02, len, 14]} />
            </mesh>
          </group>
        )),
      )}
    </group>
  );
}

/** The lid: tin, gold-banded, the star panel on top, the hasp of the latch hanging off the front. */
function Lid({ haunted, hasp }: { haunted: boolean; hasp: Ref<THREE.Group> }) {
  const g = parts();
  const top = useCanvasTexture(
    512,
    512,
    (c, w, h) => {
      paintLidTop(c, w, h);
      if (haunted) weather(c, w, h, 41);
    },
    [haunted],
  );
  const d = H + 0.015;
  const edge = S / 2 + 0.016;
  return (
    <group position-z={d}>
      <mesh geometry={g.lid} material={M.tin()} position-y={LID_T / 2} />
      <mesh position-y={LID_T + 0.0015} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[S - 0.08, S - 0.08]} />
        <meshStandardMaterial map={top} roughness={haunted ? 0.85 : 0.38} metalness={haunted ? 0.1 : 0.25} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} material={M.gilt()} position={[Math.sin((i * Math.PI) / 2) * edge, LID_T / 2, Math.cos((i * Math.PI) / 2) * edge]} rotation-y={(i * Math.PI) / 2}>
          <boxGeometry args={[S - 0.02, 0.016, 0.004]} />
        </mesh>
      ))}
      <group ref={hasp} position={[0, 0.004, edge + 0.004]}>
        <mesh material={M.gilt()} position-y={-0.034}>
          <boxGeometry args={[0.05, 0.068, 0.006]} />
        </mesh>
        <mesh material={M.ink()} position={[0, -0.05, 0.0035]}>
          <boxGeometry args={[0.016, 0.022, 0.002]} />
        </mesh>
      </group>
    </group>
  );
}

/** The crank on the right side: a gold hub, a steel arm, a turned wooden knob. */
function Crank({ crank }: { crank: Ref<THREE.Group> }) {
  const g = parts();
  return (
    <group position={[H + 0.004, CRANK_Y, 0]}>
      <mesh material={M.gilt()} position-x={0.007} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.046, 0.05, 0.014, 32]} />
      </mesh>
      <group ref={crank} position-x={0.014}>
        <mesh material={M.silver()} position-x={0.03} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.011, 0.011, 0.06, 14]} />
        </mesh>
        <mesh material={M.silver()} position={[0.062, -0.065, 0]}>
          <boxGeometry args={[0.016, 0.13, 0.032]} />
        </mesh>
        {[0, -0.13].map((y) => (
          <mesh key={y} material={M.silver()} position={[0.062, y, 0]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.016, 0.016, 0.016, 20]} />
          </mesh>
        ))}
        <mesh material={M.silver()} position={[0.076, -0.13, 0]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.006, 0.006, 0.02, 10]} />
        </mesh>
        <mesh geometry={g.knob} material={M.wood()} position={[0.082, -0.13, 0]} rotation-z={-Math.PI / 2} />
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* The jack                                                                                  */
/* ------------------------------------------------------------------------------------------ */

/** A tarnished bell on the tip of a hat point. */
function Bell({ at }: { at: THREE.Vector3 }) {
  const g = parts();
  return (
    <group position={at}>
      <mesh geometry={g.small} material={M.darkBrass()} position-y={-0.02} scale={0.022} />
      <mesh material={M.ink()} position={[0, -0.03, 0.016]}>
        <boxGeometry args={[0.024, 0.004, 0.012]} />
      </mesh>
      <mesh material={M.darkBrass()} position-y={0.002}>
        <torusGeometry args={[0.007, 0.002, 6, 12]} />
      </mesh>
    </group>
  );
}

/** The jester's hat, torn: a two-colour cap, three limp points, bells gone dull. */
function Hat() {
  const g = parts();
  const red = M.cloth();
  const green = M.green();
  return (
    <group>
      <mesh geometry={g.capL} material={red} position-y={0.035} scale={[0.122, 0.105, 0.116]} />
      <mesh geometry={g.capR} material={green} position-y={0.035} scale={[0.122, 0.105, 0.116]} />
      <mesh material={M.ribbon()} position-y={0.04} rotation-x={Math.PI / 2} scale={[1, 0.95, 1]}>
        <torusGeometry args={[0.12, 0.012, 8, 48]} />
      </mesh>
      {g.hat.map((h, i) => (
        <group key={i}>
          <mesh geometry={h.geo} material={i === 1 ? green : red} />
          {h.torn ? (
            // the end has torn away: frayed threads hang from it
            [-1, 0, 1].map((k) => (
              <mesh key={k} material={green} position={[h.tip.x + k * 0.008, h.tip.y - 0.02, h.tip.z]} rotation-z={k * 0.2}>
                <cylinderGeometry args={[0.0025, 0.001, 0.04, 4]} />
              </mesh>
            ))
          ) : (
            <Bell at={h.tip} />
          )}
        </group>
      ))}
      {/* the bells round the band, one missing */}
      {[-50, -20, 20, 50].map((lon) => (
        <Bell key={lon} at={onHead(lon, 0, 1).multiply(new THREE.Vector3(0.13, 0.13, 0.125)).setY(0.03)} />
      ))}
    </group>
  );
}

/**
 * The jack: not the jester painted on the box but a pale clown, chalk-white and cracked, eyes
 * sunk in black rings with a pin-point of light in each, a red smeared grin too wide for the face,
 * a torn jester's hat, a ruff, a tattered tunic over the spring.
 */
function Clown({ head }: { head: Ref<THREE.Group> }) {
  const g = parts();
  const face = useCanvasTexture(1024, 512, paintClown, []);
  const tunic = useCanvasTexture(256, 256, paintTunic, []);
  const glints = useMemo(() => [-1, 1].map((s) => onHead(s * EYE_LON, EYE_LAT, 1.01).multiply(new THREE.Vector3(...HEAD_R))), []);
  return (
    <group>
      <mesh geometry={g.tunic}>
        <meshStandardMaterial map={tunic} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      {/* limp little sleeves with grubby gloves */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.07, 0.12, 0]} rotation-z={s * 0.55}>
          <mesh material={M.cloth()} position-y={-0.06}>
            <cylinderGeometry args={[0.022, 0.034, 0.12, 14]} />
          </mesh>
          <mesh geometry={g.small} material={M.clothWhite()} position-y={-0.13} scale={[0.026, 0.03, 0.022]} />
        </group>
      ))}
      <mesh geometry={g.ruff} material={M.clothWhite()} position-y={0.15} />
      <mesh material={M.clothWhite()} position-y={0.17}>
        <cylinderGeometry args={[0.03, 0.034, 0.05, 16]} />
      </mesh>
      <group ref={head} position-y={0.27}>
        <mesh geometry={g.sphere} scale={HEAD_R}>
          <meshStandardMaterial map={face} roughness={0.9} />
        </mesh>
        {/* the red nose, gone dark */}
        <mesh geometry={g.small} material={M.berry()} position={[0, -0.008, HEAD_R[2] + 0.012]} scale={0.024} />
        {/* thin clumps of dull red hair over the ears */}
        {[-1, 1].map((s) =>
          [0, 1, 2, 3].map((k) => (
            <mesh
              key={`${s}${k}`}
              geometry={g.small}
              position={onHead(s * (78 + k * 6), -6 + k * 9, 1).multiply(new THREE.Vector3(...HEAD_R))}
              scale={0.032 - k * 0.004}
            >
              <meshStandardMaterial color="#5e2a1c" roughness={1} />
            </mesh>
          )),
        )}
        {glints.map((p, i) => (
          <mesh key={i} geometry={g.small} position={p} scale={0.0045}>
            <meshBasicMaterial color="#e8e0b8" toneMapped={false} />
          </mesh>
        ))}
        <group position-y={0.0}>
          <Hat />
        </group>
        <pointLight position={[0, 0.05, 0.35]} intensity={0.25} distance={1.2} color="#d6dce6" />
      </group>
    </group>
  );
}

/** Things moved by the Take, handed to the helper below. */
interface JackRefs {
  box: THREE.Group | null;
  lid: THREE.Group | null;
  hasp: THREE.Group | null;
  crank: THREE.Group | null;
  coil: THREE.Mesh | null;
  top: THREE.Group | null;
  head: THREE.Group | null;
  pins: THREE.Group | null;
}

/** The crank's angle while it winds itself: slow then faster, catching for a moment each turn. */
function windAngle(t: number): number {
  const tt = Math.min(t, JACK.wound);
  const base = TAU * (0.35 * tt + 0.6 * tt * tt);
  // it sticks near the top of each turn, then lurches on
  const a = base - 0.42 * Math.sin(base);
  return t <= JACK.wound ? a : a - 0.35 * progress(t, 0.4, JACK.wound);
}

/** Everything about the box and the jack for a time `s` after the Take (-1: not taken). */
function poseJack(r: JackRefs, s: number, haunted: boolean, clock: number) {
  const still = reducedMotion();
  if (s < 0) {
    // not taken: shut by day; after the Reveal the lid has lifted a crack and the latch hangs open
    if (r.lid) r.lid.rotation.x = haunted ? -0.06 : 0;
    if (r.hasp) r.hasp.rotation.x = haunted ? -0.75 : 0;
    // at night the crank creeps round on its own, a quarter turn now and then
    if (r.crank) {
      const step = still || !haunted ? 0 : Math.floor(clock / 13) + progress(clock % 13, 1.6, 0);
      r.crank.rotation.x = step * (Math.PI / 2);
    }
    // the two pin-points in the crack: now and then they blink
    if (r.pins) {
      r.pins.visible = haunted;
      const b = (clock + 2) % 9;
      r.pins.scale.y = !still && b < 0.18 ? 0.1 : 1;
    }
    if (r.top) r.top.visible = false;
    if (r.coil) r.coil.visible = false;
    if (r.box) r.box.rotation.z = 0;
    return;
  }
  const t = s === Infinity ? 99 : s;
  if (r.pins) r.pins.visible = false;
  if (r.hasp) r.hasp.rotation.x = -0.75 - 0.5 * progress(t, 0.2, JACK.wound);
  const ang = windAngle(t);
  if (r.crank) r.crank.rotation.x = ang;
  // the box shudders as it winds, and jolts when the lid goes
  const winding = t < JACK.wound ? (t / JACK.wound) * Math.max(0, Math.sin(ang * 2)) : 0;
  const jolt = t > JACK.wound && t < JACK.wound + 0.25 ? Math.sin(((t - JACK.wound) / 0.25) * Math.PI) : 0;
  if (r.box) {
    r.box.rotation.z = 0.006 * winding + 0.012 * jolt;
    r.box.position.y = 0.01 * jolt;
  }
  if (r.lid) {
    if (t < JACK.wound) {
      // the lid strains against the latch at each turn
      r.lid.rotation.x = -0.06 - 0.035 * Math.max(0, Math.sin(ang)) ** 8;
    } else {
      const k = progress(t, 0.14, JACK.wound);
      const b = t > JACK.wound + 0.14 ? 0.16 * Math.exp(-(t - JACK.wound - 0.14) * 7) * Math.sin((t - JACK.wound - 0.14) * 22) : 0;
      r.lid.rotation.x = -0.06 - 1.99 * k + b;
    }
  }
  const out = t >= JACK.pop;
  if (r.top) r.top.visible = out;
  if (r.coil) r.coil.visible = out;
  if (!out) return;
  const tau = t - JACK.pop;
  // a hard spring: overshoot, then bobbing, damped out by about 3 s
  const len = SPRING_OUT + (SPRING_IN - SPRING_OUT) * Math.exp(-5 * tau) * Math.cos(14 * tau);
  const wob = 0.22 * Math.exp(-3 * tau) * Math.sin(9 * tau + 0.6);
  // then a slow sway that never stops (unless motion is reduced)
  const swayT = s === Infinity ? (still ? 0 : clock) : t - JACK.settled;
  const sway = (s === Infinity ? (still ? 0 : 1) : progress(t, 0.6, JACK.settled)) * 0.07 * Math.sin(swayT * 1.6);
  const lean = wob + sway;
  if (r.coil) {
    r.coil.scale.set(1, Math.max(0.03, len), 1);
    r.coil.rotation.z = lean;
  }
  if (r.top) {
    r.top.position.set(-Math.sin(lean) * len, FLOOR_IN + Math.cos(lean) * len, 0);
    r.top.rotation.z = lean * 1.25;
  }
  if (r.head) {
    // the head lolls over to one side, much too far, turning to face you; a last small click
    const tilt = 1.0 * progress(t, JACK.tilted - JACK.tilt, JACK.tilt) + 0.14 * progress(t, 0.12, JACK.tilted);
    const turn = 0.5 * progress(t, 1.2, JACK.tilt - 0.05);
    r.head.rotation.set(0.08 * tilt, turn, -tilt - lean * 0.6);
    r.head.position.set(-0.035 * tilt, 0.27 - 0.012 * tilt, 0);
  }
}

/**
 * Jack-in-the-box (jack-in-the-box): a tin box with rounded gold-edged corners, painted all over
 * in red and green harlequin diamonds and gold stars, a jolly jester in a medallion on the front,
 * a star on the lid with a little latch, and a crank with a wooden knob on the right side.
 * After the Reveal the paint is faded and peeling, the lid has lifted a crack and two pin-points
 * of light look out of the dark inside. Taken: the crank winds itself, the lid bursts open and
 * out comes not a jester but a pale clown on a spring, whose head lolls over to one side.
 */
export default function JackInTheBox() {
  const haunted = useHaunted();
  const { taken, since } = useTaken('jack-in-the-box');
  const g = parts();
  const refs = useRef<JackRefs>({ box: null, lid: null, hasp: null, crank: null, coil: null, top: null, head: null, pins: null });
  useFrame((state) => poseJack(refs.current, taken ? since() : -1, haunted, state.clock.elapsedTime));
  return (
    <group position={[-0.06, -0.62, 0]} rotation-y={-0.5}>
      <group
        ref={(o) => {
          refs.current.box = o;
        }}
      >
        {[-1, 1].map((sx) =>
          [-1, 1].map((sz) => (
            <mesh key={`${sx}${sz}`} geometry={g.small} material={M.gilt()} position={[sx * 0.3, 0.021, sz * 0.3]} scale={[0.03, 0.021, 0.03]} />
          )),
        )}
        <mesh geometry={g.body} material={M.tin()} position-y={MID_Y} />
        <Panels haunted={haunted} />
        <Trim />
        {/* the dark inside, seen through the crack and when the lid is open */}
        <mesh position-y={TOP + 0.001} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[S - 0.06, S - 0.06]} />
          <meshStandardMaterial color="#070505" roughness={1} />
        </mesh>
        {/* the latch's staple on the front */}
        <mesh material={M.gilt()} position={[0, TOP - 0.035, H + 0.004]}>
          <boxGeometry args={[0.07, 0.04, 0.006]} />
        </mesh>
        <mesh material={M.gilt()} position={[0, TOP - 0.03, H + 0.01]}>
          <torusGeometry args={[0.011, 0.0035, 6, 16]} />
        </mesh>
        <group
          ref={(o) => {
            refs.current.pins = o;
          }}
          position={[0, TOP + 0.014, H - 0.09]}
          visible={false}
        >
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={g.small} position-x={s * 0.03} scale={0.0065}>
              <meshBasicMaterial color="#9a9474" toneMapped={false} />
            </mesh>
          ))}
        </group>
        <group
          ref={(o) => {
            refs.current.lid = o;
          }}
          position={[0, TOP, -H - 0.015]}
        >
          <Lid
            haunted={haunted}
            hasp={(o: THREE.Group | null) => {
              refs.current.hasp = o;
            }}
          />
        </group>
        <Crank
          crank={(o: THREE.Group | null) => {
            refs.current.crank = o;
          }}
        />
        {taken && (
          <>
            <mesh
              ref={(o) => {
                refs.current.coil = o;
              }}
              geometry={g.spring}
              material={M.silver()}
              position-y={FLOOR_IN}
              visible={false}
            />
            <group
              ref={(o) => {
                refs.current.top = o;
              }}
              visible={false}
            >
              <Clown
                head={(o: THREE.Group | null) => {
                  refs.current.head = o;
                }}
              />
            </group>
          </>
        )}
      </group>
      {/* not drawn: the space the jack rises into, so the product view frames it */}
      {haunted && (
        <mesh position={[0, 0.9, -0.15]} userData={{ frame: true }}>
          <boxGeometry args={[0.95, 1.8, 1.2]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      )}
    </group>
  );
}
