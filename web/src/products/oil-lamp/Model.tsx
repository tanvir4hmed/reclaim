import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { seeded } from '../../director/footprints';
import { reducedMotion } from '../../director/runtime';
import { useCanvasTexture } from '../../gl/canvasTex';
import { mat } from '../../gl/decay';
import { M } from '../../gl/materials';
import { progress, useTaken } from '../../gl/useTaken';
import { useHaunted } from '../../store';

/*
 * The lamp is built along +x: the ribbon handle at the back (-x), the spout reaching forward and
 * up (+x). Its foot stands on y = 0 of the lamp's own space; the lid sits on the opening at the
 * top of the body. The ghost's tail comes out of the spout mouth and coils up to WAIST, where the
 * ghost's own space begins (its waist at the origin, +y up, +z toward you).
 */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => {
  const k = clamp01(v);
  return k * k * (3 - 2 * k);
};
const fract = (v: number) => v - Math.floor(v);

/** Half-profile of the body (radius, height), before it is drawn out into a teardrop. */
const BODY: [number, number][] = [
  [0.0, 0.105],
  [0.1, 0.11],
  [0.19, 0.135],
  [0.25, 0.17],
  [0.278, 0.21],
  [0.282, 0.24],
  [0.265, 0.28],
  [0.215, 0.318],
  [0.15, 0.345],
  [0.118, 0.358],
  [0.112, 0.372],
];
/** The foot: a flared ring with a bead at the bottom, a waist, and a collar under the body. */
const FOOT: [number, number][] = [
  [0.0, 0.0],
  [0.15, 0.0],
  [0.166, 0.006],
  [0.17, 0.018],
  [0.156, 0.03],
  [0.11, 0.046],
  [0.08, 0.07],
  [0.072, 0.09],
  [0.088, 0.104],
  [0.104, 0.116],
];
const LID: [number, number][] = [
  [0.128, 0.0],
  [0.127, 0.012],
  [0.114, 0.038],
  [0.088, 0.066],
  [0.052, 0.087],
  [0.024, 0.098],
  [0.016, 0.108],
];
/** The spout, from inside the body out to the wick mouth. */
const SPOUT = new THREE.CatmullRomCurve3(
  [
    [0.26, 0.215, 0],
    [0.42, 0.245, 0],
    [0.56, 0.3, 0],
    [0.68, 0.38, 0],
    [0.77, 0.47, 0],
    [0.83, 0.535, 0],
    [0.855, 0.567, 0],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z)),
);
/** Spout radius along it: wide where it grows out of the body, thin at the mouth, a small flared lip. */
const spoutR = (t: number) => 0.022 + 0.055 * (1 - t) ** 1.5 + 0.007 * smooth((t - 0.9) / 0.1);
const MOUTH = SPOUT.getPoint(1);
const MOUTH_DIR = SPOUT.getTangent(1).normalize();
const WAIST = new THREE.Vector3(0.12, 0.98, 0.04);
const Z = new THREE.Vector3(0, 0, 1);
const Y = new THREE.Vector3(0, 1, 0);

function smoothProfile(p: [number, number][], n: number): THREE.Vector2[] {
  const c = new THREE.CatmullRomCurve3(
    p.map(([r, y]) => new THREE.Vector3(r, y, 0)),
    false,
    'centripetal',
  );
  return c.getPoints(n).map((v) => new THREE.Vector2(Math.max(0, v.x), v.y));
}

/** Radius of a profile at a height (the profile rises monotonically). */
function radiusAt(prof: THREE.Vector2[], y: number): number {
  for (let i = 0; i < prof.length - 1; i++) {
    const a = prof[i]!;
    const b = prof[i + 1]!;
    if (y >= a.y && y <= b.y) return a.x + ((b.x - a.x) * (y - a.y)) / Math.max(1e-6, b.y - a.y);
  }
  return prof[prof.length - 1]!.x;
}

/**
 * Draws the round body out into the oval teardrop of a genie lamp: longer toward the spout than
 * toward the handle, the point lifted a little; the opening at the top stays round for the lid.
 */
function tear(x: number, y: number, z: number, out: THREE.Vector3): THREE.Vector3 {
  const w = 1 - smooth((y - 0.27) / 0.1);
  const X = x * (1 + w * (0.36 + 0.3 * Math.tanh(x * 7)));
  return out.set(X, y + w * Math.max(0, X - 0.18) ** 2 * 0.45, z);
}

