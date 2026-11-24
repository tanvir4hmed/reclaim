import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { M } from '../../gl/materials';
import { useTaken } from '../../gl/useTaken';

/** Radius of the rockers' curve; the chair rolls on it like a real rocker. */
const R = 1.6;

/** A cylinder (spindle, leg, post) from a to b. */
function Rod({ a, b, r }: { a: [number, number, number]; b: [number, number, number]; r: number }) {
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
    <mesh material={M.wood()} position={pos} quaternion={quat}>
      <cylinderGeometry args={[r, r * 1.1, len, 12]} />
    </mesh>
  );
}

/** A dent pressed into a cushion: centre (u, v) on its face, spread, depth. */
type Dent = [number, number, number, number];

/**
 * A padded cushion that can be pressed in. `axis` is the face that takes the weight ('y' top,
 * 'x' front); `uv` names the two other axes the dents are placed on. Each frame the face's
 * vertices sink by the sum of the dents times `press`.
 */
function Cushion({
  size,
  segs,
  axis,
  dents,
  press,
  ...place
}: {
  size: [number, number, number];
  segs: [number, number, number];
  axis: 'x' | 'y';
  dents: Dent[];
  press: { current: number };
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  const geo = useMemo(() => new THREE.BoxGeometry(...size, ...segs), [size, segs]);
  const mesh = useRef<THREE.Mesh>(null);
  const rest = useRef<Float32Array | null>(null);
  const last = useRef(-1);
  useFrame(() => {
    const k = press.current;
    const g = mesh.current?.geometry;
    if (!g || Math.abs(k - last.current) < 0.002) return;
    last.current = k;
    const pos = g.attributes.position as THREE.BufferAttribute;
    const a = pos.array as Float32Array;
    // the cushion as it was made, before anyone sat in it
    rest.current ??= Float32Array.from(a);
    const base = rest.current;
    const ai = axis === 'y' ? 1 : 0;
    const [ui, vi] = axis === 'y' ? [0, 2] : [1, 2];
    for (let i = 0; i < pos.count; i++) {
      const o = i * 3;
      a[o] = base[o]!;
      a[o + 1] = base[o + 1]!;
      a[o + 2] = base[o + 2]!;
      if (base[o + ai]! <= 0) continue;
      let d = 0;
      for (const [u, v, s, depth] of dents) {
        const du = base[o + ui]! - u;
        const dv = base[o + vi]! - v;
        d += depth * Math.exp(-(du * du + dv * dv) / (s * s));
      }
      a[o + ai] = base[o + ai]! - d * k;
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
  });
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh ref={mesh} geometry={geo} material={M.upholstery()} {...place} />;
}

/**
 * Upholstery, not foam: a thin pad covered in woven cloth, finished with a corded piping round
 * its edge and a row of brass tacks, as an old chair is. `w` × `d` in the plane it lies in.
 */
function Piping({ w, d, position, rotation }: { w: number; d: number; position: [number, number, number]; rotation?: [number, number, number] }) {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    const r = 0.04;
    s.moveTo(-w / 2 + r, -d / 2);
    s.lineTo(w / 2 - r, -d / 2);
    s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
    s.lineTo(w / 2, d / 2 - r);
    s.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
    s.lineTo(-w / 2 + r, d / 2);
    s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
    s.lineTo(-w / 2, -d / 2 + r);
    s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
    const pts = s.getSpacedPoints(80).map((p) => new THREE.Vector3(p.x, 0, p.y));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 160, 0.011, 8, true);
  }, [w, d]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} material={M.upholstery()} position={position} rotation={rotation} />;
}

const SEAT: { size: [number, number, number]; segs: [number, number, number] } = { size: [0.64, 0.06, 0.54], segs: [32, 1, 28] };
const BACK: typeof SEAT = { size: [0.05, 0.72, 0.42], segs: [1, 32, 22] };
const ARM: typeof SEAT = { size: [0.42, 0.026, 0.075], segs: [18, 1, 4] };

// The shape of someone sitting: two hollows under the hips, shallower under the thighs; the
// shoulder blades and the small of the back in the back. Deep enough to read at product-view
// distance, but inside the thin upholstered pads (0.045 and 0.04 thick).
const SEAT_DENTS: Dent[] = [
  [-0.1, -0.1, 0.1, 0.048],
  [-0.1, 0.1, 0.1, 0.048],
  [0.12, -0.09, 0.08, 0.03],
  [0.12, 0.09, 0.08, 0.03],
];
const BACK_DENTS: Dent[] = [
  [0.12, -0.1, 0.09, 0.04],
  [0.12, 0.1, 0.09, 0.04],
  [-0.16, 0, 0.11, 0.032],
];
const ARM_DENTS: Dent[] = [
  [0.14, 0, 0.05, 0.016],
  [-0.06, 0, 0.08, 0.01],
];

/**
 * An old oak rocking chair: curved rockers, turned legs, a spindle back with a carved top rail,
 * arms, worn velvet cushions. After the Reveal it is grey and split; taken, it starts to rock on
 * its own and never stops, slow and even, and the cushions press in as if someone sat down:
 * two hollows in the seat, shoulders against the back, hands gripping both arms. No one is there.
 */
