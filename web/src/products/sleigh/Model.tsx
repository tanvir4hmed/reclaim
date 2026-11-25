import { RoundedBox } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import type { Ref } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { seeded } from '../../director/footprints';
import { useCanvasTexture } from '../../gl/canvasTex';
import { mat } from '../../gl/decay';
import { M } from '../../gl/materials';
import { progress, useTaken } from '../../gl/useTaken';
import { useHaunted } from '../../store';
import { sweep } from '../doll/shapes';

/*
 * Santa's sleigh and reindeer, a carved and hand-painted wooden toy: a red lacquered sleigh with
 * a curled front, gold trim and painted scrolls, gold runners curling up at the front, a green
 * velvet seat, a burlap sack full of wrapped gifts at the back, and one reindeer in a red harness
 * with gold bells and a glowing red nose, on two shafts, the reins tied to the dash. After the
 * Reveal it is the same toy come back from somewhere: the paint dull and chipped, the sack grey
 * and dirty, and the reindeer mostly bone, a ribcage with scraps of hide still on it, a deer's
 * skull with black sockets, blackened antlers, the nose a dim dark red. Taken: the skull turns
 * round on its neck to look at you, its jaw drops, the nose goes out, and something in the sack
 * pushes out twice; the second time the fingers of a bony hand come out of the top and stay.
 */

type V3 = [number, number, number];

/** Seconds into the Take. */
const TAKE = { turn: 0.2, turnFor: 1.2, jaw: 1.4, jawFor: 0.4, nose: 1.8, noseFor: 0.6, push1: 2.6, push1End: 3.4, push2: 3.8, push2End: 4.6, hand: 4.15, handFor: 0.35 };
/** The body of the sleigh stands on its runners this high; the side panels are this far out. */
const BODY_Y = 0.06;
const PANEL_Z = 0.2;
const PANEL_D = 0.03;
/** The reindeer's head turns on its neck about this point. */
const HEAD_AT: V3 = [0.885, 0.59, 0];
/** The whole toy is turned so the reindeer comes a little toward you (3/4 view). */
const ROOT_RY = -0.35;

/** Materials of this toy (they age with the rest of the shop after the Reveal). */
const S = {
  lacquer: () =>
    mat('sleighLacquer', { surface: 'wood', color: '#a3121c', roughness: 0.28, clearcoat: 1, hauntedColor: '#4b1a18', matte: 0.8, decay: { burn: 0.14, age: 0.45, dust: 0.6 } }),
  velvet: () =>
    mat('sleighVelvet', { surface: 'fabric', color: '#1d5a38', roughness: 0.85, sheen: 1, sheenColor: '#8fd8a8', hauntedColor: '#262a20', decay: { dust: 0.5, tear: 0.12, age: 0.5 } }),
  burlap: () =>
    mat('sleighBurlap', { surface: 'fabric', color: '#8a6a44', roughness: 1, sheen: 0.2, sheenColor: '#c8a878', hauntedColor: '#5e5a53', side: THREE.DoubleSide, decay: { dust: 0.8, age: 0.8 } }),
  hide: () => mat('sleighHide', { surface: 'fur', color: '#7b4a28', roughness: 0.9, sheen: 0.7, sheenColor: '#e0a870', hauntedColor: '#3d2e24', decay: { dust: 0.5 } }),
  hideLight: () => mat('sleighHideLight', { surface: 'fur', color: '#d8b48a', roughness: 0.9, sheen: 0.6, sheenColor: '#fff0d8', hauntedColor: '#6d604e', decay: { dust: 0.5 } }),
  antler: () =>
    mat('sleighAntler', { surface: 'wood', color: '#d4b689', roughness: 0.55, clearcoat: 0.2, hauntedColor: '#17130f', matte: 1, decay: { burn: 0.25, age: 0.2, dust: 0.2 } }),
  harness: () =>
    mat('sleighHarness', { surface: 'leather', color: '#a8141e', roughness: 0.42, clearcoat: 0.5, hauntedColor: '#3f1515', matte: 1, decay: { age: 0.5, dust: 0.5 } }),
  bone: () => mat('sleighBone', { surface: 'ceramic', color: '#d8cba9', roughness: 0.72, hauntedColor: '#cdbd98', decay: { age: 0.2, dust: 0.35 } }),
  hoof: () => mat('sleighHoof', { color: '#2a1d16', roughness: 0.5, hauntedColor: '#1c1612', decay: { dust: 0.4 } }),
  giftGreen: () => mat('sleighGiftGreen', { surface: 'paper', color: '#1f5f38', roughness: 0.55, clearcoat: 0.3, hauntedColor: '#232a20', decay: { burn: 0.3, tear: 0.15 } }),
  giftCream: () => mat('sleighGiftCream', { surface: 'paper', color: '#efe3c8', roughness: 0.6, hauntedColor: '#7d725e', decay: { burn: 0.3, tear: 0.15 } }),
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (v: number, a: number, b: number) => {
  const k = clamp01((v - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const curve = (pts: V3[]) => new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal');

/* ------------------------------------------------------------------ the sleigh */

/** The top edge of a side panel, from the front foot, over the curl, the seat and the high back. */
const EDGE: [number, number][] = [
  [0.04, 0.0],
  [0.17, 0.03],
  [0.24, 0.12],
  [0.27, 0.24],
  [0.245, 0.335],
  [0.18, 0.37],
  [0.12, 0.34],
  [0.105, 0.285],
  [0.075, 0.225],
  [-0.05, 0.2],
  [-0.3, 0.2],
  [-0.48, 0.24],
  [-0.6, 0.34],
  [-0.68, 0.42],
  [-0.76, 0.435],
  [-0.805, 0.37],
  [-0.795, 0.2],
  [-0.765, 0.06],
  [-0.74, 0.0],
];

/** A side panel: the outline above, closed along a straight bottom, extruded with a bevel. */
function panelGeometry(): THREE.ExtrudeGeometry {
  const pts = curve(EDGE.map(([x, y]) => [x, y, 0])).getPoints(180);
  const shape = new THREE.Shape();
  shape.moveTo(pts[0]!.x, pts[0]!.y);
  for (const p of pts.slice(1)) shape.lineTo(p.x, p.y);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: PANEL_D, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 3, curveSegments: 1 });
}

/** The floor and inside of the sleigh, between the two panels. */
function tubGeometry(): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.moveTo(-0.76, 0);
  s.lineTo(0.06, 0);
  s.quadraticCurveTo(0.2, 0, 0.225, 0.16);
  s.lineTo(-0.79, 0.16);
  s.lineTo(-0.775, 0.06);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 2 * PANEL_Z - PANEL_D, bevelEnabled: false, curveSegments: 12 });
  g.translate(0, 0, -(PANEL_Z - PANEL_D / 2));
  return g;
}