function deform(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const p = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    tear(p.getX(i), p.getY(i), p.getZ(i), v);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * A tube along a curve whose cross-section changes along it: `rad(t)` gives the two radii (in the
 * curve's normal and binormal directions), so it can taper (spout, fingers) or be a flat ribbon
 * (the handle). `side` fixes the binormal for curves drawn in a plane. uv.x runs 0..1 along it.
 */
function taper(
  curve: THREE.Curve<THREE.Vector3>,
  segs: number,
  radial: number,
  rad: (t: number) => [number, number],
  opts: { side?: THREE.Vector3; range?: [number, number] } = {},
): THREE.BufferGeometry {
  const [t0, t1] = opts.range ?? [0, 1];
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
    const t = t0 + ((t1 - t0) * i) / segs;
    curve.getPoint(t, P);
    curve.getTangent(t, T).normalize();
    if (opts.side) {
      N.crossVectors(opts.side, T).normalize();
    } else if (i === 0) {
      // any normal to start with, then carried along the curve without twisting
      const a = Math.abs(T.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      N.crossVectors(T, a).normalize();
    } else {
      N.addScaledVector(T, -T.dot(N)).normalize();
    }
    B.crossVectors(T, N).normalize();
    const [rn, rb] = rad(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      V.copy(N).multiplyScalar(c * rn).addScaledVector(B, s * rb);
      pos.push(P.x + V.x, P.y + V.y, P.z + V.z);
      V.copy(N).multiplyScalar(c / Math.max(rn, 1e-4)).addScaledVector(B, s / Math.max(rb, 1e-4)).normalize();
      nor.push(V.x, V.y, V.z);
      uv.push((t - t0) / Math.max(1e-6, t1 - t0), j / radial);
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

/** Copies of a small geometry at each point, baked into one geometry (a row of beads). */
function scatter(base: THREE.BufferGeometry, at: THREE.Vector3[]): THREE.BufferGeometry {
  const src = base.toNonIndexed();
  const sp = src.attributes.position as THREE.BufferAttribute;
  const sn = src.attributes.normal as THREE.BufferAttribute;
  const n = sp.count;
  const pos = new Float32Array(n * at.length * 3);
  const nor = new Float32Array(n * at.length * 3);
  at.forEach((c, k) => {
    for (let i = 0; i < n; i++) {
      const o = (k * n + i) * 3;
      pos[o] = sp.getX(i) + c.x;
      pos[o + 1] = sp.getY(i) + c.y;
      pos[o + 2] = sp.getZ(i) + c.z;
      nor[o] = sn.getX(i);
      nor[o + 1] = sn.getY(i);
      nor[o + 2] = sn.getZ(i);
    }
  });
  src.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}

/** Soot round the end of the spout: black at the lip, fading back along it (vertex alpha). */
function sootSleeve(): THREE.BufferGeometry {
  const g = taper(SPOUT, 24, 28, (t) => [spoutR(t) * 1.06 + 0.0015, spoutR(t) * 1.06 + 0.0015], { range: [0.7, 1] });
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const col = new Float32Array(uv.count * 4);
  for (let i = 0; i < uv.count; i++) {
    // streakier on the upper side, where the smoke has curled over it
    const k = smooth(uv.getX(i) * 1.15) * (0.75 + 0.25 * Math.sin(uv.getY(i) * Math.PI * 2 + 1.2));
    col.set([0.04, 0.035, 0.03, Math.min(0.95, k)], i * 4);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 4));
  return g;
}

/** A holly leaf: a lens with spiky points along both edges. */
function hollyLeaf(): THREE.ExtrudeGeometry {
  const L = 0.07;
  const W = 0.024;
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
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.003, bevelEnabled: false });
  g.translate(0, 0, -0.0015);
  return g;
}

/** Where a thing at the end of the spout goes, facing along it. */
function along(t: number, from: THREE.Vector3): { p: THREE.Vector3; q: THREE.Quaternion } {
  return { p: SPOUT.getPoint(t), q: new THREE.Quaternion().setFromUnitVectors(from, SPOUT.getTangent(t).normalize()) };
}

function buildLamp() {
  const body = smoothProfile(BODY, 56);
  const v = new THREE.Vector3();
  const bead = new THREE.SphereGeometry(0.0075, 8, 6);
  const beadAt = (y: number, n: number, out = 0.004) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      const r = radiusAt(body, y) + out;
      return tear(Math.sin(a) * r, y, Math.cos(a) * r, new THREE.Vector3());
    });
  const band = (y: number) => {
    const g = new THREE.TorusGeometry(radiusAt(body, y) + 0.001, 0.0055, 6, 120);
    g.rotateX(Math.PI / 2);
    g.translate(0, y, 0);
    return deform(g);
  };
  // the red stone sits on the front of the belly, facing you
  const sy = 0.228;
  const sz = Math.sqrt(radiusAt(body, sy) ** 2 - 0.03 ** 2);
  const stone = tear(0.03, sy, sz, v).clone();
  const geo = {
    // seam at the back (phiStart π), where nobody looks
    body: deform(new THREE.LatheGeometry(body, 96, Math.PI)),
    foot: new THREE.LatheGeometry(smoothProfile(FOOT, 40), 72),
    lid: new THREE.LatheGeometry(smoothProfile(LID, 28), 64),
    bands: [band(0.17), band(0.3)],
    beads: scatter(bead, [...beadAt(0.235, 56), ...beadAt(0.125, 36)]),
    spout: taper(SPOUT, 72, 28, (t) => [spoutR(t), spoutR(t)]),
    soot: sootSleeve(),
    handle: taper(
      new THREE.CatmullRomCurve3(
        [
          [-0.22, 0.322, 0],
          [-0.34, 0.372, 0],
          [-0.47, 0.37, 0],
          [-0.553, 0.31, 0],
          [-0.562, 0.22, 0],
          [-0.505, 0.152, 0],
          [-0.4, 0.13, 0],
          [-0.3, 0.158, 0],
          [-0.235, 0.19, 0],
        ].map(([x, y, z]) => new THREE.Vector3(x, y, z)),
      ),
      64,
      16,
      (t) => [0.011, 0.024 + 0.01 * Math.sin(Math.PI * t)],
      { side: Z },
    ),
    // the thumb-rest scroll curling back over the top of the handle
    curl: taper(
      new THREE.CatmullRomCurve3(
        [
          [-0.36, 0.37, 0],
          [-0.4, 0.425, 0],
          [-0.45, 0.452, 0],
          [-0.492, 0.44, 0],
          [-0.5, 0.41, 0],
          [-0.476, 0.392, 0],
          [-0.456, 0.408, 0],
        ].map(([x, y, z]) => new THREE.Vector3(x, y, z)),
      ),
      40,
      12,
      (t) => [0.009 * (1 - 0.4 * t), 0.02 * (1 - 0.45 * t)],
      { side: Z },
    ),
    leaf: hollyLeaf(),
    sphere: new THREE.SphereGeometry(1, 24, 16),
    stone,
    collar: along(0.36, Z),
    lip: along(1, Z),
    hole: along(0.985, Z),
    wick: along(1, Y),
  };
  bead.dispose();
  return geo;
}

