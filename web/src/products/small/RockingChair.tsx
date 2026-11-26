import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mat } from '../../gl/decay';
import { M } from '../../gl/materials';
import { useTaken } from '../../gl/useTaken';

/*
 * An old Victorian rocking chair, deep and reclined, built for sleeping in: long curved rockers,
 * turned legs, a seat and a tall leaning back of thin plain cloth stretched on the frame (a
 * sling, no foam), scrolled arms and a carved crest rail. Chair space: x forward, y up, z across.
 */

/** Radius of the rockers' curve; the chair rolls on it like a real rocker. */
const R = 1.6;
/** How far back the back leans from upright (rad): far enough to lie back in. */
const RECLINE = 0.5;
/** The seat's frame: front and back edges (x), heights there (y), half width (z). */
const SEAT_FRONT = 0.3;
const SEAT_BACK = -0.26;
const SEAT_Y_FRONT = 0.56;
const SEAT_Y_BACK = 0.5;
const HALF_W = 0.28;
/** The back's cloth: how tall, and where its bottom edge is. */
const BACK_H = 0.86;
const BACK_W = 0.5;
const SEAT_TILT = Math.atan2(SEAT_Y_FRONT - SEAT_Y_BACK, SEAT_FRONT - SEAT_BACK);

/** Height of the rockers' underside at x (they touch the floor at x = 0). */
function rockerY(x: number) {
  return R - Math.sqrt(R * R - x * x);
}

/** A turned rod (spindle, leg, post) from a to b, with a bead a third of the way along. */
function Rod({ a, b, r, bead = false }: { a: [number, number, number]; b: [number, number, number]; r: number; bead?: boolean }) {
  const { pos, quat, len } = useMemo(() => {
    const va = new THREE.Vector3(...a);
    const d = new THREE.Vector3(...b).sub(va);
    return {
      pos: va.clone().addScaledVector(d, 0.5),
      quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()),
      len: d.length(),
    };
  }, [a, b]);
  return (
    <group position={pos} quaternion={quat}>
      <mesh material={M.wood()}>
        <cylinderGeometry args={[r, r * 1.12, len, 14]} />
      </mesh>
      {bead && (
        <>
          <mesh material={M.wood()} position-y={len * 0.18}>
            <sphereGeometry args={[r * 1.55, 14, 10]} />
          </mesh>
          <mesh material={M.wood()} position-y={-len * 0.22}>
            <torusGeometry args={[r * 1.15, r * 0.4, 8, 16]} />
          </mesh>
        </>
      )}
    </group>
  );
}

/** A wooden member bent along a curve (rockers, arms, the crest rail). */
function Bent({ pts, r }: { pts: [number, number, number][]; r: number }) {
  const geo = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 64, r, 10, false), [pts, r]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} material={M.wood()} />;
}

/**
 * The chair's cloth: plain, thin and soft, in the old gold of "Every night, rocking her to sleep"
 * (the shop's aged brass), a mid tone with a soft sheen so every hollow pressed into it shows.
 * After the Reveal it darkens, greys and wears through.
 */
function cloth(): THREE.MeshPhysicalMaterial {
  return mat('chairClothGold', {
    surface: 'fabric',
    color: '#a8894e',
    roughness: 0.86,
    sheen: 0.6,
    sheenColor: '#f0d9a0',
    hauntedColor: '#6e5836',
    side: THREE.DoubleSide,
    decay: { age: 0.45, dust: 0.4, tear: 0.06 },
  });
}

/** A dent pressed into the cloth: centre (u, v) on it, spread, depth. */
type Dent = [number, number, number, number];

/**
 * A panel of thin cloth stretched across the frame: it hangs a little slack in the middle and
 * gives where weight rests on it, in soft hollows with the creases cloth makes as it is pulled
 * down into them. `w` × `h` in its own plane (u across, v along); it sinks along -normal.
 */
function Sling({ w, h, sag, dents, press, repeat }: { w: number; h: number; sag: number; dents: Dent[]; press: { current: number }; repeat: [number, number] }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(w, h, 44, 52);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * repeat[0], uv.getY(i) * repeat[1]);
    return g;
  }, [w, h, repeat]);
  useEffect(() => () => geo.dispose(), [geo]);
  const mesh = useRef<THREE.Mesh>(null);
  const last = useRef(-1);
  useFrame(() => {
    const g = mesh.current?.geometry;
    const k = press.current;
    if (!g || Math.abs(k - last.current) < 0.002) return;
    last.current = k;
    shapeSling(g, w, h, sag, dents, k);
  });
  return <mesh ref={mesh} geometry={geo} material={cloth()} />;
}