/** A gold scroll painted in relief on the front curl: a spiral winding in. */
function scrollGeometry(side: number): THREE.TubeGeometry {
  const pts: V3[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const a = 1.2 + t * Math.PI * 3.2;
    const r = 0.065 * (1 - t) + 0.012;
    pts.push([0.18 + Math.cos(a) * r, 0.27 + Math.sin(a) * r, side * (PANEL_Z + PANEL_D / 2 + 0.008)]);
  }
  return new THREE.TubeGeometry(curve(pts), 120, 0.0065, 8, false);
}

/** The gold beading along the top of each panel. */
function trimGeometry(side: number): THREE.TubeGeometry {
  const z = side * (PANEL_Z + PANEL_D / 2 + 0.004);
  return new THREE.TubeGeometry(curve(EDGE.slice(1, 17).map(([x, y]) => [x, y, z])), 220, 0.008, 8, false);
}

/** A gold runner along the floor, curling up and over at the front, a little curl at the back. */
function runnerGeometry(side: number): THREE.TubeGeometry {
  const z = side * PANEL_Z;
  const pts: [number, number][] = [
    [-0.83, 0.07],
    [-0.81, 0.03],
    [-0.74, 0.012],
    [-0.4, 0.012],
    [0.1, 0.012],
    [0.26, 0.03],
    [0.37, 0.1],
    [0.41, 0.19],
    [0.385, 0.255],
    [0.33, 0.27],
    [0.3, 0.235],
    [0.315, 0.2],
    [0.345, 0.2],
  ];
  return new THREE.TubeGeometry(curve(pts.map(([x, y]) => [x, y, z])), 220, 0.013, 10, false);
}

/** The painted decoration on the side panels: gold scrolls, dots and a sprig of holly; chipped after the Reveal. */
function drawPaint(g: CanvasRenderingContext2D, w: number, h: number, haunted: boolean) {
  g.clearRect(0, 0, w, h);
  const gold = haunted ? '#8c7746' : '#e6bd5c';
  g.lineCap = 'round';
  for (const s of [-1, 1]) {
    g.save();
    g.translate(w / 2, h / 2);
    g.scale(s, 1);
    g.strokeStyle = gold;
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(40, 10);
    g.bezierCurveTo(90, -45, 150, 40, 200, -5);
    g.bezierCurveTo(225, -28, 250, -10, 238, 10);
    g.bezierCurveTo(228, 26, 205, 14, 214, 0);
    g.stroke();
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(70, 22);
    g.bezierCurveTo(110, 50, 150, 30, 168, 40);
    g.stroke();
    g.fillStyle = gold;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.arc(80 + i * 30, 58, 4, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
  // the holly in the middle: three leaves and three berries
  const leaf = (x: number, y: number, a: number) => {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.fillStyle = haunted ? '#3a3a2a' : '#2f6a2c';
    g.beginPath();
    g.moveTo(0, 0);
    for (let i = 1; i <= 4; i++) g.quadraticCurveTo(i * 11 - 6, -14, i * 11, -7);
    g.lineTo(46, 0);
    for (let i = 4; i >= 1; i--) g.quadraticCurveTo(i * 11 - 6, 14, (i - 1) * 11, 7 * (i > 1 ? 1 : 0));
    g.fill();
    g.strokeStyle = haunted ? '#55553c' : '#5f9a4a';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(2, 0);
    g.lineTo(42, 0);
    g.stroke();
    g.restore();
  };
  leaf(w / 2, h / 2, -2.4);
  leaf(w / 2, h / 2, -0.7);
  leaf(w / 2, h / 2, 1.57);
  g.fillStyle = haunted ? '#4a1a16' : '#c8141c';
  for (const [x, y] of [
    [-6, -4],
    [6, -6],
    [0, 6],
  ] as const) {
    g.beginPath();
    g.arc(w / 2 + x, h / 2 + y, 7, 0, Math.PI * 2);
    g.fill();
  }
  if (haunted) {
    // chipped off in flakes
    const r = seeded(23);
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 40; i++) {
      g.beginPath();
      g.ellipse(r() * w, r() * h, 3 + r() * 14, 2 + r() * 6, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }
}

/** The sleigh body: panels with trim, scrolls and paint, the tub, the dash and the back board. */
function SleighBody({ haunted }: { haunted: boolean }) {
  const g = useMemo(
    () => ({
      panel: panelGeometry(),
      tub: tubGeometry(),
      scrolls: [scrollGeometry(-1), scrollGeometry(1)],
      trims: [trimGeometry(-1), trimGeometry(1)],
    }),
    [],
  );
  useEffect(() => () => [g.panel, g.tub, ...g.scrolls, ...g.trims].forEach((x) => x.dispose()), [g]);
  const paint = useCanvasTexture(512, 160, (c, w, h) => drawPaint(c, w, h, haunted), [haunted]);
  return (
    <group position-y={BODY_Y}>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={g.panel} material={S.lacquer()} position-z={s * PANEL_Z - PANEL_D / 2} />
          <mesh position={[-0.33, 0.1, s * (PANEL_Z + PANEL_D / 2 + 0.0065)]} rotation-y={s < 0 ? Math.PI : 0}>
            <planeGeometry args={[0.48, 0.15]} />
            <meshStandardMaterial map={paint} alphaTest={0.4} metalness={0.5} roughness={0.4} polygonOffset polygonOffsetFactor={-2} />
          </mesh>
        </group>
      ))}
      {g.scrolls.map((x, i) => (
        <mesh key={`s${i}`} geometry={x} material={M.gilt()} />
      ))}
      {g.trims.map((x, i) => (
        <mesh key={`t${i}`} geometry={x} material={M.gilt()} />
      ))}
      <mesh geometry={g.tub} material={S.lacquer()} />
      {/* the dash, leaning forward, with a gold rail along its top */}
      <group position={[0.215, 0.16, 0]} rotation-z={-0.3}>
        <mesh material={S.lacquer()} position-y={0.075}>
          <boxGeometry args={[0.024, 0.15, 2 * PANEL_Z - PANEL_D]} />
        </mesh>
        <mesh material={M.gilt()} position-y={0.152} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.008, 0.008, 2 * PANEL_Z, 12]} />
        </mesh>
      </group>
      {/* the back board behind the sack */}
      <mesh material={S.lacquer()} position={[-0.765, 0.285, 0]} rotation-z={0.12}>
        <boxGeometry args={[0.024, 0.25, 2 * PANEL_Z - PANEL_D]} />
      </mesh>
      {/* the green velvet seat, buttoned */}
      <RoundedBox args={[0.27, 0.065, 0.36]} radius={0.022} smoothness={4} material={S.velvet()} position={[-0.13, 0.192, 0]} />
      {[-0.1, 0, 0.1].map((z) => (
        <mesh key={z} material={M.gilt()} position={[-0.13, 0.226, z]}>
          <sphereGeometry args={[0.007, 10, 8]} />
        </mesh>
      ))}
    </group>
  );
}