let lampGeo: ReturnType<typeof buildLamp> | null = null;
function lampParts() {
  lampGeo ??= buildLamp();
  return lampGeo;
}

/** The red glass of the stone: deep and glossy by day, a dull clot after the Reveal. */
const ruby = () =>
  mat('lampRuby', { color: '#a20c1a', roughness: 0.06, clearcoat: 1, emissive: '#4a0008', emissiveIntensity: 0.7, hauntedColor: '#35080b', decay: { age: 0.2, dust: 0.35 } });

/** The brass lamp itself, everything but the lid. */
function LampBody({ haunted }: { haunted: boolean }) {
  const g = lampParts();
  const brass = M.brass();
  return (
    <group>
      <mesh geometry={g.foot} material={brass} scale={[1.22, 1, 1]} />
      <mesh geometry={g.body} material={brass} />
      {g.bands.map((b, i) => (
        <mesh key={i} geometry={b} material={M.gilt()} />
      ))}
      <mesh geometry={g.beads} material={brass} />
      {/* the round opening the lid sits on */}
      <mesh material={M.gilt()} position-y={0.371} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.114, 0.008, 8, 48]} />
      </mesh>
      <mesh material={M.ink()} position-y={0.366} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.108, 40]} />
      </mesh>
      <mesh geometry={g.spout} material={brass} />
      <mesh material={M.gilt()} position={g.collar.p} quaternion={g.collar.q}>
        <torusGeometry args={[spoutR(0.36) + 0.002, 0.007, 8, 32]} />
      </mesh>
      <mesh material={brass} position={g.lip.p} quaternion={g.lip.q}>
        <torusGeometry args={[spoutR(1), 0.0065, 8, 32]} />
      </mesh>
      <mesh material={M.ink()} position={g.hole.p} quaternion={g.hole.q}>
        <circleGeometry args={[spoutR(0.985) * 0.95, 24]} />
      </mesh>
      {/* the wick in the mouth: white cotton by day, a charred stub after */}
      <mesh material={haunted ? M.ink() : M.clothWhite()} position={g.wick.p} quaternion={g.wick.q}>
        <cylinderGeometry args={[0.011, 0.013, haunted ? 0.022 : 0.05, 10]} />
      </mesh>
      {haunted && (
        <mesh geometry={g.soot} renderOrder={1}>
          <meshStandardMaterial vertexColors transparent depthWrite={false} roughness={1} />
        </mesh>
      )}
      <mesh geometry={g.handle} material={brass} />
      <mesh geometry={g.curl} material={brass} />
      <Stone at={g.stone} />
      <Bow />
    </group>
  );
}

/** The red glass stone in a gold bezel, with a ring of tiny gold beads round it. */
function Stone({ at }: { at: THREE.Vector3 }) {
  const g = lampParts();
  return (
    <group position={at} rotation-y={0.12}>
      <mesh geometry={g.sphere} material={ruby()} position-z={0.003} scale={[0.04, 0.046, 0.02]} />
      <mesh material={M.gilt()} position-z={0.002}>
        <torusGeometry args={[0.044, 0.0075, 8, 32]} />
      </mesh>
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return <mesh key={i} geometry={g.sphere} material={M.gilt()} position={[Math.cos(a) * 0.061, Math.sin(a) * 0.066, -0.004]} scale={0.0065} />;
      })}
    </group>
  );
}

/** A small red bow tied on the handle, two holly leaves and three berries above the knot. */
function Bow() {
  const g = lampParts();
  const red = M.velvetRed();
  return (
    <group position={[-0.558, 0.262, 0.03]}>
      {[-1, 1].map((s) => (
        <mesh key={s} material={red} position={[s * 0.036, 0.008, 0]} rotation-z={s * 0.35} scale={[1, 0.62, 0.55]}>
          <torusGeometry args={[0.032, 0.011, 10, 24]} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} material={red} position={[s * 0.022, -0.05, 0.004]} rotation-z={s * 0.32}>
          <boxGeometry args={[0.018, 0.075, 0.005]} />
        </mesh>
      ))}
      <mesh geometry={g.sphere} material={red} scale={[0.016, 0.018, 0.014]} />
      <group position={[0.004, 0.03, 0.01]}>
        <mesh geometry={g.leaf} material={M.green()} rotation={[0.25, 0.2, 0.55]} />
        <mesh geometry={g.leaf} material={M.green()} rotation={[-0.2, -0.2, Math.PI - 0.5]} />
        {[
          [0.0, 0.004, 0.012],
          [0.013, -0.004, 0.012],
          [-0.011, -0.006, 0.013],
        ].map(([x, y, z], i) => (
          <mesh key={i} geometry={g.sphere} material={M.berry()} position={[x!, y!, z!]} scale={0.009} />
        ))}
      </group>
    </group>
  );
}

/** The domed lid with its finial, hinged at the back edge of the opening. */
function Lid() {
  const g = lampParts();
  return (
    <group position-x={0.12}>
      <mesh geometry={g.lid} material={M.brass()} />
      <mesh material={M.gilt()} position-y={0.004} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.127, 0.006, 8, 48]} />
      </mesh>
      <mesh geometry={g.sphere} material={M.brass()} position-y={0.125} scale={[0.026, 0.024, 0.026]} />
      <mesh material={M.gilt()} position-y={0.162}>
        <coneGeometry args={[0.012, 0.05, 16]} />
      </mesh>
      <mesh geometry={g.sphere} material={M.gilt()} position-y={0.104} scale={[0.02, 0.006, 0.02]} />
    </group>
  );
}

