import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { seeded } from '../../director/footprints';
import { M } from '../../gl/materials';

/** A coil spring along a helix (the music box's mainspring and the comb's little springs). */
function springGeometry(turns: number, r: number, len: number): THREE.TubeGeometry {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= turns * 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, (i / (turns * 16)) * len, Math.sin(a) * r));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 16, r * 0.12, 6, false);
}

interface Part {
  kind: 'spring' | 'gear' | 'tooth';
  v: THREE.Vector3;
  spin: THREE.Vector3;
  s: number;
}

/**
 * The music box after it is taken: it bursts like a blown speaker. Springs, gears and the
 * steel comb's teeth fire out of it like fireworks, the lid is gone, and what is left is a
 * scorched box with broken springs standing up out of it, still quivering.
 */
export function MusicBoxBlown({ since }: { since: () => number }) {
  const spring = useMemo(() => springGeometry(6, 0.05, 0.4), []);
  const parts = useMemo<Part[]>(() => {
    const r = seeded(7);
    return Array.from({ length: 34 }, (_, i) => {
      const a = r() * Math.PI * 2;
      const up = 2.2 + r() * 2.4;
      const out = 0.8 + r() * 1.8;
      return {
        kind: i % 3 === 0 ? 'spring' : i % 3 === 1 ? 'gear' : 'tooth',
        v: new THREE.Vector3(Math.cos(a) * out, up, Math.sin(a) * out),
        spin: new THREE.Vector3(r() * 12 - 6, r() * 12 - 6, r() * 12 - 6),
        s: 0.6 + r() * 0.8,
      };
    });
  }, []);
  const flying = useRef<(THREE.Object3D | null)[]>([]);
  const stay = useRef<THREE.Group>(null);
  const glow = useRef<THREE.PointLight>(null);
  useFrame((st) => {
    const t = since();
    const live = t !== Infinity && t < 2.2;
    parts.forEach((p, i) => {
      const o = flying.current[i];
      if (!o) return;
      o.visible = live;
      if (!live) return;
      o.position.set(p.v.x * t, 0.25 + p.v.y * t - 4.2 * t * t, p.v.z * t);
      o.rotation.set(p.spin.x * t, p.spin.y * t, p.spin.z * t);
    });
    // The burst lights the box from inside for an instant (one soft pulse, no flashing).
    if (glow.current) glow.current.intensity = live ? Math.max(0, 3 * (1 - t / 0.5)) : 0;
    // The broken springs that stay keep quivering.
    stay.current?.children.forEach((c, i) => {
      c.rotation.z = Math.sin(st.clock.elapsedTime * (9 + i * 3)) * 0.05;
    });
  });
  return (
    <group rotation={[0.3, -0.5, 0]} position-y={-0.25}>
      {/* the box, blackened, its front split */}
      <mesh position-y={-0.02}>
        <boxGeometry args={[1.2, 0.41, 0.8]} />
        <meshStandardMaterial color="#1e1410" roughness={0.95} />
      </mesh>
      <mesh material={M.gilt()} position={[0.1, 0.02, 0.405]} rotation-z={0.25}>
        <boxGeometry args={[0.42, 0.14, 0.01]} />
      </mesh>
      <mesh position={[0, 0.19, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[1.1, 0.7]} />
        <meshStandardMaterial color="#0a0605" roughness={1} />
      </mesh>
      <group ref={stay}>
        {[
          [-0.3, 0.18, -0.1, 0.3],
          [0.05, 0.18, 0.08, -0.2],
          [0.32, 0.18, -0.15, 0.5],
          [-0.1, 0.18, 0.2, -0.45],
        ].map(([x, y, z, tilt], i) => (
          <mesh key={i} geometry={spring} material={M.silver()} position={[x ?? 0, y ?? 0, z ?? 0]} rotation-x={tilt ?? 0} />
        ))}
      </group>
      {parts.map((p, i) => (
        <group
          key={i}
          ref={(o) => {
            flying.current[i] = o;
          }}
          scale={p.s}
          visible={false}
        >
          {p.kind === 'spring' && <mesh geometry={spring} material={M.silver()} />}
          {p.kind === 'gear' && (
            <mesh material={M.brass()} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.09, 0.09, 0.025, 10]} />
            </mesh>
          )}
          {p.kind === 'tooth' && (
            <mesh material={M.silver()}>
              <boxGeometry args={[0.02, 0.22, 0.01]} />
            </mesh>
          )}
        </group>
      ))}
      <pointLight ref={glow} position={[0, 0.4, 0.2]} color="#ffb060" distance={3} intensity={0} />
    </group>
  );
}