/** Both runners, with the struts that carry the body. */
function Runners() {
  const g = useMemo(() => [runnerGeometry(-1), runnerGeometry(1)], []);
  useEffect(() => () => g.forEach((x) => x.dispose()), [g]);
  return (
    <group>
      {g.map((x, i) => (
        <mesh key={i} geometry={x} material={M.gilt()} />
      ))}
      {[-1, 1].map((s) =>
        [-0.62, -0.25, 0.08].map((x) => (
          <mesh key={`${s}${x}`} material={M.gilt()} position={[x, (0.012 + BODY_Y + 0.01) / 2, s * PANEL_Z]}>
            <cylinderGeometry args={[0.009, 0.009, BODY_Y, 10]} />
          </mesh>
        )),
      )}
      {[-1, 1].map((s) => (
        <group key={`e${s}`}>
          <mesh material={M.gilt()} position={[-0.83, 0.07, s * PANEL_Z]}>
            <sphereGeometry args={[0.014, 12, 10]} />
          </mesh>
          <mesh material={M.gilt()} position={[0.345, 0.2, s * PANEL_Z]}>
            <sphereGeometry args={[0.014, 12, 10]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ the sack */

/** The sack's outline from the bottom up: full and round, gathered at the neck, the mouth flared open. */
const SACK: [number, number][] = [
  [0.0, 0.0],
  [0.08, 0.0],
  [0.13, 0.012],
  [0.16, 0.035],
  [0.178, 0.07],
  [0.186, 0.11],
  [0.184, 0.15],
  [0.175, 0.19],
  [0.155, 0.23],
  [0.125, 0.265],
  [0.095, 0.29],
  [0.082, 0.3],
  [0.084, 0.31],
  [0.098, 0.322],
  [0.118, 0.334],
  [0.132, 0.346],
  [0.136, 0.352],
  [0.128, 0.354],
  [0.11, 0.345],
  [0.09, 0.33],
];
/** Radius of the outside of the sack at height `y` (up to the neck). */
function sackR(y: number): number {
  for (let i = 1; i <= 11; i++) {
    const [r1, y1] = SACK[i]!;
    const [r0, y0] = SACK[i - 1]!;
    if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
  }
  return SACK[11]![0];
}
/** Round the sack, the side that faces you (the toy is turned by ROOT_RY). */
const FACING = -ROOT_RY;
const onSack = (y: number, a: number) => new THREE.Vector3(Math.sin(a) * sackR(y), y, Math.cos(a) * sackR(y));
/** Where it is pushed from inside: a palm and four fingertips, then, the second time, up at the neck. */
const PALM = onSack(0.15, FACING);
const TIPS = [-0.3, -0.1, 0.1, 0.3].map((da) => onSack(0.205, FACING + da));
const NECK_PUSH = onSack(0.27, FACING + 0.1);

interface SackGeo {
  geo: THREE.LatheGeometry;
  base: Float32Array;
  normal: Float32Array;
}

/** The sack, lumpy with the gifts inside and pleated where the cord gathers it. */
function makeSack(): SackGeo {
  const geo = new THREE.LatheGeometry(
    SACK.map(([r, y]) => new THREE.Vector2(r, y)),
    56,
  );
  const p = geo.attributes.position as THREE.BufferAttribute;
  const rnd = seeded(5);
  const lumps = Array.from({ length: 9 }, () => ({ a: rnd() * Math.PI * 2, y: 0.04 + rnd() * 0.2, amp: 0.008 + rnd() * 0.01 }));
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-5) continue;
    const phi = Math.atan2(x, z);
    let out = r * (1 + 0.1 * Math.sin(14 * phi + y * 30) * ease(y, 0.24, 0.3));
    for (const l of lumps) {
      const da = Math.atan2(Math.sin(phi - l.a), Math.cos(phi - l.a)) * r;
      const dy = y - l.y;
      out += l.amp * Math.exp(-(da * da + dy * dy) / 0.0025);
    }
    p.setXYZ(i, (x / r) * out, y, (z / r) * out);
  }
  geo.computeVertexNormals();
  return { geo, base: Float32Array.from(p.array as Float32Array), normal: Float32Array.from((geo.attributes.normal as THREE.BufferAttribute).array as Float32Array) };
}

const near = (x: number, y: number, z: number, c: THREE.Vector3, s2: number) => Math.exp(-((x - c.x) ** 2 + (y - c.y) ** 2 + (z - c.z) ** 2) / s2);

/** Pushes the sack out from inside: `a1` the hand against its side, `a2` up at the neck (outside the component). */
function bulgeSack(sg: SackGeo, a1: number, a2: number) {
  const u = sg.geo.userData as { a1?: number; a2?: number };
  if (u.a1 === a1 && u.a2 === a2) return;
  u.a1 = a1;
  u.a2 = a2;
  const p = sg.geo.attributes.position as THREE.BufferAttribute;
  const b = sg.base;
  const n = sg.normal;
  for (let i = 0; i < p.count; i++) {
    const x = b[i * 3]!;
    const y = b[i * 3 + 1]!;
    const z = b[i * 3 + 2]!;
    let k = 0;
    if (a1 > 0) {
      k += a1 * 0.05 * near(x, y, z, PALM, 0.003);
      for (const t of TIPS) k += a1 * 0.026 * near(x, y, z, t, 0.0004);
    }
    if (a2 > 0) k += a2 * 0.045 * near(x, y, z, NECK_PUSH, 0.0025);
    p.setXYZ(i, x + n[i * 3]! * k, y + n[i * 3 + 1]! * k, z + n[i * 3 + 2]! * k);
  }
  p.needsUpdate = true;
  sg.geo.computeVertexNormals();
}

/** The first push: up, held and straining, let go. */
function push1(s: number): number {
  if (s === Infinity || s < TAKE.push1 || s > TAKE.push1End) return 0;
  return Math.pow(Math.sin((Math.PI * (s - TAKE.push1)) / (TAKE.push1End - TAKE.push1)), 0.6);
}
/** The second push, at the neck; once the hand is through, the cloth stays a little stretched. */
function push2(s: number): number {
  if (s === Infinity) return 0.35;
  if (s < TAKE.push2) return 0;
  if (s < TAKE.hand) return ease(s, TAKE.push2, TAKE.hand);
  return 1 - 0.65 * ease(s, TAKE.hand, TAKE.push2End);
}

/** One wrapped gift: rounded box, a ribbon both ways, a little bow on top. */
function Gift({ size, paper, ribbon, position, rotation }: { size: V3; paper: THREE.Material; ribbon: THREE.Material; position: V3; rotation: V3 }) {
  const [w, h, d] = size;
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[w, h, d]} radius={0.006} smoothness={3} material={paper} />
      <mesh material={ribbon}>
        <boxGeometry args={[w * 1.03, h * 1.03, 0.012]} />
      </mesh>
      <mesh material={ribbon}>
        <boxGeometry args={[0.012, h * 1.03, d * 1.03]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={ribbon} position={[s * 0.01, h / 2 + 0.008, 0]} rotation={[0, s * 0.4, s * 0.6]} scale={[1, 0.7, 0.5]}>
          <torusGeometry args={[0.011, 0.0035, 8, 16]} />
        </mesh>
      ))}
    </group>
  );
}