export function RockingChair() {
  const { taken, since } = useTaken('rocking-chair');
  const rock = useRef<THREE.Group>(null);
  // How hard the one who is not there presses into the cushions (0..1).
  const seat = useRef(0);
  const back = useRef(0);
  const grip = useRef(0);
  const rocker = useMemo(() => {
    // An arc of the circle of radius R under the chair, as a flat curved runner.
    const g = new THREE.TorusGeometry(R, 0.035, 8, 48, 0.62);
    g.rotateZ(-Math.PI / 2 - 0.31);
    g.translate(0, R, 0);
    return g;
  }, []);
  useFrame(() => {
    const g = rock.current;
    if (!g) return;
    const s = since();
    // Rolling on the rocker: tilt by θ about the arc's centre (which slides by R·θ).
    const ramp = taken ? Math.min(1, s === Infinity ? 1 : s / 1.2) : 0;
    const th = taken ? Math.sin((s === Infinity ? performance.now() / 1000 : s) * 1.7) * 0.2 * ramp : 0;
    g.rotation.z = th;
    g.position.x = R * Math.sin(th) - R * th;
    g.position.y = R - R * Math.cos(th);
    // It sits down first, then leans back and takes hold of the arms; as the chair rocks back
    // the weight shifts onto the back, and forward onto the seat and the hands.
    const sat = taken ? Math.min(1, (s === Infinity ? 9 : s) / 0.9) : 0;
    const lean = taken ? Math.min(1, Math.max(0, ((s === Infinity ? 9 : s) - 0.6) / 0.9)) : 0;
    const sway = th / 0.2;
    seat.current = sat * (1 + 0.12 * sway);
    back.current = lean * (1 - 0.3 * sway);
    grip.current = lean * (1 + 0.25 * sway);
  });
  const legs: [number, number][] = [
    [-0.32, -0.26],
    [0.32, -0.26],
    [-0.32, 0.26],
    [0.32, 0.26],
  ];
  return (
    <group rotation={[0.1, -1.05, 0]} position-y={-0.6} scale={0.78}>
      <group ref={rock}>
        {[-0.26, 0.26].map((z) => (
          <mesh key={z} material={M.wood()} geometry={rocker} position-z={z} />
        ))}
        {legs.map(([x, z]) => (
          <Rod key={`${x}${z}`} a={[x, 0.02, z]} b={[x * 0.92, 0.55, z * 0.92]} r={0.03} />
        ))}
        {/* seat, and its cushion */}
        <mesh material={M.wood()} position-y={0.58}>
          <boxGeometry args={[0.72, 0.06, 0.62]} />
        </mesh>
        <Cushion {...SEAT} axis="y" dents={SEAT_DENTS} press={seat} position={[0.02, 0.64, 0]} />
        <Piping w={0.64} d={0.54} position={[0.02, 0.668, 0]} />
        {/* brass tacks along the front edge of the seat */}
        {Array.from({ length: 11 }, (_, i) => (
          <mesh key={i} material={M.brass()} position={[0.345, 0.6, -0.25 + i * 0.05]} rotation-z={Math.PI / 2}>
            <sphereGeometry args={[0.011, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
        ))}
        {/* the upholstered back, set between the posts and leaning with them */}
        <Cushion {...BACK} axis="x" dents={BACK_DENTS} press={back} position={[-0.335, 1.0, 0]} rotation={[0, 0, 0.163]} />
        <Piping w={0.72} d={0.42} position={[-0.316, 1.003, 0]} rotation={[0, 0, 0.163 + Math.PI / 2]} />
        {/* back posts, spindles and the carved top rail */}
        {[-0.24, 0.24].map((z) => (
          <Rod key={z} a={[-0.3, 0.58, z]} b={[-0.46, 1.55, z * 1.05]} r={0.032} />
        ))}
        {[-0.14, -0.05, 0.05, 0.14].map((z) => (
          <Rod key={z} a={[-0.32, 0.62, z]} b={[-0.44, 1.42, z * 1.05]} r={0.016} />
        ))}
        <mesh material={M.wood()} position={[-0.445, 1.47, 0]} rotation-z={0.16}>
          <boxGeometry args={[0.05, 0.14, 0.58]} />
        </mesh>
        {/* arms */}
        {[-0.3, 0.3].map((z) => (
          <group key={z}>
            <Rod a={[0.28, 0.58, z]} b={[0.26, 0.86, z]} r={0.022} />
            <mesh material={M.wood()} position={[-0.02, 0.88, z]} rotation-z={-0.05}>
              <boxGeometry args={[0.62, 0.035, 0.07]} />
            </mesh>
            <Cushion {...ARM} axis="y" dents={ARM_DENTS} press={grip} position={[0.02, 0.91, z]} rotation={[0, 0, -0.05]} />
          </group>
        ))}
      </group>
    </group>
  );
}
