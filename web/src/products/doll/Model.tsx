import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { reducedMotion } from '../../director/runtime';
import { M } from '../../gl/materials';
import { useHaunted, useStory } from '../../store';

/**
 * Where the haunted doll's eyes go, in turn: at you, a slow drift left, back at you, up and
 * right to the empty place in the family photo, at you again. Seconds per stop are uneven.
 */
const GAZE: { x: number; y: number; hold: number }[] = [
  { x: 0, y: 0, hold: 2.6 },
  { x: -0.02, y: -0.004, hold: 1.4 },
  { x: 0, y: 0, hold: 1.8 },
  { x: 0.018, y: 0.012, hold: 1.6 },
  { x: 0.008, y: -0.01, hold: 0.9 },
];
const GAZE_CYCLE = GAZE.reduce((n, g) => n + g.hold, 0);

function gazeAt(t: number) {
  let k = t % GAZE_CYCLE;
  for (const g of GAZE) {
    if (k < g.hold) return g;
    k -= g.hold;
  }
  return GAZE[0] ?? { x: 0, y: 0 };
}

/** Porcelain doll in red velvet; damaged and unstitched after the Reveal (Requirement 15). */
export default function Doll() {
  const haunted = useHaunted();
  const looking = useStory((s) => s.story.played.doll === true);
  // Carted: the eyes stay on the empty place in the family photo, up and to the right (Req 15.3).
  const fixed = looking ? { x: 0.018, y: 0.012 } : { x: 0, y: 0 };
  const pupils = useRef<(THREE.Mesh | null)[]>([]);
  const head = useRef<THREE.Group>(null);
  useFrame((state, dt) => {
    const live = haunted && !looking && !reducedMotion();
    const target = live ? gazeAt(state.clock.elapsedTime) : fixed;
    const k = Math.min(1, dt * (live ? 7 : 20));
    for (const p of pupils.current) {
      if (!p) continue;
      p.position.x += (target.x - p.position.x) * k;
      p.position.y += (target.y - p.position.y) * k;
    }
    // The head follows the eyes a moment later, a few degrees, porcelain-stiff.
    if (head.current) {
      const ry = live ? target.x * 9 : 0;
      head.current.rotation.y += (ry - head.current.rotation.y) * Math.min(1, dt * 1.6);
    }
  });
  return (
    <group position-y={-0.22} rotation-y={-0.2} scale={0.82}>
      <mesh material={M.cloth()} position-y={-0.2}>
        <coneGeometry args={[0.5, 0.85, 40, 1, true]} />
      </mesh>
      <mesh material={M.clothWhite()} position-y={-0.6}>
        <torusGeometry args={[0.48, 0.04, 10, 40]} />
      </mesh>
      <mesh material={M.porcelain()} position={[-0.28, -0.05, 0.05]} rotation-z={0.5}>
        <capsuleGeometry args={[0.055, 0.3, 6, 12]} />
      </mesh>
      <mesh material={M.porcelain()} position={[0.28, -0.05, 0.05]} rotation-z={-0.5}>
        <capsuleGeometry args={[0.055, 0.3, 6, 12]} />
      </mesh>
      <mesh material={M.porcelain()} position-y={0.3}>
        <cylinderGeometry args={[0.07, 0.09, 0.12, 16]} />
      </mesh>
      <group ref={head} position-y={0.52} rotation-z={haunted ? 0.18 : 0}>
        <mesh material={M.porcelain()}>
          <sphereGeometry args={[0.24, 40, 30]} />
        </mesh>
        <mesh material={M.hair()} position={[0, 0.06, -0.03]} scale={[1.08, 1, 1.05]}>
          <sphereGeometry args={[0.25, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        </mesh>
        {[-0.08, 0.08].map((x, i) => (
          <group key={x} position={[x, 0.01, 0.2]}>
            <mesh material={M.enamel()}>
              <sphereGeometry args={[0.045, 16, 12]} />
            </mesh>
            <mesh
              ref={(m) => {
                pupils.current[i] = m;
              }}
              material={M.ink()}
              position={[fixed.x, fixed.y, 0.034]}
            >
              <sphereGeometry args={[0.022, 12, 10]} />
            </mesh>
          </group>
        ))}
        <mesh material={M.wax()} position={[0, -0.1, 0.215]} scale={[1.4, 0.6, 0.6]}>
          <sphereGeometry args={[0.03, 12, 8]} />
        </mesh>
        {haunted && (
          // A crack in the porcelain and the unstitched seam.
          <mesh material={M.ink()} position={[0.07, 0.08, 0.2]} rotation-z={-0.9}>
            <boxGeometry args={[0.18, 0.008, 0.01]} />
          </mesh>
        )}
      </group>
      {haunted &&
        [0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} material={M.ink()} position={[-0.18 + i * 0.03, -0.1 - i * 0.07, 0.36 - i * 0.02]} rotation-z={0.8}>
            <boxGeometry args={[0.04, 0.008, 0.008]} />
          </mesh>
        ))}
    </group>
  );
}
