import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFx } from '../../fx/fxStore';
import { useCanvasTexture } from '../../gl/canvasTex';
import { M } from '../../gl/materials';
import { useHaunted } from '../../store';
import { useTaken } from '../../gl/useTaken';
import { GlobeGhost } from './GlobeGhost';

export { GlassOrnament } from './Ornament';
export { ChocolateBox } from './Chocolates';
export { MusicBox } from './MusicBox';
export { TeddyBear } from './Teddy';

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
  // Taken: it goes out (and the whole page goes dark with it, drawn by the FX layer).
  // Only a thread of smoke and the faint shape of the candle remain.
  const { taken } = useTaken('candle');
  return (
    <group position-y={-0.15}>
      <mesh material={M.candleWax()}>
        <cylinderGeometry args={[0.28, 0.3, 0.9, 40]} />
      </mesh>
      <mesh material={M.ink()} position-y={0.5}>
        <cylinderGeometry args={[0.01, 0.01, 0.1, 6]} />
      </mesh>
      {!taken ? (
        <>
          <mesh ref={flame} material={M.flame()} position-y={0.62}>
            <coneGeometry args={[0.06, 0.22, 16]} />
          </mesh>
          <pointLight position={[0, 0.7, 0.2]} intensity={1.2 + (1 - mains)} distance={2.5} color="#ffb860" />
        </>
      ) : (
        <mesh position-y={0.85}>
          <coneGeometry args={[0.05, 0.6, 10, 1, true]} />
          <meshBasicMaterial color="#8a8a8a" transparent opacity={0.18} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

/** Snow globe with a little house; ash instead of snow after the Reveal (Requirement 32.1). */
export function SnowGlobe() {
  const haunted = useHaunted();
  const { taken } = useTaken('snow-globe');
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
      {taken && <GlobeGhost />}
      <mesh material={M.glass()}>
        <sphereGeometry args={[0.6, 48, 36]} />
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