/** A finger: a joint, a bone, and the rest of the finger beyond it, each joint curled a bit more. */
function Finger({ lens, curl, r }: { lens: number[]; curl: number; r: number }) {
  const [len, ...rest] = lens;
  if (len === undefined) return null;
  return (
    <group rotation-x={curl}>
      <mesh material={S.bone()} scale={[1, 1, 0.85]}>
        <sphereGeometry args={[r * 1.3, 10, 8]} />
      </mesh>
      <mesh material={S.bone()} position-y={len / 2}>
        <capsuleGeometry args={[r, len - r * 2, 4, 8]} />
      </mesh>
      <group position-y={len}>
        <Finger lens={rest} curl={curl * 1.2} r={r * 0.85} />
      </group>
    </group>
  );
}

/** [x, splay, the bones' lengths] of each finger, little finger to index; the thumb is apart. */
const FINGERS: [number, number, number[]][] = [
  [-0.021, 0.16, [0.025, 0.017, 0.012]],
  [-0.007, 0.05, [0.031, 0.021, 0.015]],
  [0.007, -0.05, [0.032, 0.022, 0.016]],
  [0.021, -0.15, [0.028, 0.02, 0.014]],
];

/** The bony hand that comes up out of the sack, fingers hooked over its mouth toward you. */
function BoneHand() {
  return (
    <group>
      {FINGERS.map(([x, splay, lens]) => (
        <group key={x} position-x={x} rotation-z={splay}>
          {/* the long bones of the hand, down inside the sack */}
          <mesh material={S.bone()} position-y={-0.025}>
            <capsuleGeometry args={[0.005, 0.04, 4, 8]} />
          </mesh>
          <Finger lens={lens} curl={0.32} r={0.0055} />
        </group>
      ))}
      <group position={[0.032, -0.022, 0.004]} rotation-z={-0.7}>
        <Finger lens={[0.024, 0.017]} curl={0.25} r={0.006} />
      </group>
    </group>
  );
}

/**
 * The sack of gifts. Taken: something inside pushes its side out against you, strains and lets
 * go; then pushes up at the neck, jostling the gifts, and the fingers of a bony hand come up out
 * of the top and stay there, hooked over the edge.
 */
function Sack({ taken, since }: { taken: boolean; since: () => number }) {
  const sg = useMemo(() => makeSack(), []);
  useEffect(() => () => sg.geo.dispose(), [sg]);
  const group = useRef<THREE.Group>(null);
  const gifts = useRef<THREE.Group>(null);
  const hand = useRef<THREE.Group>(null);
  useFrame(() => {
    const s = taken ? since() : -1;
    const a1 = taken ? push1(s) : 0;
    const a2 = taken ? push2(s) : 0;
    bulgeSack(sg, a1, a2);
    // the sack shudders while it is pushed
    const strain = a1 + (s >= TAKE.push2 && s <= TAKE.push2End ? a2 : 0);
    const shake = s === Infinity ? 0 : Math.sin(s * 36) * 0.016 * strain;
    const g = group.current;
    if (g) g.rotation.set(shake * 0.6, 0, 0.12 + shake);
    const settle = taken ? progress(s, 0.4, TAKE.push2 + 0.1) : 0;
    const gi = gifts.current;
    if (gi) {
      gi.rotation.set(-0.05 * settle, 0, 0.08 * settle);
      gi.position.x = -0.012 * settle;
    }
    const h = hand.current;
    if (h) {
      const up = taken ? progress(s, TAKE.handFor, TAKE.hand) : 0;
      h.visible = taken && (s === Infinity || s >= TAKE.hand);
      h.position.y = 0.26 + 0.09 * up;
    }
  });
  return (
    <group position={[-0.5, BODY_Y + 0.16, 0]}>
      <group ref={group} rotation-z={0.12}>
        <mesh geometry={sg.geo} material={S.burlap()} scale={[1, 1, 0.92]} />
        {/* dark inside the mouth */}
        <mesh position-y={0.318} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.09, 24]} />
          <meshStandardMaterial color="#1a120c" roughness={1} />
        </mesh>
        {/* the cord that ties it */}
        <mesh material={M.ribbon()} position-y={0.3} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.086, 0.007, 8, 40]} />
        </mesh>
        <group ref={gifts}>
          <Gift size={[0.085, 0.075, 0.07]} paper={M.giftPaper()} ribbon={M.ribbon()} position={[-0.03, 0.35, -0.045]} rotation={[0.2, 0.5, -0.25]} />
          <Gift size={[0.07, 0.09, 0.065]} paper={S.giftGreen()} ribbon={M.ribbon()} position={[0.045, 0.36, -0.025]} rotation={[-0.15, -0.3, 0.3]} />
          <Gift size={[0.06, 0.06, 0.06]} paper={S.giftCream()} ribbon={M.velvetRed()} position={[-0.055, 0.34, 0.035]} rotation={[0.1, 0.9, 0.35]} />
        </group>
        <group ref={hand} position={[0.014, 0.26, 0.03]} rotation={[-0.1, FACING, 0]} visible={false}>
          {taken && <BoneHand />}
        </group>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ the reindeer */

