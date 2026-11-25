import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { seeded } from '../../director/footprints';
import { useCanvasTexture } from '../../gl/canvasTex';
import { M } from '../../gl/materials';
import { progress, useTaken } from '../../gl/useTaken';
import { useHaunted } from '../../store';
import { hollyLeaf } from '../doll/shapes';
import { UprightSkull } from '../small/Skull';

/*
 * The Christmas countdown hourglass: turned walnut caps with mouldings, three beaded brass
 * pillars, a blown double bulb, fine white sand running down, and a red bow with holly on the
 * top. After the Reveal the same glass is dusty and cracked, the sand is grey like ash and the
 * ribbon has faded. Taken: the falling sand stops, then it runs back UP through the neck. The
 * heap in the bottom sinks into a funnel, the top fills, and the small skull that was buried in
 * the bottom all along comes out of the sand, crown first, then its eyes. The last grains rise
 * and the hourglass shudders once.
 */

/** One bulb's height (neck to end), the neck's and the widest radius, the glass wall. */
const HB = 0.56;
const NECK = 0.026;
const BULB = 0.25;
const WALL = 0.007;
/** The top of the bottom cap, the neck, the underside of the top cap; the caps' thickness. */
const BASE_TOP = -0.465;
const Y0 = BASE_TOP + HB;
const TOP_Y = Y0 + HB;
const CAP_H = 0.12;
/** The pillars stand this far out, at these angles round the glass. */
const PILLAR_R = 0.3;
const PILLAR_A = [Math.PI / 3, Math.PI, -Math.PI / 3];
/** The whole thing is turned a little so a pillar is not straight in front of the glass. */
const ROOT_RY = 0.3;
/** Seconds into the Take: the stream has stopped; the sand runs up for `drain`; the shudder. */
const TAKE = { stop: 0.4, drain: 3.8, shudder: 5.0, shudderFor: 0.35 };