/** The lid by itself: still; taken, it rattles for 0.6 s, then is left a little ajar. */
function poseLid(lid: THREE.Group | null, body: THREE.Group | null, s: number) {
  if (!lid || !body) return;
  if (s < 0) {
    lid.rotation.z = 0;
    lid.position.y = 0.372;
    body.rotation.z = 0;
    return;
  }
  const t = s === Infinity ? 99 : s;
  const ajar = 0.17 * progress(t, 0.5, 0.45);
  const env = t < 0.6 ? Math.sin((t / 0.6) * Math.PI) : 0;
  const jump = Math.abs(Math.sin(t * 42)) * env;
  lid.rotation.z = Math.max(ajar, jump * 0.13);
  lid.position.y = 0.372 + jump * 0.012;
  // the whole lamp trembles a little while the smoke is pouring out of it
  const pour = t > 0.6 && t < 2.4 ? Math.sin(((t - 0.6) / 1.8) * Math.PI) : 0;
  body.rotation.z = Math.sin(t * 31) * 0.006 * (env + pour);
}

/* ------------------------------------------------------------------------------------------ */
/* The smoke                                                                                 */
/* ------------------------------------------------------------------------------------------ */

/**
 * The path of the tail, u = 0 at the spout mouth, 1 at the ghost's waist: it rises out of the
 * spout and coils twice round as it climbs back over the lamp, like a genie's tail.
 */
function spiral(u: number, out: THREE.Vector3): THREE.Vector3 {
  const k = smooth(u);
  const R = 0.13 * Math.sin(Math.PI * u) * (1 - 0.35 * u);
  const a = u * Math.PI * 4;
  return out.set(
    MOUTH.x + (WAIST.x - MOUTH.x) * k + R * (Math.cos(a) - 1),
    MOUTH.y + (WAIST.y - MOUTH.y) * u ** 0.85,
    MOUTH.z + (WAIST.z - MOUTH.z) * k + R * Math.sin(a),
  );
}
/** The tail's thickness along it: it billows out of the thin mouth, then thins into the waist. */
const tailR = (u: number) => 0.02 + 0.07 * Math.sin(Math.PI * (0.06 + 0.86 * u)) ** 0.7;

/** When things happen in the Take, seconds after it. */
const TAKE = { pour: 0.6, poured: 2.4, form: 2.0, formed: 3.6, leaned: 5.2, gone: 6.3 };

interface GhostState {
  /** How far up the path the smoke reaches (0..1). */
  head: number;
  form: number;
  lean: number;
  suck: number;
  eyes: number;
  on: boolean;
}

function ghostState(s: number): GhostState {
  const t = s === Infinity ? 99 : s;
  const pour = clamp01((t - TAKE.pour) / (TAKE.poured - TAKE.pour));
  // sucked back in tail first: slow to start, then fast
  const suck = clamp01((t - TAKE.leaned) / (TAKE.gone - TAKE.leaned)) ** 2;
  return {
    head: Math.min(1 - (1 - pour) ** 2, 1 - suck),
    form: progress(t, TAKE.formed - TAKE.form, TAKE.form),
    lean: progress(t, TAKE.leaned - TAKE.formed, TAKE.formed),
    suck,
    eyes: progress(t, 0.7, 2.8),
    on: t > TAKE.pour && t < TAKE.gone,
  };
}