/** One leg, hip or shoulder to hoof: front legs nearly straight, hind legs with the hock behind. */
function legCurve(front: boolean, side: number): THREE.CatmullRomCurve3 {
  const z = side * 0.045;
  return front
    ? curve([
        [0.79, 0.35, z],
        [0.8, 0.19, z],
        [0.79, 0.1, z],
        [0.8, 0.028, z],
      ])
    : curve([
        [0.53, 0.36, z],
        [0.5, 0.24, z],
        [0.535, 0.13, z],
        [0.53, 0.028, z],
      ]);
}
const LEGS: [boolean, number][] = [
  [true, -1],
  [true, 1],
  [false, -1],
  [false, 1],
];

const BODY_LINE: V3[] = [
  [0.465, 0.375, 0],
  [0.58, 0.365, 0],
  [0.7, 0.37, 0],
  [0.8, 0.385, 0],
  [0.85, 0.405, 0],
];
const NECK_LINE: V3[] = [
  [0.79, 0.4, 0],
  [0.835, 0.49, 0],
  [0.885, 0.59, 0],
];

/** The hooves, the same in both states. */
function Hooves() {
  return (
    <>
      {LEGS.map(([front, s]) => (
        <mesh key={`${front}${s}`} material={S.hoof()} position={[front ? 0.8 : 0.53, 0.014, s * 0.045]}>
          <cylinderGeometry args={[0.016, 0.019, 0.028, 14]} />
        </mesh>
      ))}
    </>
  );
}

/** By day: a carved, painted deer. Round brown body, pale chest, slim legs, a white tail. */
function DayDeer() {
  const g = useMemo(
    () => ({
      body: sweep(curve(BODY_LINE), (t) => 0.09 * Math.pow(Math.sin(Math.PI * t), 0.4) * (0.92 + 0.1 * t), 48, 24),
      neck: sweep(curve(NECK_LINE), (t) => 0.05 - 0.016 * t, 24, 18),
      legs: LEGS.map(([front, s]) => sweep(legCurve(front, s), (t) => 0.022 * (1 - t) + 0.01, 32, 12)),
    }),
    [],
  );
  useEffect(() => () => [g.body, g.neck, ...g.legs].forEach((x) => x.dispose()), [g]);
  return (
    <group>
      <mesh geometry={g.body} material={S.hide()} />
      <mesh geometry={g.neck} material={S.hide()} />
      {g.legs.map((x, i) => (
        <mesh key={i} geometry={x} material={S.hide()} />
      ))}
      {/* the pale chest and the white tail */}
      <mesh material={S.hideLight()} position={[0.845, 0.37, 0]} scale={[0.6, 1, 0.9]}>
        <sphereGeometry args={[0.05, 20, 14]} />
      </mesh>
      <mesh material={M.dollFur()} position={[0.46, 0.405, 0]} scale={[0.8, 1.1, 0.9]}>
        <sphereGeometry args={[0.024, 14, 10]} />
      </mesh>
      <Hooves />
    </group>
  );
}