const E = 0.035;
const E_ONE = Math.sqrt(1 + E * E) - E;
/** Inside radius of the glass at a height `h` above or below the neck: a smooth narrow neck, a pear-shaped bulb. */
function glassR(h: number): number {
  const u = Math.min(1, Math.abs(h) / HB);
  const us = (Math.sqrt(u * u + E * E) - E) / E_ONE;
  return NECK + (BULB - NECK) * Math.pow(Math.sin(Math.PI * 0.82 * us), 1.1);
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (v: number, a: number, b: number) => {
  const k = clamp01((v - a) / (b - a));
  return k * k * (3 - 2 * k);
};

/**
 * How the sand lies, as heights measured from the neck: in the top bulb it is up to `top` at the
 * glass and `dip` lower in the middle (negative: a mound where it wells up); in the bottom bulb it
 * comes up to `bottom` at the glass and `cone` higher in the middle (negative: a funnel).
 */
interface Level {
  top: number;
  dip: number;
  bottom: number;
  cone: number;
}
/** `d` 0: as it always stood; 1: all the sand has run back up. */
function levels(d: number): Level {
  return {
    top: 0.27 + 0.23 * d,
    dip: 0.06 - 0.09 * ease(d, 0, 0.3) + 0.015 * ease(d, 0.85, 1),
    bottom: 0.28 + (HB - 0.03 - 0.28) * d,
    cone: 0.11 - 0.175 * ease(d, 0, 0.55) + 0.045 * ease(d, 0.55, 1),
  };
}
/** Height of the bottom sand's surface, `t` 0 at the glass to 1 in the middle (never below the floor). */
const bottomH = (l: Level, t: number) => Math.min(HB - 0.003, l.bottom - l.cone * t);
const topH = (l: Level, t: number) => Math.max(0.012, l.top - l.dip * t);

const WALL_N = 12;
const SURF_N = 12;
const PN = 1 + WALL_N + SURF_N;
const SEG = 48;
const prof = Array.from({ length: PN }, () => new THREE.Vector2());

/** The bottom sand's outline: across the floor, up the glass, then over the heap (or funnel) to the middle. */
function fillBottom(l: Level) {
  const floor = HB - 0.004;
  let k = 0;
  prof[k++]!.set(0, Y0 - floor);
  for (let i = 0; i < WALL_N; i++) {
    const h = floor - (floor - l.bottom) * (i / (WALL_N - 1));
    prof[k++]!.set(Math.max(0.003, glassR(h) - WALL), Y0 - h);
  }
  const rw = glassR(l.bottom) - WALL;
  for (let j = 1; j <= SURF_N; j++) {
    const t = j / SURF_N;
    prof[k++]!.set(rw * (1 - t), Y0 - bottomH(l, t));
  }
}

/** The top sand's outline: from the neck up the glass, then over the sunken (or welling) surface. */
function fillTop(l: Level) {
  let k = 0;
  prof[k++]!.set(0, Y0 - 0.004);
  for (let i = 0; i < WALL_N; i++) {
    const h = l.top * (i / (WALL_N - 1));
    prof[k++]!.set(Math.max(0.003, glassR(h) - WALL), Y0 + h);
  }
  const rw = glassR(l.top) - WALL;
  for (let j = 1; j <= SURF_N; j++) {
    const t = j / SURF_N;
    prof[k++]!.set(rw * (1 - t), Y0 + topH(l, t));
  }
}

/** Writes the outline in `prof` into a lathe geometry made with the same counts (outside the component). */
function writeLathe(geo: THREE.BufferGeometry) {
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i <= SEG; i++) {
    const phi = (i / SEG) * Math.PI * 2;
    const s = Math.sin(phi);
    const c = Math.cos(phi);
    for (let j = 0; j < PN; j++) {
      const q = prof[j]!;
      p.setXYZ(i * PN + j, q.x * s, q.y, q.x * c);
    }
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
}

function sandGeometry(fill: (l: Level) => void): THREE.LatheGeometry {
  fill(levels(0));
  return new THREE.LatheGeometry(
    prof.map((v) => v.clone()),
    SEG,
  );
}

/** Reshapes both sand bodies for how far the sand has run back (outside the component). */
function shapeSand(top: THREE.BufferGeometry, bottom: THREE.BufferGeometry, d: number) {
  if (top.userData.d === d) return;
  top.userData.d = d;
  const l = levels(d);
  fillTop(l);
  writeLathe(top);
  fillBottom(l);
  writeLathe(bottom);
}

/** Fine sand: pale grains and glints by day; ash, grey with darker flecks, after the Reveal. */
function drawGrain(g: CanvasRenderingContext2D, w: number, h: number, haunted: boolean) {
  g.fillStyle = haunted ? '#77736b' : '#efe7d5';
  g.fillRect(0, 0, w, h);
  const r = seeded(haunted ? 12 : 11);
  for (let i = 0; i < 2600; i++) {
    const v = r();
    if (haunted) g.fillStyle = v < 0.55 ? `rgba(38,36,34,${0.2 + r() * 0.35})` : `rgba(176,170,160,${0.2 + r() * 0.3})`;
    else g.fillStyle = v < 0.6 ? `rgba(196,176,146,${0.15 + r() * 0.25})` : `rgba(255,255,255,${0.4 + r() * 0.5})`;
    g.fillRect(r() * w, r() * h, r() < 0.2 ? 2 : 1, 1);
  }
}

/** A round grain for the points; alpha-tested, so it stays opaque inside the transmissive glass. */
function drawDot(g: CanvasRenderingContext2D, w: number, h: number) {
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(w / 2, h / 2, w * 0.42, 0, Math.PI * 2);
  g.fill();
}

function repeatGrain(t: THREE.Texture) {
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 3);
  t.needsUpdate = true;
}

function pointsGeometry(n: number): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 4), 4));
  return g;
}

const FALL_N = 46;
const FALL_T = 0.32;

/**
 * The thin stream falling through the neck onto the heap, grains twinkling as they fall. Taken:
 * no more grains leave the neck; those already falling land, and the stream is gone
 * (outside the component).
 */
