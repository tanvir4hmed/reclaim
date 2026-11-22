import { PerspectiveCamera, View } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type * as THREE from 'three';
import { reducedMotion } from '../director/runtime';
import { faceGeometry, pumpkinGeometry, RY } from './pumpkinGeo';
import { rindTexture } from './pumpkinTex';

/** A jack-o'-lantern with a candle inside: light breathes out of its eyes and grin. */
function JackOLantern() {
  const body = useMemo(() => pumpkinGeometry(), []);
  const rind = useMemo(() => rindTexture(), []);
  const face = useMemo(() => faceGeometry(0.06), []);
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  const inner = useRef<THREE.PointLight>(null);
  const spill = useRef<THREE.PointLight>(null);
  useEffect(
    () => () => {
      body.dispose();
      rind.dispose();
      face.dispose();
    },
    [body, rind, face],
  );
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    const still = reducedMotion();
    // Candle flicker; every so often it gutters almost to nothing, then catches again.
    const gutter = still ? 0 : Math.max(0, Math.sin(t * 0.45) - 0.9) * 8;
    const k = still ? 1 : Math.max(0.15, 0.85 + Math.sin(t * 11) * 0.08 + Math.sin(t * 23.7) * 0.06 + Math.sin(t * 4.1) * 0.05 - gutter);
    if (glow.current) glow.current.color.setRGB(1.7 * k, 0.75 * k, 0.16 * k);
    if (inner.current) inner.current.intensity = 2.4 * k;
    if (spill.current) spill.current.intensity = 0.9 * k;
  });
  return (
    <group rotation-y={-0.18}>
      <mesh geometry={body}>
        <meshStandardMaterial map={rind} roughness={0.6} metalness={0} />
      </mesh>
      <mesh geometry={face}>
        <meshBasicMaterial ref={glow} toneMapped={false} />
      </mesh>
      {/* the stem: dry, twisted, bent over */}
      <mesh position={[0.04, RY + 0.08, 0]} rotation-z={-0.35}>
        <cylinderGeometry args={[0.06, 0.1, 0.26, 8, 1]} />
        <meshStandardMaterial color="#3a3018" roughness={0.95} />
      </mesh>
      <pointLight ref={inner} position={[0, 0.05, 0.3]} color="#ff9a3a" distance={2} />
      {/* light falling out of the face onto the floor in front of it, not onto the rind */}
      <pointLight ref={spill} position={[0, -1.1, 1.3]} color="#ff7a20" distance={2.2} />
    </group>
  );
}

/** The lantern in the haunted backdrop: a candle burning in a pumpkin among the graves. */
export function PumpkinView() {
  return (
    <View className="pumpkin-view">
      <ambientLight intensity={0.12} color="#5a6a90" />
      {/* cold moonlight from above left picks out the ribs */}
      <directionalLight position={[-3, 4, 2]} intensity={0.9} color="#8a9ac8" />
      {/* close enough that the lantern fills its frame (it stands among the graves) */}
      <PerspectiveCamera makeDefault position={[0, 0.5, 4.6]} fov={30} />
      <group position={[0, -0.15, 0]} scale={0.85}>
        <JackOLantern />
      </group>
    </View>
  );
}