/** Ragged scraps of hide, matted fur, holes worn through; the rest is transparent (alpha-tested). */
function drawHide(g: CanvasRenderingContext2D, w: number, h: number) {
  g.clearRect(0, 0, w, h);
  const r = seeded(41);
  g.fillStyle = '#4e3a2a';
  g.beginPath();
  const n = 26;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rad = 0.36 + r() * 0.14 - (i % 3 === 0 ? r() * 0.12 : 0);
    const x = w / 2 + Math.cos(a) * rad * w;
    const y = h / 2 + Math.sin(a) * rad * h;
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.fill();
  // matted fur
  for (let i = 0; i < 260; i++) {
    g.strokeStyle = r() < 0.5 ? 'rgba(30,22,16,0.6)' : 'rgba(110,88,66,0.5)';
    g.lineWidth = 1;
    const x = w * (0.2 + r() * 0.6);
    const y = h * (0.2 + r() * 0.6);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 6, y + 4 + r() * 5);
    g.stroke();
  }
  // worn through
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 7; i++) {
    g.beginPath();
    g.ellipse(w * (0.25 + r() * 0.5), h * (0.25 + r() * 0.5), 3 + r() * 9, 2 + r() * 6, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.globalCompositeOperation = 'source-over';
}

/** The ribs: [x along the body, how deep]. Deepest just behind the shoulders. */
const RIBS = Array.from({ length: 9 }, (_, i) => [0.6 + i * 0.0275, 0.78 + 0.28 * Math.sin(Math.PI * (0.25 + (0.6 * i) / 8))] as const);

/** After the Reveal: the deer is bone. Spine, ribs, sternum, hips, shoulder blades, bare legs, scraps of hide. */
function BoneDeer() {
  const hideTex = useCanvasTexture(128, 128, drawHide, []);
  const g = useMemo(() => {
    const ribs: THREE.BufferGeometry[] = [];
    for (const [x, size] of RIBS) {
      for (const s of [-1, 1]) {
        const pts: V3[] = [];
        for (let k = 0; k <= 10; k++) {
          const th = 0.12 + (k / 10) * 2.63;
          pts.push([x - 0.03 * (th / 2.75), 0.37 + 0.072 * size * Math.cos(th), s * 0.08 * size * Math.sin(th)]);
        }
        ribs.push(sweep(curve(pts), (t) => 0.0065 - 0.0025 * t, 28, 8));
      }
    }
    return {
      ribs,
      spine: sweep(
        curve([
          [0.45, 0.43, 0],
          [0.58, 0.445, 0],
          [0.7, 0.448, 0],
          [0.8, 0.44, 0],
          [0.84, 0.45, 0],
        ]),
        () => 0.011,
        40,
        10,
      ),
      sternum: sweep(
        curve([
          [0.66, 0.305, 0],
          [0.76, 0.3, 0],
          [0.84, 0.32, 0],
        ]),
        (t) => 0.008 - 0.003 * t,
        20,
        8,
      ),
      neck: sweep(curve(NECK_LINE), () => 0.009, 24, 8),
      legs: LEGS.map(([front, s]) => sweep(legCurve(front, s), (t) => 0.009 + 0.004 * (1 - t), 32, 8)),
    };
  }, []);
  useEffect(() => () => [...g.ribs, g.spine, g.sternum, g.neck, ...g.legs].forEach((x) => x.dispose()), [g]);
  const neckCurve = useMemo(() => curve(NECK_LINE), []);
  const scrap = <meshStandardMaterial map={hideTex} alphaTest={0.5} side={THREE.DoubleSide} roughness={1} />;
  return (
    <group>
      <mesh geometry={g.spine} material={S.bone()} />
      {/* the knobs of the vertebrae along the back */}
      {Array.from({ length: 11 }, (_, i) => 0.47 + i * 0.035).map((x) => (
        <mesh key={x} material={S.bone()} position={[x, 0.447 + 0.004 * Math.sin(x * 20), 0]} scale={[0.6, 1, 0.8]}>
          <sphereGeometry args={[0.014, 10, 8]} />
        </mesh>
      ))}
      {g.ribs.map((x, i) => (
        <mesh key={i} geometry={x} material={S.bone()} />
      ))}
      <mesh geometry={g.sternum} material={S.bone()} />
      {/* hips and the shoulder blades */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh material={S.bone()} position={[0.5, 0.41, s * 0.04]} rotation={[0, s * 0.3, -0.35]} scale={[0.05, 0.03, 0.02]}>
            <sphereGeometry args={[1, 16, 12]} />
          </mesh>
          <mesh material={S.bone()} position={[0.785, 0.405, s * 0.078]} rotation={[s * 0.15, 0, -0.3]} scale={[0.035, 0.05, 0.006]}>
            <sphereGeometry args={[1, 16, 12]} />
          </mesh>
        </group>
      ))}
      <mesh material={S.bone()} position={[0.48, 0.43, 0]} scale={[0.04, 0.015, 0.02]}>
        <sphereGeometry args={[1, 14, 10]} />
      </mesh>
      {/* the neck: a thin cord of bone and its vertebrae */}
      <mesh geometry={g.neck} material={S.bone()} />
      {[0.1, 0.28, 0.46, 0.64, 0.82].map((t) => {
        const p = neckCurve.getPoint(t);
        return (
          <mesh key={t} material={S.bone()} position={p} scale={[1, 0.75, 1]}>
            <sphereGeometry args={[0.017 - t * 0.004, 12, 10]} />
          </mesh>
        );
      })}
      {/* bare leg bones, knobbed at the joints */}
      {g.legs.map((x, i) => (
        <mesh key={i} geometry={x} material={S.bone()} />
      ))}
      {LEGS.map(([front, s]) =>
        legCurve(front, s)
          .points.slice(0, 3)
          .map((p, k) => (
            <mesh key={`${front}${s}${k}`} material={S.bone()} position={p}>
              <sphereGeometry args={[k === 0 ? 0.019 : 0.014, 12, 10]} />
            </mesh>
          )),
      )}
      <Hooves />
      {/* what is left of the hide: over the shoulders, and hanging off the rump */}
      <mesh position={[0.77, 0.385, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.093, 0.093, 0.12, 24, 1, true, 0.25, 2.0]} />
        {scrap}
      </mesh>
      <mesh position={[0.52, 0.385, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.08, 0.086, 0.09, 24, 1, true, 0.0, 1.6]} />
        {scrap}
      </mesh>
    </group>
  );
}

/** The antlers: a main beam each side, sweeping up and back, with tines; carved by day, blackened after. */
function Antlers() {
  const g = useMemo(() => {
    const out: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      const beams: [V3[], number][] = [
        [
          [
            [0, 0, 0],
            [-0.012, 0.035, s * 0.018],
            [-0.03, 0.075, s * 0.04],
            [-0.03, 0.115, s * 0.058],
            [-0.012, 0.15, s * 0.068],
            [0.012, 0.17, s * 0.07],
          ],
          0.0085,
        ],
        [
          [
            [-0.004, 0.012, s * 0.006],
            [0.025, 0.02, s * 0.012],
            [0.04, 0.035, s * 0.012],
          ],
          0.005,
        ],
        [
          [
            [-0.016, 0.045, s * 0.022],
            [0.01, 0.062, s * 0.03],
            [0.03, 0.085, s * 0.03],
          ],
          0.0055,
        ],
        [
          [
            [-0.03, 0.09, s * 0.046],
            [-0.005, 0.11, s * 0.055],
            [0.01, 0.13, s * 0.06],
          ],
          0.005,
        ],
        [
          [
            [-0.028, 0.12, s * 0.06],
            [-0.055, 0.14, s * 0.075],
            [-0.07, 0.165, s * 0.08],
          ],
          0.005,
        ],
      ];
      for (const [pts, r] of beams) out.push(sweep(curve(pts.map(([x, y, z]) => [x - 0.004, y + 0.048, z + s * 0.024])), (t) => r * (1 - 0.62 * t), 24, 8));
    }
    return out;
  }, []);
  useEffect(() => () => g.forEach((x) => x.dispose()), [g]);
  return (
    <>
      {g.map((x, i) => (
        <mesh key={i} geometry={x} material={S.antler()} />
      ))}
    </>
  );
}