function updateFall(geo: THREE.BufferGeometry, clock: number, s: number, haunted: boolean) {
  const p = (geo.attributes.position as THREE.BufferAttribute).array as Float32Array;
  const c = (geo.attributes.color as THREE.BufferAttribute).array as Float32Array;
  const top = Y0 + 0.01;
  const peak = Y0 - bottomH(levels(0), 1);
  for (let i = 0; i < FALL_N; i++) {
    const f = ((i * 0.61803) % 1 + clock / FALL_T) % 1;
    // after the Take only the grains already on their way are drawn
    const on = s === Infinity ? false : s < 0 || f * FALL_T > s;
    const y = top - (top - peak) * (0.35 * f + 0.65 * f * f);
    const spread = 0.0025 * (0.4 + f);
    p[i * 3] = on ? Math.sin(i * 12.99) * spread : 0;
    p[i * 3 + 1] = on ? y : Y0;
    p[i * 3 + 2] = on ? Math.cos(i * 7.1) * spread : 0;
    const b = 0.85 + 0.15 * Math.sin(clock * 2.3 + i * 1.7);
    c[i * 4] = (haunted ? 0.5 : 1) * b;
    c[i * 4 + 1] = (haunted ? 0.49 : 0.97) * b;
    c[i * 4 + 2] = (haunted ? 0.47 : 0.92) * b;
    c[i * 4 + 3] = on ? 1 : 0;
  }
  geo.attributes.position!.needsUpdate = true;
  geo.attributes.color!.needsUpdate = true;
}

interface Grain {
  o: number;
  a0: number;
  r0: number;
  a1: number;
  r1: number;
  start: number;
  end: number;
}
const RISE_N = 120;
const RISE_T = 0.7;

/** Each rising grain: its phase, where it leaves the bottom sand, where it lands on top, its first and last trip. */
function makeGrains(): Grain[] {
  const r = seeded(73);
  return Array.from({ length: RISE_N }, () => ({
    o: r(),
    a0: r() * Math.PI * 2,
    r0: r(),
    a1: r() * Math.PI * 2,
    r1: 0.015 + r() * 0.09,
    // the run starts unevenly, then thins out: the last ones leave by 4.8 s and land by 5.5 s
    start: TAKE.stop + r() * 0.5,
    end: TAKE.stop + TAKE.drain - 0.3 + Math.pow(r(), 1.6) * 0.9,
  }));
}

/**
 * Grains drawn up off the bottom sand, spiralling in to the neck, up through it and out of the
 * middle of the top sand, where each one is thrown up a little and falls back onto the surface
 * (outside the component).
 */
function updateRise(geo: THREE.BufferGeometry, grains: Grain[], s: number, clock: number, haunted: boolean) {
  const p = (geo.attributes.position as THREE.BufferAttribute).array as Float32Array;
  const c = (geo.attributes.color as THREE.BufferAttribute).array as Float32Array;
  const d = progress(s, TAKE.drain, TAKE.stop);
  const l = levels(d);
  const rwB = glassR(l.bottom) - WALL;
  const rwT = glassR(l.top) - WALL;
  const yTop = Y0 + topH(l, 1);
  grains.forEach((gr, i) => {
    const f = (s / RISE_T + gr.o) % 1;
    const born = s - f * RISE_T;
    const on = s !== Infinity && s >= 0 && born >= gr.start && born <= gr.end;
    let x = 0;
    let y = Y0;
    let z = 0;
    if (on) {
      const rho0 = Math.min(rwB * 0.85, 0.012 + gr.r0 * (0.03 + 0.07 * d));
      const yb = Y0 - bottomH(l, 1 - rho0 / rwB);
      if (f < 0.8) {
        const g = f / 0.8;
        y = yb + (yTop - yb) * g;
        const below = y < Y0 ? (Y0 - y) / (Y0 - yb) : 0;
        const rr = rho0 * below + 0.0015;
        x = Math.cos(gr.a0 + g * 2.2) * rr;
        z = Math.sin(gr.a0 + g * 2.2) * rr;
      } else {
        const g = (f - 0.8) / 0.2;
        const rho1 = Math.min(rwT * 0.8, gr.r1);
        const yl = Y0 + topH(l, 1 - rho1 / rwT);
        y = yTop + (yl - yTop) * g + Math.sin(Math.PI * g) * 0.035;
        x = Math.cos(gr.a1) * rho1 * g;
        z = Math.sin(gr.a1) * rho1 * g;
      }
    }
    p[i * 3] = x;
    p[i * 3 + 1] = y;
    p[i * 3 + 2] = z;
    const b = 0.85 + 0.15 * Math.sin(clock * 2.1 + i * 2.3);
    c[i * 4] = (haunted ? 0.5 : 1) * b;
    c[i * 4 + 1] = (haunted ? 0.49 : 0.97) * b;
    c[i * 4 + 2] = (haunted ? 0.47 : 0.92) * b;
    c[i * 4 + 3] = on ? 1 : 0;
  });
  geo.attributes.position!.needsUpdate = true;
  geo.attributes.color!.needsUpdate = true;
}

