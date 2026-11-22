import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { M } from '../../gl/materials';
import { useTaken } from '../../gl/useTaken';
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
  // Taken: something with a mouth far too wide takes one bite out of the front, in one go.
  const { taken, since } = useTaken('cake');
  const GAP = 1.9; // radians missing: wider than any human mouth
  const inGap = (a: number) => taken && Math.abs(Math.atan2(Math.cos(a), Math.sin(a))) < GAP / 2 + 0.12;
  const cut = useMemo(() => {
    // The cut face of the bite, in (radius, height): a ragged edge of tooth marks, two rows deep.
    const s = new THREE.Shape();
    s.moveTo(0.18, -0.38);
    s.lineTo(0.64, -0.38);
    for (let i = 0; i <= 12; i++) {
      const y = -0.38 + (i / 12) * 0.64;
      s.lineTo(0.64 - (i % 2 ? 0.07 : 0.0) - (i % 4 === 1 ? 0.05 : 0), y);
    }
    s.lineTo(0.12, 0.26);
    for (let i = 0; i <= 8; i++) s.lineTo(0.12 + (i % 2 ? 0.06 : 0), 0.26 - (i / 8) * 0.64);
    return new THREE.ShapeGeometry(s);
  }, []);
  const punctures = useMemo(() => {
    // Two rows of deep tooth holes round the edge of the bite, many more than a mouth should have.
    const out: [number, number, number][] = [];
    for (const side of [-1, 1]) {
      for (let row = 0; row < 2; row++) {
        for (let i = 0; i < 5; i++) {
          const th = side * (GAP / 2 + 0.1 + row * 0.13);
          const r = 0.2 + i * 0.1;
          out.push([Math.sin(th) * r, 0.265, Math.cos(th) * r]);
        }
      }
    }
    return out;
  }, []);
  const jolt = useRef<THREE.Group>(null);
  useFrame(() => {
    const s = since();
    if (!jolt.current) return;
    const k = taken && s < 0.5 ? Math.sin((s / 0.5) * Math.PI) : 0;
    jolt.current.position.z = -k * 0.08;
    jolt.current.rotation.x = k * 0.12;
  });
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
      <group ref={jolt} scale={[1, sag, 1]}>
        <mesh material={M.sponge()} position-y={-0.1}>
          <cylinderGeometry args={taken ? [0.62, 0.64, 0.56, 48, 1, false, GAP / 2, Math.PI * 2 - GAP] : [0.62, 0.64, 0.56, 48]} />
        </mesh>
        <mesh material={M.cream()} position-y={0.21}>
          <cylinderGeometry args={taken ? [0.66, 0.66, 0.1, 48, 1, false, GAP / 2, Math.PI * 2 - GAP] : [0.66, 0.66, 0.1, 48]} />
        </mesh>
        {taken && (
          <>
            {/* the bitten faces: wet, dark, rotten inside */}
            {[GAP / 2, -GAP / 2].map((th) => (
              <mesh key={th} geometry={cut} rotation-y={th - Math.PI / 2}>
                <meshStandardMaterial color="#4a1610" roughness={0.6} side={THREE.DoubleSide} />
              </mesh>
            ))}
            {/* the hollow it left, deep in the middle */}
            <mesh position={[0, -0.06, 0.05]} rotation-x={-Math.PI / 2}>
              <circleGeometry args={[0.2, 24]} />
              <meshStandardMaterial color="#1a0605" roughness={0.4} />
            </mesh>
            {punctures.map((p, i) => (
              <mesh key={i} material={M.ink()} position={p}>
                <cylinderGeometry args={[0.022, 0.012, 0.03, 8]} />
              </mesh>
            ))}
          </>
        )}
        {piping.map((a, i) =>
          inGap(a) ? null : (
            <mesh key={i} material={M.cream()} position={[Math.cos(a) * 0.55, 0.3, Math.sin(a) * 0.55]}>
              <sphereGeometry args={[0.07, 16, 12]} />
            </mesh>
          ),
        )}
        {piping
          .filter((_, i) => i % 2 === 0)
          .map((a, i) =>
            inGap(a) ? null : (
              <mesh key={`b${i}`} material={M.berry()} position={[Math.cos(a) * 0.32, 0.32, Math.sin(a) * 0.32]}>
                <sphereGeometry args={[0.075, 18, 14]} />
              </mesh>
            ),
          )}
      </group>
      {haunted && !taken && <mesh material={M.ink()} geometry={bite} position={[0.3, 0.05, 0.42]} rotation={[0, -0.6, 0]} scale={0.6} />}
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