/** Outside the component, so the React compiler rules see no mutation of hook values. */
function shapeSling(g: THREE.BufferGeometry, w: number, h: number, sag: number, dents: Dent[], k: number) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i);
    const v = pos.getY(i);
    // slack: it bows between the rails, most in the middle, nothing at the tacked edges
    const eu = 1 - (2 * u / w) ** 2;
    const ev = 1 - (2 * v / h) ** 2;
    let z = -sag * eu * (0.35 + 0.65 * ev);
    for (const [du0, dv0, s, depth] of dents) {
      const du = u - du0;
      const dv = v - dv0;
      const r2 = (du * du + dv * dv) / (s * s);
      const hollow = depth * Math.exp(-r2);
      // creases fanning out from the hollow where the cloth is drawn into it
      const r = Math.sqrt(r2);
      const crease = depth * 0.16 * Math.sin(Math.atan2(dv, du) * 9 + du0 * 20) * Math.exp(-((r - 1.25) ** 2) / 0.35);
      z -= (hollow + crease) * k * Math.min(1, eu * 4) * Math.min(1, ev * 4);
    }
    pos.setZ(i, z);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
}

// The shape of someone lying back in it: hips sunk deep at the back of the seat, the thighs
// shallower toward the front; in the back, the small of the back, both shoulder blades, and
// the head resting near the top.
const SEAT_DENTS: Dent[] = [
  [-0.1, -0.08, 0.11, 0.07],
  [0.1, -0.08, 0.11, 0.07],
  [-0.09, 0.12, 0.08, 0.04],
  [0.09, 0.12, 0.08, 0.04],
];
const BACK_DENTS: Dent[] = [
  [0, -0.24, 0.13, 0.04],
  [-0.12, 0.05, 0.1, 0.055],
  [0.12, 0.05, 0.1, 0.055],
  [0, 0.31, 0.08, 0.05],
];

/**
 * An old rocking chair, deep and reclined, upholstered in thin old-gold cloth. After the Reveal
 * it is grey and worn; taken, it starts to rock on its own and never stops, slow and even, and
 * the cloth gives as if someone lay back in it: the seat sinks under the hips and thighs, the
 * back under the shoulders, and the head rests near the top. No one is there.
 */