const SMOKE_VERT = /* glsl */ `
varying vec3 vW;
varying vec3 vN;
varying float vU;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vU = uv.x;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

/*
 * Smoke on a surface: soft at the silhouette (it fades where the surface turns away from you),
 * eaten into drifting holes by rising noise; `uDissolve` sets how much of it is still holes.
 * For the tail, `uHead` cuts it off where the smoke has reached along its length.
 */
const SMOKE_FRAG = /* glsl */ `
uniform float uTime;
uniform float uAlpha;
uniform float uDissolve;
uniform float uHead;
uniform float uEdge;
uniform vec3 uColor;
varying vec3 vW;
varying vec3 vN;
varying float vU;
float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { return 0.55 * n3(p) + 0.3 * n3(p * 2.1) + 0.15 * n3(p * 4.3); }
void main() {
  if (vU > uHead) discard;
  vec3 V = normalize(cameraPosition - vW);
  float e = pow(abs(dot(normalize(vN), V)), uEdge);
  float n = fbm(vW * 6.0 + vec3(0.0, -uTime * 0.7, uTime * 0.25));
  float m = fbm(vW * 13.0 + vec3(uTime * 0.3, -uTime * 1.1, 0.0));
  float d = n * 0.65 + m * 0.35;
  float a = uAlpha * e * smoothstep(uDissolve, uDissolve + 0.28, d);
  if (uHead < 2.0) a *= smoothstep(uHead, uHead - 0.1, vU) * smoothstep(0.0, 0.05, vU);
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor * (0.7 + 0.6 * m), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

interface Smoke {
  m: THREE.ShaderMaterial;
  u: {
    uTime: { value: number };
    uAlpha: { value: number };
    uDissolve: { value: number };
    uHead: { value: number };
    uEdge: { value: number };
    uColor: { value: THREE.Color };
  };
}

function smoke(color: string, edge: number): Smoke {
  const u = {
    uTime: { value: 0 },
    uAlpha: { value: 0 },
    uDissolve: { value: 1 },
    uHead: { value: 9 },
    uEdge: { value: edge },
    uColor: { value: new THREE.Color(color) },
  };
  const m = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: SMOKE_VERT,
    fragmentShader: SMOKE_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  return { m, u };
}

function setSmoke(s: Smoke, time: number, alpha: number, dissolve: number, head = 9) {
  s.u.uTime.value = time;
  s.u.uAlpha.value = alpha;
  s.u.uDissolve.value = dissolve;
  s.u.uHead.value = head;
}

type Mats = Record<'tail' | 'tailCore' | 'body' | 'core' | 'dark', Smoke>;

/* The ghost's shape, in its own space (waist at the origin). */
const TORSO: [number, number][] = [
  [0.0, -0.16],
  [0.032, -0.12],
  [0.042, -0.02],
  [0.046, 0.08],
  [0.062, 0.18],
  [0.082, 0.26],
  [0.098, 0.305],
  [0.094, 0.338],
  [0.06, 0.368],
  [0.026, 0.395],
  [0.024, 0.44],
];
const SHOULDER_Y = 0.322;
const UPPER = 0.2;
const FORE = 0.21;
/** Long fingers, each a curve from the knuckle (hand space: hanging along -y, palm toward +z). */
const FINGERS: [number, number, number][][] = [
  [
    [-0.015, -0.03, 0],
    [-0.024, -0.085, 0.012],
    [-0.03, -0.128, 0.032],
  ],
  [
    [-0.005, -0.034, 0],
    [-0.008, -0.095, 0.014],
    [-0.01, -0.145, 0.036],
  ],
  [
    [0.006, -0.034, 0],
    [0.009, -0.094, 0.014],
    [0.012, -0.142, 0.036],
  ],
  [
    [0.016, -0.03, 0],
    [0.025, -0.08, 0.012],
    [0.032, -0.118, 0.03],
  ],
  [
    [0.02, -0.012, 0.008],
    [0.04, -0.05, 0.022],
    [0.046, -0.076, 0.04],
  ],
];

function buildGhost() {
  const pts: THREE.Vector3[] = [];
  const v = new THREE.Vector3();
  for (let i = 0; i <= 90; i++) pts.push(spiral(i / 90, v).clone());
  const path = new THREE.CatmullRomCurve3(pts);
  const line = (len: number) => new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -len, 0));
  const torso = new THREE.LatheGeometry(smoothProfile(TORSO, 40), 32);
  torso.scale(1, 1, 0.58);
  return {
    tail: taper(path, 110, 14, (u) => [tailR(u), tailR(u)]),
    tailCore: taper(path, 110, 10, (u) => [tailR(u) * 0.5, tailR(u) * 0.5]),
    torso,
    sphere: new THREE.SphereGeometry(1, 28, 20),
    upper: taper(line(UPPER), 8, 10, (t) => [0.02 - 0.006 * t, 0.02 - 0.006 * t]),
    fore: taper(
      new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.004, -FORE * 0.5, 0.006), new THREE.Vector3(0, -FORE, 0)]),
      10,
      10,
      (t) => [0.015 - 0.006 * t, 0.015 - 0.006 * t],
    ),
    fingers: FINGERS.map((f) =>
      taper(
        new THREE.CatmullRomCurve3(f.map(([x, y, z]) => new THREE.Vector3(x, y, z))),
        12,
        6,
        (t) => [0.0062 * (1 - t) ** 0.7 + 0.0008, 0.0055 * (1 - t) ** 0.7 + 0.0008],
      ),
    ),
  };
}

let ghostGeo: ReturnType<typeof buildGhost> | null = null;
function ghostParts() {
  ghostGeo ??= buildGhost();
  return ghostGeo;
}

/** A soft round puff for each smoke particle. */
function drawPuff(g: CanvasRenderingContext2D, w: number, h: number) {
  const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.clearRect(0, 0, w, h);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
}

function pointsGeometry(n: number): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 4), 4));
  return g;
}

interface Seed {
  u: number;
  d: THREE.Vector3;
  ph: number;
}

const TAIL_N = 220;
const BODY_N = 150;
const WISP_N = 40;

function tailSeeds(): Seed[] {
  const r = seeded(404);
  return Array.from({ length: TAIL_N }, (_, i) => ({
    u: (i + r()) / TAIL_N,
    d: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(0.3 + r() * 0.9),
    ph: r() * Math.PI * 2,
  }));
}

/** Points inside the ghost's chest, shoulders and head, where the thickest smoke hangs. */
function bodySeeds(): Seed[] {
  const r = seeded(77);
  const blobs: [number, number, number, number, number, number][] = [
    [0, 0.17, 0, 0.08, 0.2, 0.06],
    [0, 0.31, 0, 0.12, 0.05, 0.06],
    [0, 0.6, 0.01, 0.08, 0.13, 0.08],
  ];
  return Array.from({ length: BODY_N }, (_, i) => {
    const [cx, cy, cz, rx, ry, rz] = blobs[i % 3]!;
    const d = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(Math.cbrt(r()));
    return { u: 0, d: new THREE.Vector3(cx + d.x * rx, cy + d.y * ry, cz + d.z * rz), ph: r() * Math.PI * 2 };
  });
}

const tv = new THREE.Vector3();