/** The head by day: a round carved head, a muzzle, shiny black eyes, ears. Faces +x. */
function DayHead() {
  const muzzle = useMemo(
    () =>
      sweep(
        curve([
          [0.035, 0.0, 0],
          [0.085, -0.015, 0],
          [0.125, -0.03, 0],
        ]),
        (t) => 0.037 - 0.012 * t,
        24,
        18,
      ),
    [],
  );
  useEffect(() => () => muzzle.dispose(), [muzzle]);
  return (
    <group>
      <mesh material={S.hide()} position={[0.025, 0.01, 0]} scale={[1.15, 0.92, 0.88]}>
        <sphereGeometry args={[0.05, 24, 18]} />
      </mesh>
      <mesh geometry={muzzle} material={S.hide()} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh material={M.bakelite()} position={[0.055, 0.022, s * 0.036]}>
            <sphereGeometry args={[0.0085, 12, 10]} />
          </mesh>
          <mesh material={M.enamel()} position={[0.06, 0.026, s * 0.043]}>
            <sphereGeometry args={[0.0022, 6, 6]} />
          </mesh>
          <mesh material={S.hide()} position={[0.0, 0.04, s * 0.048]} rotation={[s * 0.75, 0, 0.3]} scale={[0.012, 0.028, 0.006]}>
            <sphereGeometry args={[1, 12, 10]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** After the Reveal: a deer's skull. Long snout, nasal slit, black sockets in rims of bone, a loose jaw. */
function SkullHead({ jaw, scrap }: { jaw: Ref<THREE.Group>; scrap: THREE.Texture }) {
  const g = useMemo(() => {
    const jawSide = (s: number) =>
      sweep(
        curve([
          [-0.004, 0.024, s * 0.028],
          [0.0, 0.0, s * 0.024],
          [0.06, -0.012, s * 0.016],
          [0.128, -0.016, s * 0.006],
        ]),
        (t) => 0.008 - 0.003 * t,
        28,
        8,
      );
    return {
      snout: sweep(
        curve([
          [0.03, 0.0, 0],
          [0.09, -0.016, 0],
          [0.138, -0.028, 0],
        ]),
        (t) => 0.028 - 0.016 * t,
        28,
        14,
      ),
      jaws: [jawSide(-1), jawSide(1)],
    };
  }, []);
  useEffect(() => () => [g.snout, ...g.jaws].forEach((x) => x.dispose()), [g]);
  return (
    <group>
      <mesh material={S.bone()} position={[0.015, 0.012, 0]} scale={[1.1, 0.85, 0.82]}>
        <sphereGeometry args={[0.045, 24, 18]} />
      </mesh>
      <mesh geometry={g.snout} material={S.bone()} scale={[1, 1, 0.85]} />
      {/* the nasal opening along the top of the snout */}
      <mesh position={[0.1, -0.003, 0]} scale={[0.03, 0.006, 0.0085]}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshBasicMaterial color="#050303" />
      </mesh>
      {/* the sockets, black and hollow, in rims of bone */}
      {[-1, 1].map((s) => (
        <group key={s} position={[0.045, 0.024, s * 0.027]} rotation-y={s > 0 ? 0.5 : Math.PI - 0.5}>
          <mesh material={S.bone()}>
            <torusGeometry args={[0.016, 0.0045, 8, 20]} />
          </mesh>
          <mesh scale={[1, 1, 0.45]}>
            <sphereGeometry args={[0.015, 14, 10]} />
            <meshBasicMaterial color="#020101" />
          </mesh>
        </group>
      ))}
      {/* upper teeth, seen when the jaw drops */}
      {[0.066, 0.08, 0.094, 0.108, 0.122].map((x) =>
        [-1, 1].map((s) => (
          <mesh key={`${x}${s}`} material={S.bone()} position={[x, -0.036 + (x - 0.066) * 0.15, s * (0.011 - (x - 0.066) * 0.06)]}>
            <boxGeometry args={[0.009, 0.008, 0.005]} />
          </mesh>
        )),
      )}
      {/* what is left of one ear */}
      <mesh position={[0.0, 0.042, 0.046]} rotation={[0.75, 0, 0.3]}>
        <planeGeometry args={[0.03, 0.05]} />
        <meshStandardMaterial map={scrap} alphaTest={0.5} side={THREE.DoubleSide} roughness={1} />
      </mesh>
      {/* the lower jaw, hinged at the back of the skull */}
      <group ref={jaw} position={[0.005, -0.022, 0]}>
        {g.jaws.map((x, i) => (
          <mesh key={i} geometry={x} material={S.bone()} />
        ))}
        <mesh material={S.bone()} position={[0.13, -0.016, 0]}>
          <sphereGeometry args={[0.0075, 10, 8]} />
        </mesh>
        {[0.07, 0.085, 0.1, 0.115].map((x) =>
          [-1, 1].map((s) => (
            <mesh key={`${x}${s}`} material={S.bone()} position={[x, -0.007, s * (0.012 - (x - 0.07) * 0.08)]}>
              <boxGeometry args={[0.008, 0.008, 0.005]} />
            </mesh>
          )),
        )}
      </group>
    </group>
  );
}

/** The red nose: bright and glowing by day; after the Reveal a dim dark red; taken, it goes out. */
function setNose(m: THREE.MeshStandardMaterial, haunted: boolean, k: number) {
  if (!haunted) {
    m.color.set('#e3241c');
    m.emissive.set('#ff2a18');
    m.emissiveIntensity = 1.6;
    return;
  }
  m.color.setRGB(0.33 - 0.23 * k, 0.05 - 0.025 * k, 0.05 - 0.03 * k);
  m.emissive.set('#a01008');
  m.emissiveIntensity = 0.45 * (1 - k);
}

function Nose({ haunted, taken, since, at, r }: { haunted: boolean; taken: boolean; since: () => number; at: V3; r: number }) {
  const m = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (m.current) setNose(m.current, haunted, taken ? progress(since(), TAKE.noseFor, TAKE.nose) : 0);
  });
  return (
    <group position={at}>
      <mesh>
        <sphereGeometry args={[r, 20, 14]} />
        <meshStandardMaterial ref={m} color="#e3241c" emissive="#ff2a18" emissiveIntensity={1.6} roughness={0.3} />
      </mesh>
      {/* a soft red glow on the snow in front of it (small: it sits right against the muzzle) */}
      {!haunted && <pointLight color="#ff3020" intensity={0.06} distance={0.6} decay={2} position-x={0.06} />}
    </group>
  );
}

/** A little gold sleigh bell. */
function Bell({ at }: { at: V3 }) {
  return (
    <group position={at}>
      <mesh material={M.brass()}>
        <sphereGeometry args={[0.011, 14, 10]} />
      </mesh>
      <mesh position-y={-0.004}>
        <boxGeometry args={[0.016, 0.0025, 0.004]} />
        <meshBasicMaterial color="#1a120a" />
      </mesh>
      <mesh material={M.brass()} position-y={0.012}>
        <torusGeometry args={[0.003, 0.0012, 6, 10]} />
      </mesh>
    </group>
  );
}

/** The red harness: a band round the chest with bells, a belly band, a strap along the back, the collar with bells. */
function Harness() {
  const bells: V3[] = [];
  for (const s of [-1, 1]) for (const a of [1.6, 2.0, 2.4]) bells.push([0.76, 0.38 + 0.089 * Math.cos(a), s * 0.089 * Math.sin(a)]);
  return (
    <group>
      <mesh material={S.harness()} position={[0.76, 0.38, 0]} rotation-y={Math.PI / 2}>
        <torusGeometry args={[0.08, 0.008, 8, 40]} />
      </mesh>
      <mesh material={S.harness()} position={[0.6, 0.367, 0]} rotation-y={Math.PI / 2}>
        <torusGeometry args={[0.084, 0.008, 8, 40]} />
      </mesh>
      <mesh material={S.harness()} position={[0.68, 0.455, 0]}>
        <boxGeometry args={[0.16, 0.008, 0.03]} />
      </mesh>
      {bells.map((b, i) => (
        <Bell key={i} at={b} />
      ))}
      {/* the collar round the neck, tilted along it, three bells at its front */}
      <group position={[0.833, 0.49, 0]} rotation-z={-0.464}>
        <mesh material={S.harness()} rotation-x={-Math.PI / 2}>
          <torusGeometry args={[0.05, 0.011, 8, 32]} />
        </mesh>
        {[-0.5, 0, 0.5].map((a) => (
          <Bell key={a} at={[0.058 * Math.cos(a), -0.012, 0.058 * Math.sin(a)]} />
        ))}
      </group>
    </group>
  );
}

/** A straight rod between two points (the shafts). */
function Rod({ from, to, r }: { from: V3; to: V3; r: number }) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const len = a.distanceTo(b);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return (
    <group position={a.clone().add(b).multiplyScalar(0.5)} quaternion={q}>
      <mesh material={S.lacquer()}>
        <cylinderGeometry args={[r, r, len, 10]} />
      </mesh>
      <mesh material={M.gilt()} position-y={len / 2}>
        <sphereGeometry args={[r * 1.5, 10, 8]} />
      </mesh>
    </group>
  );
}

