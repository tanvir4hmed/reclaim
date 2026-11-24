import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type * as THREE from 'three';
import { useFx } from '../../fx/fxStore';
import { M } from '../../gl/materials';
import { progress, useTaken } from '../../gl/useTaken';
import { useHaunted } from '../../store';
import { FaceUpSkull } from './Skull';

/**
 * Truffle box; after the Reveal one more is gone each time you look away (Requirement 32.2).
 * Taken: one by one, in a slow wave across the box, each truffle shrinks into its paper cup
 * and, as it goes, a small skull rises in its place, lying on its back, face up, bloody.
 */
export function ChocolateBox() {
  const haunted = useHaunted();
  const { taken, since } = useTaken('chocolate-box');
  const missing = useFx((s) => s.flags['choc-missing'] ?? 0);
  const cells = useMemo(() => Array.from({ length: 24 }, (_, i) => [(i % 6) - 2.5, Math.floor(i / 6) - 1.5] as const), []);
  const truffles = useRef<(THREE.Mesh | null)[]>([]);
  const skulls = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => {
    const s = since();
    cells.forEach(([x, z], i) => {
      // the wave runs from the back left corner to the front right
      const k = taken ? progress(s, 1.1, 0.2 + (x + 2.5) * 0.12 + (z + 1.5) * 0.18) : 0;
      const t = truffles.current[i];
      if (t) {
        t.visible = k < 0.98;
        t.scale.set(1 - k * 0.6, Math.max(0.02, 1 - k), 1 - k * 0.6);
        t.position.y = 0.06 - k * 0.07;
      }
      const sk = skulls.current[i];
      if (sk) {
        sk.visible = k > 0.02;
        sk.scale.setScalar(0.36 * Math.max(0.01, k));
      }
    });
  });
  return (
    <group rotation={[0.75, 0, 0]} position-y={-0.1}>
      <mesh material={M.giftPaper()} position-y={-0.06}>
        <boxGeometry args={[1.5, 0.12, 1.05]} />
      </mesh>
      <mesh material={M.ribbon()} position-y={0.005}>
        <boxGeometry args={[1.4, 0.01, 0.95]} />
      </mesh>
      {cells.map(([x, z], i) =>
        haunted && i < missing ? null : (
          <group key={i} position={[x * 0.22, 0, z * 0.22]}>
            <mesh
              ref={(m) => {
                truffles.current[i] = m;
              }}
              material={M.chocolate()}
              position-y={0.06}
            >
              <sphereGeometry args={[0.085, 20, 14]} />
            </mesh>
            {taken && (
              <group
                ref={(g) => {
                  skulls.current[i] = g;
                }}
                position-y={-0.015}
                rotation-y={((i * 1.7) % 1.2 - 0.6) * 0.4}
                scale={0.01}
                visible={false}
              >
                <FaceUpSkull detail="small" />
              </group>
            )}
          </group>
        ),
      )}
    </group>
  );
}