/** Turned walnut cap: a bullnose edge, a bead, a cove up to the flat where the glass sits. */
const CAP_PROFILE: [number, number][] = [
  [0, 0],
  [0.392, 0],
  [0.41, 0.003],
  [0.422, 0.011],
  [0.428, 0.022],
  [0.426, 0.033],
  [0.418, 0.041],
  [0.408, 0.045],
  [0.404, 0.05],
  [0.408, 0.056],
  [0.411, 0.063],
  [0.408, 0.07],
  [0.4, 0.074],
  [0.39, 0.077],
  [0.378, 0.083],
  [0.37, 0.092],
  [0.366, 0.102],
  [0.36, 0.11],
  [0.35, 0.116],
  [0.336, 0.12],
  [0.16, 0.12],
  [0, 0.12],
];

/** Half a turned brass pillar (foot, beads, a slim shaft, the middle bead); mirrored for the other half. */
const PILLAR_HALF: [number, number][] = [
  [0, 0],
  [0.034, 0],
  [0.034, 0.014],
  [0.031, 0.019],
  [0.025, 0.023],
  [0.024, 0.028],
  [0.028, 0.033],
  [0.03, 0.039],
  [0.028, 0.045],
  [0.022, 0.05],
  [0.017, 0.056],
  [0.0148, 0.07],
  [0.014, 0.16],
  [0.0132, 0.3],
  [0.0135, 0.43],
  [0.0155, 0.47],
  [0.02, 0.495],
  [0.026, 0.512],
  [0.029, 0.527],
  [0.0295, 0.54],
  [0.027, 0.552],
  [0.0245, HB],
];