/** The two shafts from the sleigh to the belly band, and the reins from the collar back to the dash. */
function Tack() {
  const reins = useMemo(
    () =>
      [-1, 1].map(
        (s) =>
          new THREE.TubeGeometry(
            curve([
              [0.83, 0.49, s * 0.05],
              [0.55, 0.44, s * 0.08],
              [0.265, 0.375, s * 0.12],
            ]),
            40,
            0.0035,
            6,
            false,
          ),
      ),
    [],
  );
  useEffect(() => () => reins.forEach((x) => x.dispose()), [reins]);
  return (
    <group>
      {[-1, 1].map((s) => (
        <Rod key={s} from={[0.24, 0.12, s * 0.17]} to={[0.6, 0.35, s * 0.088]} r={0.008} />
      ))}
      {reins.map((x, i) => (
        <mesh key={i} geometry={x} material={S.harness()} />
      ))}
    </group>
  );
}

const UP = new THREE.Vector3(0, 1, 0);
const AXIS_X = new THREE.Vector3(1, 0, 0);
/** The head is modelled facing +x; this turns +x onto +z, the axis lookAt aims. */
const FACE_X = new THREE.Quaternion().setFromAxisAngle(UP, -Math.PI / 2);
/** At rest the head is carried a little low. */
const REST_Q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.12);
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpPQ = new THREE.Quaternion();
const rollQ = new THREE.Quaternion();
const tmpP = new THREE.Vector3();
const tmpC = new THREE.Vector3();

/**
 * Turns the head from where it was looking toward the camera, `k` of the way, worked out each
 * frame in the head's parent space so it finds you wherever the view is orbited; cocked a little
 * as it comes round (outside the component).
 */
function aimHead(head: THREE.Object3D, camera: THREE.Camera, k: number) {
  if (k <= 0) {
    head.quaternion.copy(REST_Q);
    return;
  }
  head.getWorldPosition(tmpP);
  camera.getWorldPosition(tmpC);
  tmpM.lookAt(tmpC, tmpP, UP);
  tmpQ.setFromRotationMatrix(tmpM).multiply(FACE_X);
  if (head.parent) {
    head.parent.getWorldQuaternion(tmpPQ);
    tmpQ.premultiply(tmpPQ.invert());
  }
  tmpQ.multiply(rollQ.setFromAxisAngle(AXIS_X, 0.16 * k));
  head.quaternion.copy(REST_Q).slerp(tmpQ, k);
}

/**
 * The reindeer, carved by day, bone after the Reveal. Taken: the head comes round on its neck to
 * look straight at you, then the jaw drops open.
 */
function Reindeer({ haunted, taken, since }: { haunted: boolean; taken: boolean; since: () => number }) {
  const head = useRef<THREE.Group>(null);
  const jaw = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const scrap = useCanvasTexture(128, 128, drawHide, []);
  useFrame(() => {
    const s = taken ? since() : -1;
    if (head.current) aimHead(head.current, camera, taken ? progress(s, TAKE.turnFor, TAKE.turn) : 0);
    // after the Reveal the jaw hangs a little loose; taken, it drops open
    if (jaw.current) jaw.current.rotation.z = -(0.06 + (taken ? 0.46 * progress(s, TAKE.jawFor, TAKE.jaw) : 0));
  });
  return (
    <group>
      {haunted ? <BoneDeer /> : <DayDeer />}
      <Harness />
      <group ref={head} position={HEAD_AT} quaternion={REST_Q}>
        {haunted ? <SkullHead jaw={jaw} scrap={scrap} /> : <DayHead />}
        <Nose haunted={haunted} taken={taken} since={since} at={haunted ? [0.142, -0.028, 0] : [0.13, -0.031, 0]} r={haunted ? 0.016 : 0.021} />
        <Antlers />
      </group>
    </group>
  );
}

/**
 * Santa's sleigh and reindeer (product 'sleigh'). Taken (after the Reveal): 0.2–1.4 s the
 * reindeer's skull turns round on its neck to look at you; 1.4–1.8 s its jaw drops; 1.8–2.4 s the
 * red nose dims to dark; 2.6–3.4 s something in the sack pushes its side out, palm and fingers,
 * straining; 3.8–4.6 s it pushes again at the neck and, from 4.15 s, bony fingers come up out of
 * the top and stay.
 */
export default function Sleigh() {
  const haunted = useHaunted();
  const { taken, since } = useTaken('sleigh');
  return (
    <group position-y={-0.62} rotation-y={ROOT_RY} scale={0.88}>
      <group position-x={-0.085}>
        <Runners />
        <SleighBody haunted={haunted} />
        <Sack taken={taken} since={since} />
        <Tack />
        <Reindeer haunted={haunted} taken={taken} since={since} />
      </group>
    </group>
  );
}
