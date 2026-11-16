import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { M } from '../../gl/materials';
import { useHaunted, useStory } from '../../store';

/** Fresh by day; collapsed, rotted, a nonhuman bite and a fly after the Reveal (Req 20). */
export default function Cake() {
  const haunted = useHaunted();
  const flyGone = useStory((s) => s.story.played.cake === true);
  const wing = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const flyHere = haunted && !flyGone;
  // The fly flicks its wings now and then; redraw only while it is here.
  useEffect(() => {
    if (!flyHere) return;
    const t = setInterval(() => invalidate(), 90);
    return () => clearInterval(t);
  }, [flyHere, invalidate]);
  const bite = useMemo(() => {
    // Jagged, wide arc of teeth marks: too many points and too far apart for a person.
    const s = new THREE.Shape();
    s.moveTo(-0.42, 0.12);
    for (let i = 0; i <= 9; i++) {
      const a = Math.PI * (i / 9);
      const r = i % 2 ? 0.33 : 0.42;
      s.lineTo(-Math.cos(a) * r, 0.12 - Math.sin(a) * r * 0.9);
    }
    s.lineTo(0.42, 0.12);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: false });
  }, []);
  const piping = useMemo(() => Array.from({ length: 14 }, (_, i) => (i / 14) * Math.PI * 2), []);
  useFrame((st) => {
    if (wing.current) {
      wing.current.rotation.z = Math.sin(st.clock.elapsedTime * 40) * (Math.floor(st.clock.elapsedTime) % 3 === 0 ? 0.6 : 0);
    }
  });
  const sag = haunted ? 0.72 : 1;
  return (
    <group position-y={-0.15} rotation={[0.15, 0.4, haunted ? 0.07 : 0]}>
      <mesh material={M.porcelain()} position-y={-0.42}>
        <cylinderGeometry args={[0.95, 0.9, 0.06, 48]} />
      </mesh>
      <group scale={[1, sag, 1]}>
        <mesh material={M.sponge()} position-y={-0.1}>
          <cylinderGeometry args={[0.62, 0.64, 0.56, 48]} />
        </mesh>
        <mesh material={M.cream()} position-y={0.21}>
          <cylinderGeometry args={[0.66, 0.66, 0.1, 48]} />
        </mesh>
        {piping.map((a, i) => (
          <mesh key={i} material={M.cream()} position={[Math.cos(a) * 0.55, 0.3, Math.sin(a) * 0.55]}>
            <sphereGeometry args={[0.07, 16, 12]} />
          </mesh>
        ))}
        {piping.filter((_, i) => i % 2 === 0).map((a, i) => (
          <mesh key={`b${i}`} material={M.berry()} position={[Math.cos(a) * 0.32, 0.32, Math.sin(a) * 0.32]}>
            <sphereGeometry args={[0.075, 18, 14]} />
          </mesh>
        ))}
      </group>
      {haunted && <mesh material={M.ink()} geometry={bite} position={[0.3, 0.05, 0.42]} rotation={[0, -0.6, 0]} scale={0.6} />}
      {haunted && !flyGone && (
        <group position={[-0.2, 0.32, 0.3]} scale={0.05}>
          <mesh material={M.ink()}>
            <sphereGeometry args={[1, 10, 8]} />
          </mesh>
          <group ref={wing}>
            <mesh position={[0.9, 0.6, 0]} rotation-z={0.6}>
              <planeGeometry args={[1.6, 0.8]} />
              <meshBasicMaterial color="#c8d0d8" transparent opacity={0.45} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[-0.9, 0.6, 0]} rotation-z={-0.6}>
              <planeGeometry args={[1.6, 0.8]} />
              <meshBasicMaterial color="#c8d0d8" transparent opacity={0.45} side={THREE.DoubleSide} />
            </mesh>
          </group>
        </group>
      )}
    </group>
  );
}
