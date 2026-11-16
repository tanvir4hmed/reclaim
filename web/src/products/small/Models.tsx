import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFx } from '../../fx/fxStore';
import { useCanvasTexture } from '../../gl/canvasTex';
import { M } from '../../gl/materials';
import { useHaunted, useStory } from '../../store';

/** Hand-blown glass ornament with a gilt cap (cracks after the Reveal). */
export function GlassOrnament() {
  const haunted = useHaunted();
  return (
    <group position-y={-0.05}>
      <mesh>
        <sphereGeometry args={[0.5, 48, 36]} />
        <meshPhysicalMaterial color={haunted ? '#3c1a1d' : '#b3121f'} metalness={0.6} roughness={0.08} clearcoat={1} />
      </mesh>
      <mesh material={M.gilt()} position-y={0.53}>
        <cylinderGeometry args={[0.1, 0.12, 0.12, 24]} />
      </mesh>
      <mesh material={M.gilt()} position-y={0.66}>
        <torusGeometry args={[0.07, 0.015, 8, 24]} />
      </mesh>
      {haunted && (
        <mesh material={M.ink()} position={[0.12, 0.08, 0.47]} rotation-z={-0.7}>
          <boxGeometry args={[0.32, 0.008, 0.01]} />
        </mesh>
      )}
    </group>
  );
}

/** Pillar candle; the flame flickers and bends away from a fast pointer (Requirement 32.6). */
export function Candle() {
  const flame = useRef<THREE.Mesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const mains = useFx((s) => s.mains);
  useEffect(() => {
    const t = setInterval(() => invalidate(), 80);
    return () => clearInterval(t);
  }, [invalidate]);
  useFrame((st) => {
    const f = flame.current;
    if (!f) return;
    const t = st.clock.elapsedTime;
    f.scale.set(1, 1 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.05, 1);
    f.rotation.z = Math.sin(t * 3.1) * 0.06;
  });
  return (
    <group position-y={-0.15}>
      <mesh material={M.candleWax()}>
        <cylinderGeometry args={[0.28, 0.3, 0.9, 40]} />
      </mesh>
      <mesh material={M.ink()} position-y={0.5}>
        <cylinderGeometry args={[0.01, 0.01, 0.1, 6]} />
      </mesh>
      <mesh ref={flame} material={M.flame()} position-y={0.62}>
        <coneGeometry args={[0.06, 0.22, 16]} />
      </mesh>
      <pointLight position={[0, 0.7, 0.2]} intensity={1.2 + (1 - mains)} distance={2.5} color="#ffb860" />
    </group>
  );
}

/** Snow globe with a little house; ash instead of snow after the Reveal (Requirement 32.1). */
export function SnowGlobe() {
  const haunted = useHaunted();
  const flakes = useMemo(() => {
    const pos = new Float32Array(160 * 3);
    for (let i = 0; i < 160; i++) {
      const a = (i * 2.399) % (Math.PI * 2);
      const r = 0.48 * Math.sqrt((i % 37) / 37);
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = -0.3 + ((i * 0.618) % 1) * 0.8;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  return (
    <group position-y={-0.05}>
      <mesh material={M.wood()} position-y={-0.55}>
        <cylinderGeometry args={[0.5, 0.58, 0.28, 48]} />
      </mesh>
      <mesh material={M.snow()} position-y={-0.38}>
        <cylinderGeometry args={[0.5, 0.5, 0.06, 48]} />
      </mesh>
      <group position-y={-0.22}>
        <mesh material={M.woodLight()}>
          <boxGeometry args={[0.28, 0.22, 0.22]} />
        </mesh>
        <mesh material={M.giftPaper()} position-y={0.17} rotation-y={Math.PI / 4}>
          <coneGeometry args={[0.24, 0.16, 4]} />
        </mesh>
        <mesh material={M.glow()} position={[0, 0, 0.112]}>
          <planeGeometry args={[0.07, 0.08]} />
        </mesh>
      </group>
      <points geometry={flakes}>
        <pointsMaterial size={0.025} color={haunted ? '#5d5952' : '#ffffff'} />
      </points>
      <mesh material={M.glass()}>
        <sphereGeometry args={[0.6, 48, 36]} />
      </mesh>
    </group>
  );
}

/** Truffle box; after the Reveal one more is gone each time you look away (Requirement 32.2). */
export function ChocolateBox() {
  const haunted = useHaunted();
  const missing = useFx((s) => s.flags['choc-missing'] ?? 0);
  const cells = useMemo(() => Array.from({ length: 24 }, (_, i) => [(i % 6) - 2.5, Math.floor(i / 6) - 1.5] as const), []);
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
          <mesh key={i} material={M.chocolate()} position={[x * 0.22, 0.06, z * 0.22]}>
            <sphereGeometry args={[0.085, 20, 14]} />
          </mesh>
        ),
      )}
    </group>
  );
}

