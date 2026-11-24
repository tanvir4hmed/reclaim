import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const V3 = THREE.Vector3;
import { M } from '../../gl/materials';
import { useFx } from '../../fx/fxStore';
import { progress, useTaken } from '../../gl/useTaken';

/**
 * Rotary telephone; the handset rattles while it rings (Requirement 21). Taken: the receiver
 * lifts off the cradle by itself and tilts as if held to an ear that is not there, and blood
 * starts running out of the earpiece and down onto the dial.
 */
/** A point on the outside of the body's dome (radius 0.6, squashed 0.5 high and 0.8 deep). */
function onDome(phi: number, az: number, lift = 1.0): THREE.Vector3 {
  return new V3(0.6 * Math.sin(phi) * Math.sin(az) * lift, -0.1 + 0.3 * Math.cos(phi) * lift, 0.48 * Math.sin(phi) * Math.cos(az) * lift);
}

/** Streams of blood down the front of the dome: from where the receiver lay to the rim. */
const STREAMS = [
  { az: 0.25, wob: 0.06, r: 0.016, delay: 1.0 },
  { az: -0.35, wob: -0.05, r: 0.013, delay: 1.6 },
  { az: 0.75, wob: 0.08, r: 0.014, delay: 2.1 },
  { az: -0.9, wob: 0.05, r: 0.011, delay: 2.7 },
];
const STREAM_SEG = 40;
const STREAM_RAD = 6;

function streamGeometry(az: number, wob: number, r: number): THREE.TubeGeometry {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    // down the curve of the dome, wandering a little as real runs do
    pts.push(onDome(0.32 + t * (Math.PI / 2 - 0.3), az + Math.sin(t * 7 + az * 3) * wob, 1.012));
  }
  // over the lip of the base and down its side
  const end = pts[pts.length - 1]!;
  pts.push(new V3(end.x * 1.06, -0.12, end.z * 1.06), new V3(end.x * 1.07, -0.15, end.z * 1.07));
  // flattened a little against the surface
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), STREAM_SEG, r, STREAM_RAD, false);
}

/** Blood: wells up in the cradle, runs down the body in streams, drips from the earpiece, pools. */
function PhoneBlood({ since }: { since: () => number }) {
  const streams = useMemo(() => STREAMS.map((s) => streamGeometry(s.az, s.wob, s.r)), []);
  useEffect(() => () => streams.forEach((g) => g.dispose()), [streams]);
  const well = useRef<THREE.Mesh>(null);
  const pool = useRef<THREE.Mesh>(null);
  const drops = useRef<(THREE.Mesh | null)[]>([]);
  // The lifted earpiece, in the phone's own coordinates, and the base under it.
  const ear = useMemo(() => new V3(0.5, -0.125, 0).applyEuler(new THREE.Euler(0.2, -0.4, 0.55)).add(new V3(0.05, 0.66, 0.14)), []);
  useFrame(() => {
    const s = since();
    if (well.current) well.current.scale.setScalar(Math.max(0.01, progress(s, 1.8, 0.6)));
    streams.forEach((g, i) => {
      const k = progress(s, 3.2, STREAMS[i]!.delay);
      g.setDrawRange(0, Math.floor(STREAM_SEG * k) * STREAM_RAD * 6);
    });
    if (pool.current) pool.current.scale.setScalar(Math.max(0.01, progress(s, 3, 3.4)));
    // Drops keep falling from the earpiece onto the base, one after another.
    drops.current.forEach((m, i) => {
      if (!m) return;
      if (s === Infinity || s < 1.3) {
        m.visible = s === Infinity && i === 0;
        m.position.copy(ear).setY(ear.y - 0.06);
        return;
      }
      const t = ((s - 1.3 + i * 0.37) % 1.1) / 1.1;
      m.visible = true;
      m.position.set(ear.x, ear.y - 0.06 - t * t * (ear.y + 0.08), ear.z);
      m.scale.set(1, 1 + t * 1.5, 1);
    });
  });
  return (
    <group>
      {/* welling up in the cradle where the receiver lay */}
      <mesh ref={well} position={[0, 0.21, 0.02]} rotation-x={-Math.PI / 2} scale={0.01}>
        <circleGeometry args={[0.2, 24]} />
        <meshStandardMaterial color="#4a0406" roughness={0.12} />
      </mesh>
      {streams.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color={i % 2 ? '#4e0407' : '#5c0609'} roughness={0.15} metalness={0.05} />
        </mesh>
      ))}
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(m) => {
            drops.current[i] = m;
          }}
          visible={false}
        >
          <sphereGeometry args={[0.018, 8, 6]} />
          <meshStandardMaterial color="#5a0507" roughness={0.15} />
        </mesh>
      ))}
      <mesh ref={pool} position={[0.1, -0.15, 0.32]} rotation-x={-Math.PI / 2} scale={0.01}>
        <circleGeometry args={[0.42, 28]} />
        <meshStandardMaterial color="#3e0305" roughness={0.1} />
      </mesh>
    </group>
  );
}