/** The puffs in the tail, flowing up it while it pours, rushing back down it when it is sucked in. */
function updateTail(geo: THREE.BufferGeometry, seeds: Seed[], st: GhostState, t: number, clock: number) {
  const p = (geo.attributes.position as THREE.BufferAttribute).array as Float32Array;
  const c = (geo.attributes.color as THREE.BufferAttribute).array as Float32Array;
  const flow = t < TAKE.leaned ? 0.16 * t : 0.16 * TAKE.leaned - (t - TAKE.leaned) * 1.5;
  seeds.forEach((sd, i) => {
    const u = fract(sd.u + flow);
    spiral(u, tv);
    const r = tailR(u) * 1.35;
    p[i * 3] = tv.x + sd.d.x * r + Math.sin(clock * 1.1 + sd.ph) * 0.01;
    p[i * 3 + 1] = tv.y + sd.d.y * r + Math.sin(clock * 0.8 + sd.ph * 2) * 0.01;
    p[i * 3 + 2] = tv.z + sd.d.z * r;
    const a = st.on ? smooth((st.head - u) / 0.06) * smooth(u / 0.04) : 0;
    c.set([0.56, 0.62, 0.55, a * 0.2], i * 4);
  });
  geo.attributes.position!.needsUpdate = true;
  geo.attributes.color!.needsUpdate = true;
}

/** The puffs hanging in the ghost's body, churning slowly. */
function updateBody(geo: THREE.BufferGeometry, seeds: Seed[], st: GhostState, clock: number) {
  const p = (geo.attributes.position as THREE.BufferAttribute).array as Float32Array;
  const c = (geo.attributes.color as THREE.BufferAttribute).array as Float32Array;
  const a = 0.1 * st.form * (1 - smooth((st.suck - 0.6) / 0.4));
  seeds.forEach((sd, i) => {
    p[i * 3] = sd.d.x + Math.sin(clock * 0.9 + sd.ph) * 0.014;
    p[i * 3 + 1] = sd.d.y + Math.sin(clock * 0.6 + sd.ph * 1.3) * 0.02;
    p[i * 3 + 2] = sd.d.z + Math.cos(clock * 0.7 + sd.ph) * 0.012;
    c.set([0.66, 0.72, 0.64, a], i * 4);
  });
  geo.attributes.position!.needsUpdate = true;
  geo.attributes.color!.needsUpdate = true;
}

/** Arm poses, [shoulder x, shoulder z, elbow x, elbow z, wrist x]: arms in, spread, reaching for you. */
const ARM_IN = [0.1, 0.22, -0.9, 0.1, 0.2];
const ARM_OUT = [-0.25, 1.0, -0.8, 0.25, -0.3];
const ARM_REACH = [-1.28, 0.3, -0.3, 0.0, 0.35];

interface GhostRefs {
  root: THREE.Group | null;
  head: THREE.Group | null;
  jaw: THREE.Group | null;
  mouth: THREE.Mesh | null;
  light: THREE.PointLight | null;
  shoulders: (THREE.Group | null)[];
  elbows: (THREE.Group | null)[];
  wrists: (THREE.Group | null)[];
}

type Part = 'head' | 'jaw' | 'mouth' | 'shoulders' | 'elbows' | 'wrists';
/** Hands a part of the ghost, as it mounts, to the ghost that moves it. */
type Bind = (o: THREE.Object3D | null, part: Part, k?: number) => void;

function bindPart(r: GhostRefs, o: THREE.Object3D | null, part: Part, k: number) {
  if (part === 'mouth') r.mouth = o instanceof THREE.Mesh ? o : null;
  else if (part === 'head' || part === 'jaw') r[part] = o instanceof THREE.Group ? o : null;
  else r[part][k] = o instanceof THREE.Group ? o : null;
}

/** Every frame of the Take, from the time since it (outside the component). */
function driveGhost(r: GhostRefs, mats: Mats, st: GhostState, clock: number) {
  setSmoke(mats.tail, clock, st.on ? 0.42 : 0, 0.3, st.head);
  setSmoke(mats.tailCore, clock, st.on ? 0.5 : 0, 0.36, st.head);
  const fade = 1 - smooth((st.suck - 0.6) / 0.4);
  setSmoke(mats.body, clock, 0.42 * st.form * fade, 0.85 - 0.62 * st.form);
  setSmoke(mats.core, clock, 0.5 * st.form * fade, 0.9 - 0.6 * st.form);
  setSmoke(mats.dark, clock, 0.92 * st.eyes * fade, 0.12);
  const g = r.root;
  if (!g) return;
  g.visible = st.on && st.form > 0.001;
  spiral(Math.max(0, st.head), tv);
  g.position.copy(tv);
  const sc = 0.9 * (0.55 + 0.45 * st.form) * (1 - 0.93 * st.suck);
  // drawn out thin as it goes back down the tail
  g.scale.set(sc * (1 - 0.3 * st.suck), sc * (1 + 0.6 * st.suck), sc);
  const still = 1 - st.suck;
  g.rotation.set(0.6 * st.lean * still, 0.08 * Math.sin(clock * 0.4) * st.form, 0.05 * Math.sin(clock * 0.7) * st.form);
  if (r.head) r.head.rotation.set(-0.42 * st.lean * still, 0, 0.06 * Math.sin(clock * 0.5));
  if (r.jaw) r.jaw.rotation.x = 0.12 + 0.36 * st.lean;
  if (r.mouth) {
    r.mouth.scale.set(0.022 * (1 + 0.4 * st.lean), 0.034 * (1 + 1.5 * st.lean), 0.016);
    r.mouth.position.y = -0.058 - 0.022 * st.lean;
  }
  if (r.light) r.light.intensity = 0.7 * st.form * fade;
  const pose = ARM_IN.map((a, i) => {
    const b = a + (ARM_OUT[i]! - a) * st.form;
    return b + (ARM_REACH[i]! - b) * st.lean;
  });
  for (let k = 0; k < 2; k++) {
    const sway = Math.sin(clock * 0.9 + k * 2) * 0.05;
    r.shoulders[k]?.rotation.set(pose[0]! + sway, 0, pose[1]!);
    r.elbows[k]?.rotation.set(pose[2]! - sway, 0, pose[3]!);
    r.wrists[k]?.rotation.set(pose[4]!, 0, Math.sin(clock * 1.3 + k) * 0.08);
  }
}

