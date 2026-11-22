import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { M } from '../../gl/materials';
import { useFx } from '../../fx/fxStore';
import { progress, useTaken } from '../../gl/useTaken';

/**
 * Rotary telephone; the handset rattles while it rings (Requirement 21). Taken: the receiver
 * lifts off the cradle by itself and tilts as if held to an ear that is not there, and blood
 * starts running out of the earpiece and down onto the dial.
 */
export default function Telephone({ open = false }: { open?: boolean }) {
  const handset = useRef<THREE.Group>(null);
  const ringing = useFx((s) => s.cartRinging) || open;
  const { taken, since } = useTaken('telephone');
  const drip = useRef<(THREE.Mesh | null)[]>([]);
  useFrame((st) => {
    const h = handset.current;
    if (!h) return;
    const t = st.clock.elapsedTime;
    if (taken) {
      // Picked up: up and over to one side, earpiece turned in toward a missing head.
      const k = progress(since(), 1.2);
      // (Kept low enough that the whole handset stays in the picture.)
      h.position.set(0.05 * k, 0.36 + 0.3 * k, 0.14 * k);
      h.rotation.set(0.2 * k, -0.4 * k, 0.55 * k + Math.sin(t * 1.3) * 0.02 * k);
      const s = since();
      drip.current.forEach((m, i) => {
        if (!m) return;
        const flow = progress(s, 2.2, 1 + i * 0.35);
        m.scale.y = Math.max(0.001, flow);
        m.position.y = -0.1 - flow * 0.2;
      });
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
          <group position={[0.5, -0.06, 0]}>
            {/* blood welling in the earpiece and running out in strings */}
            <mesh position-y={-0.065} rotation-x={Math.PI / 2}>
              <circleGeometry args={[0.1, 18]} />
              <meshStandardMaterial color="#4e0406" roughness={0.15} />
            </mesh>
            {[-0.05, 0.01, 0.06].map((x, i) => (
              <mesh
                key={x}
                ref={(m) => {
                  drip.current[i] = m;
                }}
                position={[x, -0.1, 0]}
              >
                <boxGeometry args={[0.022, 0.4, 0.022]} />
                <meshStandardMaterial color="#5a0507" roughness={0.15} />
              </mesh>
            ))}
          </group>
        )}
      </group>
      {taken && (
        <mesh position={[0, -0.09, 0.2]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.38, 24]} />
          <meshStandardMaterial color="#3e0305" roughness={0.12} />
        </mesh>
      )}
    </group>
  );
}
