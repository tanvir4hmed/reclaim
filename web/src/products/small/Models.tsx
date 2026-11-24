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
  // Taken: it goes out. The smoke from the wick rises into the shape of a ghost, and is gone.
  const { taken, since } = useTaken('candle');
  const gl = useThree((s) => s.gl);
  const onShelf = !gl.domElement.closest('.inspection-canvas');
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
        <>
          {/* the wick still glows a moment after it is blown out */}
          <mesh position-y={0.555}>
            <sphereGeometry args={[0.012, 8, 6]} />
            <meshBasicMaterial color="#ff7a30" toneMapped={false} transparent opacity={0.8} />
          </mesh>
          <SmokeGhost since={since} />
          {/* on the shelf the light it gave is gone too: the candle stands in a low light */}
          {onShelf && (
            // a dark veil all round the card's camera (seen from inside), over everything in it
            <mesh renderOrder={5}>
              <sphereGeometry args={[6, 24, 16]} />
              <meshBasicMaterial color="#020306" transparent opacity={0.42} depthWrite={false} depthTest={false} side={THREE.BackSide} />
            </mesh>
          )}
        </>
      )}
      {/* not drawn: the space above the wick the smoke rises into, so the product view frames it */}
      <mesh position-y={0.65}>
        <boxGeometry args={[0.7, 1.6, 0.4]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
}

const SMOKE_N = 340;
const WICK_Y = 0.56;
/** When (s after the take) the smoke gathers into her, holds, and goes. */
const SMOKE = { gather: 1.1, formed: 2.3, hold: 3.6, gone: 5.2 };

/** Points inside the ghost the smoke becomes, above the wick: her head, her shoulders, her
 *  arms raised a little, her body thinning back down into the thread of smoke. Hollow eyes. */
function ghostTargets(): THREE.Vector3[] {
  const r = (() => {
    let a = 91;
    return () => {
      a = (a * 1664525 + 1013904223) >>> 0;
      return a / 4294967296;
    };
  })();
  const inside = (x: number, y: number) => {
    // head
    const hx = x / 0.12;
    const hy = (y - 1.18) / 0.15;
    if (hx * hx + hy * hy < 1) {
      // the eyes and the mouth stay empty
      for (const [ex, ey, er] of [
        [-0.045, 1.2, 0.028],
        [0.045, 1.2, 0.028],
        [0, 1.11, 0.026],
      ] as const)
        if ((x - ex) ** 2 + (y - ey) ** 2 < er * er) return false;
      return true;
    }
    // shoulders to waist, narrowing toward the wick
    if (y < 1.04 && y > 0.62) {
      const half = 0.06 + ((y - 0.62) / 0.42) * 0.2;
      if (Math.abs(x) < half) return true;
    }
    // arms, out and a little up, from the shoulders
    for (const s of [-1, 1]) {
      const ax = x * s;
      if (ax > 0.18 && ax < 0.42) {
        const cy = 0.98 + (ax - 0.18) * 0.5;
        if (Math.abs(y - cy) < 0.035 - (ax - 0.18) * 0.06) return true;
      }
    }
    return false;
  };
  const out: THREE.Vector3[] = [];
  while (out.length < SMOKE_N) {
    const x = (r() - 0.5) * 0.9;
    const y = 0.6 + r() * 0.75;
    if (inside(x, y)) out.push(new THREE.Vector3(x, y, (r() - 0.5) * 0.08));
  }
  return out;
}

/** A soft round puff for each smoke particle. */
function drawPuff(g: CanvasRenderingContext2D, w: number, h: number) {
  const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.clearRect(0, 0, w, h);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
}

/**
 * The smoke of the candle that was blown out: it keeps coming off the wick, in a thin curling
 * thread, then the smoke above gathers into her shape, head, hollow eyes, arms, the rest of
 * her still the thread of smoke going down into the wick, as if the smoke was her all along.
 * She hangs there a moment, then drifts up and comes apart; the thread thins and stops.
 */
function SmokeGhost({ since }: { since: () => number }) {
  const targets = useMemo(() => ghostTargets(), []);
  const puff = useCanvasTexture(64, 64, drawPuff, []);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SMOKE_N * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(SMOKE_N * 4), 4));
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame((st) => updateSmoke(geo, targets, since(), st.clock.elapsedTime));
  return (
    <points geometry={geo}>
      {/* big soft puffs, overlapping, so it reads as smoke and not as dots */}
      <pointsMaterial map={puff} size={0.14} sizeAttenuation vertexColors transparent depthWrite={false} />
    </points>
  );
}

/** Outside the component, so the React compiler rules see no mutation of hook values. */
function updateSmoke(geo: THREE.BufferGeometry, targets: THREE.Vector3[], s: number, clock: number) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = geo.attributes.color as THREE.BufferAttribute;
  const p = pos.array as Float32Array;
  const c = col.array as Float32Array;
  // reduced motion or a reload: she has been and gone; nothing is left
  const t = s === Infinity ? 99 : s;
  const ease = (v: number) => v * v * (3 - 2 * v);
  const gather = ease(Math.min(1, Math.max(0, (t - SMOKE.gather) / (SMOKE.formed - SMOKE.gather))));
  const leave = Math.min(1, Math.max(0, (t - SMOKE.hold) / (SMOKE.gone - SMOKE.hold)));
  for (let i = 0; i < SMOKE_N; i++) {
    const tg = targets[i]!;
    // each puff leaves the wick in turn, over the first second and a half, and rises curling
    const born = (i / SMOKE_N) * 1.5;
    const age = Math.max(0, t - born);
    const rise = Math.min(0.9, age * 0.42);
    const curl = i * 2.399 + age * 2.2;
    const wx = Math.sin(curl) * (0.012 + rise * 0.05) + Math.sin(clock * 0.9 + i) * 0.008;
    const wz = Math.cos(curl) * (0.012 + rise * 0.04);
    const wy = WICK_Y + rise;
    // then it is drawn into her shape, and, when she goes, drifts up and spreads out
    const drift = leave * (0.35 + (i % 7) * 0.03);
    const sx = (Math.sin(i * 1.7) * 0.12 + Math.sin(clock * 0.7 + i) * 0.02) * leave;
    const x = wx + (tg.x - wx) * gather + sx;
    const y = wy + (tg.y - wy) * gather + drift + Math.sin(clock * 1.3 + i * 0.5) * 0.006 * gather;
    const z = wz + (tg.z - wz) * gather;
    p[i * 3] = x;
    p[i * 3 + 1] = y;
    p[i * 3 + 2] = z;
    const seen = age > 0 ? Math.min(1, age / 0.4) : 0;
    const a = seen * (0.16 + 0.2 * gather) * (1 - leave);
    c[i * 4] = 0.78;
    c[i * 4 + 1] = 0.77;
    c[i * 4 + 2] = 0.74;
    c[i * 4 + 3] = a;
  }
  pos.needsUpdate = true;
  col.needsUpdate = true;
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