/** A part of the ghost in smoke: an outer shell and a denser core inside it. */
function SmokePart({
  geometry,
  mats,
  core = [0.68, 0.68, 0.68],
  ...t
}: {
  geometry: THREE.BufferGeometry;
  mats: Mats;
  core?: [number, number, number];
  position?: [number, number, number];
  scale?: [number, number, number] | number;
  rotation?: [number, number, number];
}) {
  return (
    <group {...t}>
      <mesh geometry={geometry} material={mats.body.m} renderOrder={2} />
      <mesh geometry={geometry} material={mats.core.m} renderOrder={2} scale={core} />
    </group>
  );
}

/** Hollows in the smoke: eye sockets, the nose, the mouth (dark, soft-edged). */
function Hollow({ mats, ...t }: { mats: Mats; position: [number, number, number]; scale: [number, number, number] }) {
  return <mesh geometry={ghostParts().sphere} material={mats.dark.m} renderOrder={4} {...t} />;
}

/** One of the long arms: shoulder, elbow, wrist, and a hand of long thin fingers. */
function Arm({ k, mats, bind }: { k: number; mats: Mats; bind: Bind }) {
  const g = ghostParts();
  return (
    <group scale-x={k ? -1 : 1}>
      <group position={[0.095, SHOULDER_Y, 0]} ref={(o) => bind(o, 'shoulders', k)}>
        <SmokePart geometry={g.upper} mats={mats} core={[0.6, 1, 0.6]} />
        <group position-y={-UPPER} ref={(o) => bind(o, 'elbows', k)}>
          <SmokePart geometry={g.fore} mats={mats} core={[0.6, 1, 0.6]} />
          <group position-y={-FORE} ref={(o) => bind(o, 'wrists', k)}>
            <SmokePart geometry={g.sphere} mats={mats} position={[0, -0.02, 0.004]} scale={[0.022, 0.03, 0.011]} />
            {g.fingers.map((f, i) => (
              <mesh key={i} geometry={f} material={mats.body.m} renderOrder={2} />
            ))}
          </group>
        </group>
      </group>
    </group>
  );
}

/** The long skull of a face: a cranium, long cheeks, a hanging jaw, black hollows. */
function Head({ mats, bind }: { mats: Mats; bind: Bind }) {
  const g = ghostParts();
  return (
    <group position={[0, 0.52, 0.01]} ref={(o) => bind(o, 'head')}>
      <SmokePart geometry={g.sphere} mats={mats} position={[0, 0.1, -0.012]} scale={[0.074, 0.084, 0.084]} />
      <SmokePart geometry={g.sphere} mats={mats} position={[0, 0.02, 0.014]} scale={[0.064, 0.118, 0.074]} />
      <group position={[0, -0.03, -0.01]} ref={(o) => bind(o, 'jaw')}>
        <SmokePart geometry={g.sphere} mats={mats} position={[0, -0.07, 0.028]} scale={[0.048, 0.05, 0.054]} />
      </group>
      <Hollow mats={mats} position={[-0.03, 0.046, 0.062]} scale={[0.021, 0.03, 0.018]} />
      <Hollow mats={mats} position={[0.03, 0.046, 0.062]} scale={[0.021, 0.03, 0.018]} />
      <Hollow mats={mats} position={[0, 0.0, 0.074]} scale={[0.007, 0.014, 0.008]} />
      {/* sunken cheeks */}
      <Hollow mats={mats} position={[-0.042, -0.018, 0.05]} scale={[0.014, 0.03, 0.012]} />
      <Hollow mats={mats} position={[0.042, -0.018, 0.05]} scale={[0.014, 0.03, 0.012]} />
      <mesh
        ref={(o) => bind(o, 'mouth')}
        geometry={g.sphere}
        material={mats.dark.m}
        renderOrder={4}
        position={[0, -0.058, 0.064]}
        scale={[0.022, 0.034, 0.016]}
      />
    </group>
  );
}

/**
 * The Take. Not a genie: thick grey-green smoke pours out of the spout and coils up over the lamp
 * in a spiral tail, and the top of it becomes a gaunt ghost, long arms, long fingers, a long
 * skull of a face with black hollow eyes and a mouth hanging open. It leans down at you, reaching,
 * the mouth stretching wider, then is sucked back down its own tail into the spout, and is gone.
 */