export function RockingChair() {
  const { taken, since } = useTaken('rocking-chair');
  const rock = useRef<THREE.Group>(null);
  // How hard the one who is not there presses into the cloth (0..1).
  const seat = useRef(0);
  const back = useRef(0);
  useFrame(() => {
    const g = rock.current;
    if (!g) return;
    const s = since();
    // Rolling on the rocker: tilt by θ about the arc's centre (which slides by R·θ).
    const ramp = taken ? Math.min(1, s === Infinity ? 1 : s / 1.2) : 0;
    const th = taken ? Math.sin((s === Infinity ? performance.now() / 1000 : s) * 1.5) * 0.17 * ramp : 0;
    g.rotation.z = th;
    g.position.x = R * Math.sin(th) - R * th;
    g.position.y = R - R * Math.cos(th);
    // It sits down first, then lies back; as the chair rocks back the weight shifts onto the
    // back, and forward onto the seat.
    const t = s === Infinity ? 9 : s;
    const sat = taken ? Math.min(1, t / 0.9) : 0;
    const lean = taken ? Math.min(1, Math.max(0, (t - 0.6) / 1.1)) : 0;
    const sway = th / 0.17;
    seat.current = sat * (1 + 0.1 * sway);
    back.current = lean * (1 - 0.25 * sway);
  });
  const rocker = useMemo<[number, number, number][]>(
    () => [-0.78, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.52, 0.58].map((x) => [x, rockerY(x) + 0.035, 0]),
    [],
  );
  const arm = useMemo<[number, number, number][]>(
    () => [
      [-0.44, 0.84, 0],
      [-0.2, 0.82, 0],
      [0.12, 0.8, 0],
      [0.34, 0.79, 0],
      [0.41, 0.75, 0],
      [0.38, 0.7, 0],
      [0.33, 0.72, 0],
    ],
    [],
  );
  // the crest rail along the top of the back, rising in a shallow arch in the middle
  const top = backPoint(BACK_H + 0.04);
  const crest = useMemo<[number, number, number][]>(
    () => [-1, -0.5, 0, 0.5, 1].map((k) => [top.x - 0.012 * (1 - k * k), top.y + 0.05 * (1 - k * k), k * (HALF_W + 0.01)]),
    [top.x, top.y],
  );
  const seatMid: [number, number, number] = [(SEAT_FRONT + SEAT_BACK) / 2, (SEAT_Y_FRONT + SEAT_Y_BACK) / 2, 0];
  const backBase = backPoint(0);
  return (
    <group rotation={[0.1, -1.05, 0]} position-y={-0.6} scale={0.72}>
      <group ref={rock}>
        {[-HALF_W + 0.02, HALF_W - 0.02].map((z) => (
          <group key={z} position-z={z}>
            <Bent pts={rocker} r={0.034} />
          </group>
        ))}
        {/* legs, from the rockers up to the seat frame */}
        {[-HALF_W + 0.02, HALF_W - 0.02].map((z) => (
          <group key={`l${z}`}>
            <Rod a={[SEAT_FRONT, rockerY(SEAT_FRONT) + 0.05, z]} b={[SEAT_FRONT, SEAT_Y_FRONT, z * 1.02]} r={0.026} bead />
            <Rod a={[SEAT_BACK, rockerY(SEAT_BACK) + 0.05, z]} b={[SEAT_BACK, SEAT_Y_BACK, z * 1.02]} r={0.026} bead />
            {/* a stretcher between them, low down */}
            <Rod a={[SEAT_BACK, 0.22, z]} b={[SEAT_FRONT, 0.24, z]} r={0.014} />
          </group>
        ))}
        <Rod a={[SEAT_FRONT, 0.24, -HALF_W]} b={[SEAT_FRONT, 0.24, HALF_W]} r={0.014} />
        {/* the seat frame: side rails, front and back rails */}
        {[-HALF_W, HALF_W].map((z) => (
          <Rod key={`s${z}`} a={[SEAT_BACK - 0.02, SEAT_Y_BACK, z]} b={[SEAT_FRONT + 0.03, SEAT_Y_FRONT, z]} r={0.024} />
        ))}
        <Rod a={[SEAT_FRONT + 0.03, SEAT_Y_FRONT, -HALF_W - 0.02]} b={[SEAT_FRONT + 0.03, SEAT_Y_FRONT, HALF_W + 0.02]} r={0.026} />
        <Rod a={[SEAT_BACK - 0.02, SEAT_Y_BACK, -HALF_W - 0.02]} b={[SEAT_BACK - 0.02, SEAT_Y_BACK, HALF_W + 0.02]} r={0.024} />
        {/* the cloth seat, slung between the rails, tilted back a little */}
        {/* (the sling's u runs across the chair, v from back to front, its face up) */}
        <group position={seatMid} rotation-z={SEAT_TILT}>
          <group rotation-x={-Math.PI / 2}>
            <group rotation-z={-Math.PI / 2}>
              <Sling w={0.5} h={SEAT_FRONT - SEAT_BACK} sag={0.03} dents={SEAT_DENTS} press={seat} repeat={[1.4, 1.2]} />
            </group>
          </group>
        </group>
        {/* brass tacks along the front rail, where the cloth is nailed */}
        {Array.from({ length: 11 }, (_, i) => (
          <mesh key={i} material={M.brass()} position={[SEAT_FRONT + 0.055, SEAT_Y_FRONT + 0.004, -0.25 + i * 0.05]} rotation-z={-Math.PI / 2}>
            <sphereGeometry args={[0.009, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
        ))}
        {/* the back posts, leaning well back, and the cloth slung between them */}
        {[-HALF_W, HALF_W].map((z) => (
          <Rod key={`p${z}`} a={[SEAT_BACK, SEAT_Y_BACK - 0.02, z]} b={[top.x, top.y + 0.04, z]} r={0.028} />
        ))}
        <group position={[backBase.x, backBase.y, 0]} rotation-z={RECLINE}>
          <group position-y={BACK_H / 2 + 0.02} rotation-y={Math.PI / 2}>
            {/* (u across, v up the back, its face to the front; it gives backward) */}
            <Sling w={BACK_W} h={BACK_H} sag={0.035} dents={BACK_DENTS} press={back} repeat={[1.4, 2]} />
          </group>
        </group>
        <Bent pts={crest} r={0.03} />
        {/* the scrolled arms, on turned spindles */}
        {[-HALF_W - 0.03, HALF_W + 0.03].map((z) => (
          <group key={`a${z}`}>
            <group position-z={z}>
              <Bent pts={arm} r={0.024} />
            </group>
            <Rod a={[SEAT_FRONT - 0.02, SEAT_Y_FRONT, z]} b={[SEAT_FRONT + 0.01, 0.78, z]} r={0.018} bead />
            <Rod a={[0.02, SEAT_Y_FRONT - 0.03, z]} b={[0.04, 0.8, z]} r={0.011} />
            <Rod a={[-0.12, SEAT_Y_FRONT - 0.04, z]} b={[-0.12, 0.81, z]} r={0.011} />
          </group>
        ))}
      </group>
    </group>
  );
}

/** A point on the back's centre line, `along` up its length from its foot. */
function backPoint(along: number): { x: number; y: number } {
  return { x: SEAT_BACK - 0.01 - Math.sin(RECLINE) * along, y: SEAT_Y_BACK + 0.02 + Math.cos(RECLINE) * along };
}