/** Music box whose dancer spins and stops facing you (Requirement 32.3). */
export function MusicBox({ open = false }: { open?: boolean }) {
  const haunted = useHaunted();
  const lidOpen = open || (haunted && useStory.getState().story.played['music-box'] === true);
  const dancer = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => invalidate(), 33);
    const stop = setTimeout(() => clearInterval(t), 6000);
    return () => {
      clearInterval(t);
      clearTimeout(stop);
    };
  }, [open, invalidate]);
  useFrame((st, dt) => {
    const d = dancer.current;
    if (!d || !open) return;
    const speed = Math.max(0, 1 - st.clock.elapsedTime / 6);
    d.rotation.y += dt * 4 * speed;
    if (speed === 0) d.rotation.y = 0;
  });
  return (
    <group rotation={[0.3, -0.5, 0]} position-y={-0.25}>
      <mesh material={M.wood()}>
        <boxGeometry args={[1.2, 0.45, 0.8]} />
      </mesh>
      <mesh material={M.gilt()} position={[0, 0.06, 0.405]}>
        <boxGeometry args={[0.5, 0.18, 0.01]} />
      </mesh>
      <group position={[0, 0.225, -0.4]} rotation-x={lidOpen ? -1.9 : 0}>
        <mesh material={M.wood()} position={[0, 0.03, 0.4]}>
          <boxGeometry args={[1.22, 0.06, 0.82]} />
        </mesh>
        <mesh material={M.mirror()} position={[0, 0.065, 0.4]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[1.0, 0.65]} />
        </mesh>
      </group>
      {lidOpen && (
        <group ref={dancer} position-y={0.3}>
          <mesh material={M.clothWhite()} position-y={0.05}>
            <coneGeometry args={[0.1, 0.12, 20]} />
          </mesh>
          <mesh material={M.porcelain()} position-y={0.18}>
            <capsuleGeometry args={[0.03, 0.12, 6, 10]} />
          </mesh>
          <mesh material={M.porcelain()} position-y={0.3}>
            <sphereGeometry args={[0.04, 14, 10]} />
          </mesh>
        </group>
      )}
    </group>
  );
}

/** Christmas teddy bear with a ribbon. */
export function TeddyBear() {
  const parts: [number, number, number, number][] = [
    [0, -0.25, 0, 0.42],
    [0, 0.3, 0.02, 0.3],
    [-0.24, 0.52, 0, 0.1],
    [0.24, 0.52, 0, 0.1],
    [-0.4, -0.1, 0.1, 0.13],
    [0.4, -0.1, 0.1, 0.13],
    [-0.24, -0.6, 0.18, 0.15],
    [0.24, -0.6, 0.18, 0.15],
  ];
  return (
    <group position-y={0.05} rotation-y={-0.25} scale={0.9}>
      {parts.map(([x, y, z, r], i) => (
        <mesh key={i} material={M.plush()} position={[x, y, z]}>
          <sphereGeometry args={[r, 28, 20]} />
        </mesh>
      ))}
      <mesh material={M.cream()} position={[0, 0.24, 0.27]} scale={[1, 0.8, 0.7]}>
        <sphereGeometry args={[0.12, 20, 14]} />
      </mesh>
      <mesh material={M.ink()} position={[0, 0.28, 0.36]}>
        <sphereGeometry args={[0.035, 12, 10]} />
      </mesh>
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} material={M.ink()} position={[x, 0.38, 0.26]}>
          <sphereGeometry args={[0.03, 12, 10]} />
        </mesh>
      ))}
      <mesh material={M.ribbon()} position={[0, 0.06, 0.06]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.22, 0.03, 8, 30]} />
      </mesh>
    </group>
  );
}

/** A child's crayon drawing of home (appears only through the haunted search). */
export function ChildsDrawing() {
  const tex = useCanvasTexture(
    512,
    384,
    (g, w, h) => {
      g.fillStyle = '#f4ecd8';
      g.fillRect(0, 0, w, h);
      g.lineWidth = 6;
      g.lineCap = 'round';
      g.strokeStyle = '#c0392b';
      g.strokeRect(w * 0.35, h * 0.35, w * 0.3, h * 0.3);
      g.beginPath();
      g.moveTo(w * 0.32, h * 0.36);
      g.lineTo(w * 0.5, h * 0.18);
      g.lineTo(w * 0.68, h * 0.36);
      g.stroke();
      g.strokeStyle = '#f1c40f';
      g.beginPath();
      g.arc(w * 0.85, h * 0.15, 30, 0, Math.PI * 2);
      g.stroke();
      const colors = ['#2c3e50', '#8e44ad', '#16a085', '#d35400', '#2980b9'];
      colors.forEach((c, i) => {
        const x = w * (0.12 + i * 0.19);
        g.strokeStyle = c;
        g.beginPath();
        g.arc(x, h * 0.72, 12, 0, Math.PI * 2);
        g.moveTo(x, h * 0.75);
        g.lineTo(x, h * 0.9);
        g.moveTo(x - 14, h * 0.8);
        g.lineTo(x + 14, h * 0.8);
        g.stroke();
      });
      g.fillStyle = '#2c3e50';
      g.font = '28px "Comic Sans MS", cursive';
      g.fillText('HOME', w * 0.42, h * 0.98);
    },
    [],
  );
  return (
    <mesh rotation={[-0.2, -0.15, 0.04]}>
      <planeGeometry args={[1.6, 1.2]} />
      <meshStandardMaterial map={tex} roughness={0.95} side={THREE.DoubleSide} />
    </mesh>
  );
}
