import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ProductId } from '../core/ids';
import { seeded } from '../director/footprints';

const NUMERALS = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

function numeralTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    g.font = '600 44px "Fraunces Variable", serif';
    g.fillStyle = 'rgba(230,220,203,0.9)';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 64, 34);
  }
  return new THREE.CanvasTexture(c);
}

/** Time stuttering backward: a starry vortex with drifting Roman numerals (pocket watch, Req 14.2). */
function TimeVortex() {
  const group = useRef<THREE.Group>(null);
  const stars = useMemo(() => {
    const rnd = seeded(1717);
    const n = 900;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 1.2 + rnd() * 3;
      const a = rnd() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = (rnd() - 0.5) * 3;
      pos[i * 3 + 2] = Math.sin(a) * r - 1.5;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  const numerals = useMemo(
    () => NUMERALS.map((t, i) => ({ tex: numeralTexture(t), a: (i / 12) * Math.PI * 2 })),
    [],
  );
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    // Stutter: mostly backward, with a jerk every second.
    g.rotation.z = -(t * 0.25) + Math.sin(t * 6) * 0.04 * (Math.floor(t) % 2);
    state.invalidate();
  });
  return (
    <group ref={group} position-z={-0.6}>
      <points geometry={stars}>
        <pointsMaterial size={0.02} color="#c9d6ff" transparent opacity={0.8} sizeAttenuation />
      </points>
      {numerals.map(({ tex, a }, i) => (
        <sprite key={i} position={[Math.cos(a) * 1.7, Math.sin(a) * 1.15, -0.4]} scale={[0.4, 0.2, 1]}>
          <spriteMaterial map={tex} transparent opacity={0.7} depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
}

export function HauntedInspection({ id }: { id: ProductId }) {
  if (id === 'pocket-watch') return <TimeVortex />;
  return null;
}