function GenieGhost({ since }: { since: () => number }) {
  const g = ghostParts();
  const mats = useMemo<Mats>(
    () => ({
      tail: smoke('#7d8b7a', 1.4),
      tailCore: smoke('#98a593', 1.0),
      body: smoke('#a7b4a2', 1.6),
      core: smoke('#c2ccbc', 1.2),
      dark: smoke('#030404', 0.7),
    }),
    [],
  );
  useEffect(() => () => Object.values(mats).forEach((s) => s.m.dispose()), [mats]);
  const puff = useCanvasTexture(64, 64, drawPuff, []);
  const tailPts = useMemo(() => pointsGeometry(TAIL_N), []);
  const bodyPts = useMemo(() => pointsGeometry(BODY_N), []);
  const tSeeds = useMemo(() => tailSeeds(), []);
  const bSeeds = useMemo(() => bodySeeds(), []);
  useEffect(
    () => () => {
      tailPts.dispose();
      bodyPts.dispose();
    },
    [tailPts, bodyPts],
  );
  const refs = useRef<GhostRefs>({ root: null, head: null, jaw: null, mouth: null, light: null, shoulders: [], elbows: [], wrists: [] });
  const bind: Bind = (o, part, k = 0) => bindPart(refs.current, o, part, k);
  useFrame((state) => {
    const s = since();
    const t = s === Infinity ? 99 : s;
    const st = ghostState(s);
    const clock = state.clock.elapsedTime;
    driveGhost(refs.current, mats, st, clock);
    updateTail(tailPts, tSeeds, st, t, clock);
    updateBody(bodyPts, bSeeds, st, clock);
  });
  return (
    <group>
      <mesh geometry={g.tail} material={mats.tail.m} renderOrder={1} />
      <mesh geometry={g.tailCore} material={mats.tailCore.m} renderOrder={1} />
      <points geometry={tailPts} renderOrder={3}>
        <pointsMaterial map={puff} size={0.16} sizeAttenuation vertexColors transparent depthWrite={false} />
      </points>
      <group
        ref={(o) => {
          refs.current.root = o;
        }}
        visible={false}
      >
        <SmokePart geometry={g.torso} mats={mats} core={[0.6, 0.95, 0.6]} />
        {/* the shoulders, bony knobs under the smoke */}
        {[-1, 1].map((s) => (
          <SmokePart key={s} geometry={g.sphere} mats={mats} position={[s * 0.088, SHOULDER_Y + 0.004, 0]} scale={[0.03, 0.022, 0.026]} />
        ))}
        <Head mats={mats} bind={bind} />
        <Arm k={0} mats={mats} bind={bind} />
        <Arm k={1} mats={mats} bind={bind} />
        <points geometry={bodyPts} renderOrder={3}>
          <pointsMaterial map={puff} size={0.14} sizeAttenuation vertexColors transparent depthWrite={false} />
        </points>
        <pointLight
          ref={(o) => {
            refs.current.light = o;
          }}
          position={[0, 0.5, 0.25]}
          color="#9fb89a"
          intensity={0}
          distance={2.2}
        />
      </group>
    </group>
  );
}

/** Thin smoke curling off the spout mouth: `k` is how much there is (0..1), `clock` drives it. */
function updateWisp(geo: THREE.BufferGeometry, k: number, clock: number) {
  const p = (geo.attributes.position as THREE.BufferAttribute).array as Float32Array;
  const c = (geo.attributes.color as THREE.BufferAttribute).array as Float32Array;
  for (let i = 0; i < WISP_N; i++) {
    const age = fract(clock / 3.4 + i / WISP_N);
    const curl = age * 6 + clock * 0.7 + i * 0.3;
    p[i * 3] = MOUTH_DIR.x * 0.02 - age * 0.07 + Math.sin(curl) * 0.022 * age;
    p[i * 3 + 1] = MOUTH_DIR.y * 0.02 + age * 0.34;
    p[i * 3 + 2] = Math.cos(curl * 0.8) * 0.016 * age;
    c.set([0.62, 0.64, 0.6, k * 0.13 * Math.sin(Math.PI * age)], i * 4);
  }
  geo.attributes.position!.needsUpdate = true;
  geo.attributes.color!.needsUpdate = true;
}

/**
 * Smoke from the spout. 'idle' (haunted, not taken): a faint wisp now and then, as if something
 * inside breathed out. 'after' (taken): once the ghost is back in, a thin thread that never stops.
 */
function SpoutWisp({ mode, since }: { mode: 'idle' | 'after'; since: () => number }) {
  const puff = useCanvasTexture(64, 64, drawPuff, []);
  const geo = useMemo(() => pointsGeometry(WISP_N), []);
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame((state) => {
    const still = reducedMotion();
    const clock = still ? 1.7 : state.clock.elapsedTime;
    let k: number;
    if (mode === 'idle') {
      const c = (clock % 11) / 11;
      k = still ? 0.45 : c < 0.45 ? Math.sin((c / 0.45) * Math.PI) : 0;
    } else {
      const s = since();
      k = s === Infinity ? 0.6 : 0.6 * progress(s, 0.6, TAKE.gone - 0.3);
    }
    updateWisp(geo, k, clock);
  });
  return (
    <points geometry={geo} position={MOUTH} renderOrder={3}>
      <pointsMaterial map={puff} size={0.07} sizeAttenuation vertexColors transparent depthWrite={false} />
    </points>
  );
}

/**
 * Brass wishing lamp (oil-lamp): the genie lamp of the stories, a squat oval teardrop of polished
 * brass on a footed ring, a long curved spout to the wick, a scrolled ribbon handle, a domed lid,
 * engraved bands, a red glass stone on its belly and a red bow with holly tied to the handle.
 * After the Reveal the brass is tarnished nearly black, the mouth of the spout is sooted, and now
 * and then a thin wisp curls out of it. Taken: the lid rattles, and what comes out is a ghost.
 */
export default function OilLamp() {
  const haunted = useHaunted();
  const { taken, since } = useTaken('oil-lamp');
  const lid = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  useFrame(() => poseLid(lid.current, body.current, taken ? since() : -1));
  return (
    <group position-y={-0.62} rotation-y={-0.35} scale={1.05}>
      <group position-x={-0.12}>
        <group ref={body}>
          <LampBody haunted={haunted} />
          <group ref={lid} position={[-0.12, 0.372, 0]}>
            <Lid />
          </group>
          {haunted && !taken && <SpoutWisp mode="idle" since={since} />}
          {taken && (
            <>
              <GenieGhost since={since} />
              <SpoutWisp mode="after" since={since} />
            </>
          )}
        </group>
        {/* not drawn: the space the ghost fills over the lamp, so the product view frames it */}
        {haunted && (
          <mesh position={[0.22, 1.08, 0.2]}>
            <boxGeometry args={[1.35, 1.2, 0.9]} />
            <meshBasicMaterial visible={false} />
          </mesh>
        )}
      </group>
    </group>
  );
}