/** The two walnut caps, the bun feet, three brass pillars and the brass collars round the glass ends. */
function Frame() {
  const g = useMemo(() => {
    const cap = new THREE.LatheGeometry(
      CAP_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)),
      72,
    );
    const half = PILLAR_HALF.map(([r, y]) => new THREE.Vector2(r, y));
    const mirrored = PILLAR_HALF.slice(0, -1)
      .reverse()
      .map(([r, y]) => new THREE.Vector2(r, 2 * HB - y));
    const pillar = new THREE.LatheGeometry([...half, ...mirrored], 24);
    return { cap, pillar };
  }, []);
  useEffect(
    () => () => {
      g.cap.dispose();
      g.pillar.dispose();
    },
    [g],
  );
  return (
    <group>
      <mesh geometry={g.cap} material={M.wood()} position-y={BASE_TOP - CAP_H} />
      <mesh geometry={g.cap} material={M.wood()} position-y={TOP_Y + CAP_H} scale-y={-1} />
      {PILLAR_A.map((a) => (
        <group key={a}>
          <mesh geometry={g.pillar} material={M.brass()} position={[Math.sin(a) * PILLAR_R, BASE_TOP, Math.cos(a) * PILLAR_R]} />
          {/* a bun foot under each pillar */}
          <mesh material={M.wood()} position={[Math.sin(a) * 0.32, -0.6, Math.cos(a) * 0.32]} scale={[1, 0.4, 1]}>
            <sphereGeometry args={[0.05, 20, 12]} />
          </mesh>
        </group>
      ))}
      {/* a low brass bead and seat where the glass meets each cap (kept low: the last of the sand must show) */}
      {[1, -1].map((s) => (
        <group key={s} position-y={s > 0 ? BASE_TOP : TOP_Y}>
          <mesh material={M.brass()} position-y={s * 0.0055} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.146, 0.0055, 8, 48]} />
          </mesh>
          {/* the flat seat faces into the glass: up on the bottom cap, down under the top one */}
          <mesh material={M.brass()} position-y={s * 0.0008} rotation-x={-s * (Math.PI / 2)}>
            <ringGeometry args={[0.12, 0.175, 48]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** The double bulb, blown as one piece; the materials make it dusty after the Reveal. */
function Glass() {
  const geo = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    const n = 90;
    for (let i = 0; i <= n; i++) {
      const h = -HB + (2 * HB * i) / n;
      pts.push(new THREE.Vector2(glassR(h), Y0 + h));
    }
    return new THREE.LatheGeometry(pts, 64);
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  const haunted = useHaunted();
  // Thin clear glass, not the shared transmissive glass: that one read as a solid milky bulb
  // here and hid the sand and the skull. A faint film of dust after the Reveal.
  return (
    <mesh geometry={geo} renderOrder={2}>
      <meshPhysicalMaterial
        color={haunted ? '#d8d2c4' : '#ffffff'}
        transparent
        opacity={haunted ? 0.2 : 0.12}
        roughness={haunted ? 0.25 : 0.04}
        clearcoat={1}
        clearcoatRoughness={haunted ? 0.3 : 0.05}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/** A hairline crack down one side of the top bulb, with a short branch (haunted only). */
function Crack() {
  const geos = useMemo(() => {
    const r = seeded(17);
    const onGlass = (h: number, phi: number) => {
      const rad = glassR(h) + 0.0018;
      return new THREE.Vector3(rad * Math.sin(phi), Y0 + h, rad * Math.cos(phi));
    };
    const main: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      main.push(onGlass(0.47 - t * 0.3, -0.12 + t * 0.22 + (r() - 0.5) * 0.05));
    }
    const branch: THREE.Vector3[] = [];
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      branch.push(onGlass(0.35 - t * 0.07, -0.06 - t * 0.16 + (r() - 0.5) * 0.03));
    }
    return [
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(main, false, 'centripetal'), 80, 0.0014, 4),
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(branch, false, 'centripetal'), 30, 0.001, 4),
    ];
  }, []);
  useEffect(() => () => geos.forEach((g) => g.dispose()), [geos]);
  return (
    <>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color="#1b1814" roughness={0.6} />
        </mesh>
      ))}
    </>
  );
}