export default function Telephone({ open = false }: { open?: boolean }) {
  const handset = useRef<THREE.Group>(null);
  const dial = useRef<THREE.Group>(null);
  const ringing = useFx((s) => s.cartRinging) || open;
  const { taken, since } = useTaken('telephone');
  useFrame((st) => {
    const h = handset.current;
    if (!h) return;
    const t = st.clock.elapsedTime;
    if (dial.current) {
      // Taken: someone unseen keeps trying the dial, a little this way, a little that way.
      const tries = taken ? Math.sin(t * 1.7) * 0.22 + Math.sin(t * 4.3 + 1.1) * 0.08 + Math.sin(t * 0.6) * 0.1 : 0;
      dial.current.rotation.y = tries;
    }
    if (taken) {
      // Picked up: up and over to one side, earpiece turned in toward a missing head.
      const k = progress(since(), 1.2);
      // (Kept low enough that the whole handset stays in the picture.)
      h.position.set(0.05 * k, 0.36 + 0.3 * k, 0.14 * k);
      h.rotation.set(0.2 * k, -0.4 * k, 0.55 * k + Math.sin(t * 1.3) * 0.02 * k);
      return;
    }
    // Ring pattern: two short rattles, then a pause.
    const on = ringing && t % 3 < 1.4 && Math.floor(t * 18) % 2 === 0;
    h.position.set(0, 0.36 + (on ? 0.025 : 0), 0);
    h.rotation.set(0, 0, on ? 0.03 : 0);
    if (ringing) st.invalidate();
  });
  return (
    <group rotation={[0.3, -0.4, 0]} position-y={-0.15}>
      <mesh material={M.bakelite()} position-y={-0.1} scale={[1, 0.5, 0.8]}>
        <sphereGeometry args={[0.6, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh material={M.bakelite()} position-y={-0.12}>
        <cylinderGeometry args={[0.62, 0.66, 0.05, 40]} />
      </mesh>
      <group position={[0, 0.08, 0.32]} rotation-x={-0.9}>
       <group ref={dial}>
        <mesh material={M.silver()}>
          <cylinderGeometry args={[0.24, 0.24, 0.03, 40]} />
        </mesh>
        {Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 1.6 + 0.6;
          return (
            <mesh key={i} material={M.ink()} position={[Math.cos(a) * 0.17, 0.02, Math.sin(a) * 0.17]}>
              <cylinderGeometry args={[0.032, 0.032, 0.02, 14]} />
            </mesh>
          );
        })}
        <mesh material={M.enamel()} position-y={0.02}>
          <cylinderGeometry args={[0.08, 0.08, 0.02, 24]} />
        </mesh>
       </group>
      </group>
      <group ref={handset} position-y={0.36}>
        <mesh material={M.bakelite()} rotation-z={Math.PI / 2}>
          <capsuleGeometry args={[0.07, 0.8, 8, 16]} />
        </mesh>
        {[-0.5, 0.5].map((x) => (
          <mesh key={x} material={M.bakelite()} position={[x, -0.06, 0]}>
            <cylinderGeometry args={[0.14, 0.11, 0.12, 24]} />
          </mesh>
        ))}
        {taken && (
          // blood filling the earpiece
          <mesh position={[0.5, -0.125, 0]} rotation-x={Math.PI / 2}>
            <circleGeometry args={[0.1, 18]} />
            <meshStandardMaterial color="#4e0406" roughness={0.15} side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>
      {taken && <PhoneBlood since={since} />}
    </group>
  );
}