/** One of the ribbon's two tails: lying across the cap, then hanging over its front edge. */
function tailGeometry(side: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * 0.006, 0.012, 0),
    new THREE.Vector3(side * 0.018, 0.006, 0.05),
    new THREE.Vector3(side * 0.028, 0.003, 0.095),
    new THREE.Vector3(side * 0.034, -0.016, 0.13),
    new THREE.Vector3(side * 0.04, -0.055, 0.14),
    new THREE.Vector3(side * 0.044, -0.092, 0.138),
  ]);
  const n = 32;
  const w = 0.012;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const p = curve.getPoint(i / n);
    pos.push(p.x - w, p.y, p.z, p.x + w, p.y, p.z);
  }
  // the end is cut in a V, as ribbon tails are: the middle of the end stops short of its corners
  const m = curve.getPoint((n - 0.6) / n);
  pos.push(m.x, m.y, m.z);
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const b = (n - 1) * 2;
  const mid = (n + 1) * 2;
  idx.push(b, b + 2, mid, b, mid, b + 1, b + 1, mid, b + 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** The red bow on the top cap with holly and berries; after the Reveal faded, the leaves dry. */
function Garnish({ haunted }: { haunted: boolean }) {
  const g = useMemo(() => ({ leaf: hollyLeaf(), tails: [tailGeometry(-1), tailGeometry(1)] }), []);
  useEffect(
    () => () => {
      g.leaf.dispose();
      g.tails.forEach((t) => t.dispose());
    },
    [g],
  );
  const ribbon = useMemo(
    () =>
      haunted
        ? new THREE.MeshPhysicalMaterial({ color: '#7b5953', roughness: 0.88, sheen: 0.2, sheenColor: new THREE.Color('#a88a80'), side: THREE.DoubleSide })
        : new THREE.MeshPhysicalMaterial({ color: '#b0101c', roughness: 0.42, sheen: 1, sheenColor: new THREE.Color('#ff8a8a'), side: THREE.DoubleSide }),
    [haunted],
  );
  useEffect(() => () => ribbon.dispose(), [ribbon]);
  return (
    <group rotation-y={-ROOT_RY}>
      <group position={[0, TOP_Y + CAP_H, 0.31]}>
        {[0.9, -0.9, 0].map((a) => (
          <group key={a} rotation-y={a} position-y={0.003}>
            <mesh geometry={g.leaf} rotation-x={-Math.PI / 2 + 0.12} scale={1.5}>
              <meshStandardMaterial color={haunted ? '#3d3b2b' : '#2f6a2c'} roughness={haunted ? 0.8 : 0.35} />
            </mesh>
          </group>
        ))}
        {(
          [
            [-0.016, 0.016, -0.026],
            [0.014, 0.014, -0.03],
            [0, 0.022, -0.042],
          ] as const
        ).map(([x, y, z], i) => (
          <mesh key={i} position={[x, y, z]} scale={haunted ? 0.78 : 1}>
            <sphereGeometry args={[0.012, 12, 10]} />
            <meshStandardMaterial color={haunted ? '#4a1a16' : '#c8141c'} roughness={haunted ? 0.7 : 0.22} />
          </mesh>
        ))}
        {g.tails.map((t, i) => (
          <mesh key={i} geometry={t} material={ribbon} />
        ))}
        {[-1, 1].map((s) => (
          <mesh key={s} material={ribbon} position={[s * 0.036, 0.032, -0.004]} rotation={[-0.3, 0, s * 0.5]} scale={[1.25, 0.8, 0.6]}>
            <torusGeometry args={[0.03, 0.009, 10, 28]} />
          </mesh>
        ))}
        <mesh material={ribbon} position={[0, 0.022, 0.002]} scale={[1, 0.9, 0.8]}>
          <sphereGeometry args={[0.014, 14, 10]} />
        </mesh>
      </group>
    </group>
  );
}

/** Both bodies of sand, reshaped every frame from how far the sand has run back. */
function Sand({ haunted, taken, since }: { haunted: boolean; taken: boolean; since: () => number }) {
  const grain = useCanvasTexture(128, 128, (g, w, h) => drawGrain(g, w, h, haunted), [haunted]);
  useEffect(() => repeatGrain(grain), [grain]);
  const geos = useMemo(() => ({ top: sandGeometry(fillTop), bottom: sandGeometry(fillBottom) }), []);
  useEffect(
    () => () => {
      geos.top.dispose();
      geos.bottom.dispose();
    },
    [geos],
  );
  useFrame(() => shapeSand(geos.top, geos.bottom, taken ? progress(since(), TAKE.drain, TAKE.stop) : 0));
  const mat = <meshStandardMaterial map={grain} roughness={0.95} side={THREE.DoubleSide} />;
  return (
    <>
      <mesh geometry={geos.top}>{mat}</mesh>
      <mesh geometry={geos.bottom}>{mat}</mesh>
    </>
  );
}

/** The falling stream: grains and a thin unbroken thread under them, which drops away when it stops. */
function Stream({ haunted, taken, since, dot }: { haunted: boolean; taken: boolean; since: () => number; dot: THREE.Texture }) {
  const geo = useMemo(() => pointsGeometry(FALL_N), []);
  useEffect(() => () => geo.dispose(), [geo]);
  const thread = useRef<THREE.Mesh>(null);
  useFrame((st) => {
    const s = taken ? since() : -1;
    updateFall(geo, st.clock.elapsedTime, s, haunted);
    const t = thread.current;
    if (!t) return;
    const peak = Y0 - bottomH(levels(0), 1);
    const gone = s < 0 ? 0 : progress(s, FALL_T + 0.05);
    const top = Y0 + 0.01 - (Y0 + 0.01 - peak) * gone;
    t.visible = gone < 0.98;
    t.position.y = (top + peak) / 2;
    t.scale.y = Math.max(0.001, top - peak);
  });
  return (
    <>
      <points geometry={geo}>
        <pointsMaterial map={dot} size={0.013} sizeAttenuation vertexColors alphaTest={0.5} />
      </points>
      <mesh ref={thread}>
        <cylinderGeometry args={[0.0032, 0.0042, 1, 6]} />
        <meshStandardMaterial color={haunted ? '#7d7972' : '#f4ede0'} roughness={0.8} />
      </mesh>
    </>
  );
}

/** The grains running the wrong way, only after the Take. */
function Rising({ haunted, since, dot }: { haunted: boolean; since: () => number; dot: THREE.Texture }) {
  const geo = useMemo(() => pointsGeometry(RISE_N), []);
  const grains = useMemo(() => makeGrains(), []);
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame((st) => updateRise(geo, grains, since(), st.clock.elapsedTime, haunted));
  return (
    <points geometry={geo}>
      <pointsMaterial map={dot} size={0.012} sizeAttenuation vertexColors alphaTest={0.5} />
    </points>
  );
}

/**
 * The Christmas countdown hourglass (product 'hourglass'). Taken (after the Reveal): the stream
 * stops (0–0.4 s); the sand runs up through the neck (0.4–4.2 s), the bottom heap sinking into a
 * funnel while the top fills; from about 2.3 s a small skull buried in the bottom is uncovered,
 * its crown and then (about 3 s) its eye sockets; the last grains rise until 5.5 s and the
 * hourglass shudders once (5.0 s). It ends with the top full of grey sand and the skull looking
 * out of a thin layer in the bottom.
 */
export default function Hourglass() {
  const haunted = useHaunted();
  const { taken, since } = useTaken('hourglass');
  const dot = useCanvasTexture(32, 32, drawDot, []);
  const root = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = root.current;
    if (!g) return;
    const s = taken ? since() : -1;
    const k = s === Infinity || s < TAKE.shudder ? -1 : (s - TAKE.shudder) / TAKE.shudderFor;
    g.rotation.z = k >= 0 && k < 1 ? Math.sin(k * Math.PI * 4) * 0.007 * (1 - k) : 0;
  });
  return (
    <group rotation-y={ROOT_RY}>
      <group ref={root} position-y={-0.6}>
        <group position-y={0.6}>
          <Frame />
          <Sand haunted={haunted} taken={taken} since={since} />
          <Stream haunted={haunted} taken={taken} since={since} dot={dot} />
          {taken && <Rising haunted={haunted} since={since} dot={dot} />}
          {haunted && (
            // buried in the bottom sand all along, sitting on the glass, face turned up to you
            <group position={[0, BASE_TOP + 0.052, 0]} rotation-y={-ROOT_RY}>
              <group rotation-x={-0.28} scale={0.24}>
                <UprightSkull bloody={false} />
              </group>
            </group>
          )}
          {haunted && <Crack />}
          <Glass />
          <Garnish haunted={haunted} />
        </group>
      </group>
    </group>
  );
}
