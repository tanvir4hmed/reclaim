import { useFrame } from '@react-three/fiber';
import { useRef, type ReactNode } from 'react';
import type * as THREE from 'three';
import type { ProductId } from '../core/ids';
import { reducedMotion } from '../director/runtime';
import { useHaunted } from '../store';

/**
 * After the Reveal nothing on the shelves is quite still (Requirement 31, haunted idle life).
 * Each object moves the way its owner would have made it move: the nutcracker turns to look, the
 * gift knocks from inside, the phone trembles before it rings. Motion is small and deniable,
 * comes in short bursts with long quiet gaps, and is off under reduced motion.
 * The doll is deliberately still: she only looks once you take her (her model). The watch
 * running backward lives inside its model.
 */

/** 0 most of the time; a smooth 0→1→0 bump lasting `len` seconds once every `period` seconds. */
function burst(t: number, period: number, len: number, phase: number): number {
  const k = (t + phase * period) % period;
  if (k > len) return 0;
  return Math.sin((k / len) * Math.PI);
}

/** A jittery shake inside a burst (fast, small, like something trying to get out). */
function shake(t: number, speed: number): number {
  return Math.sin(t * speed) * Math.sin(t * speed * 0.53 + 1.7);
}

type Pose = { x?: number; y?: number; rx?: number; ry?: number; rz?: number; s?: number };

const MOTION: Partial<Record<ProductId, (t: number) => Pose>> = {
  // The bear slumps and lifts its head again, as if it fell asleep waiting.
  'teddy-bear': (t) => ({ rx: burst(t, 7, 2.6, 0.1) * 0.16, rz: Math.sin(t * 0.6) * 0.025 }),
  // Something inside knocks: the box hops, the lid strains.
  'unopened-gift': (t) => {
    const b = burst(t, 5.5, 0.6, 0.3);
    return { y: b * 0.05, rz: shake(t, 40) * b * 0.05 };
  },
  // About to ring, never ringing.
  telephone: (t) => ({ rz: shake(t, 55) * burst(t, 6, 0.9, 0.6) * 0.04 }),
  // The music box rattles, the tune trying to start.
  'music-box': (t) => ({ rx: shake(t, 48) * burst(t, 8, 0.7, 0.2) * 0.035 }),
  'chocolate-box': (t) => ({ y: burst(t, 9, 0.4, 0.8) * 0.02 }),
  // The shoes shuffle a step toward the door and back.
  shoes: (t) => ({ x: burst(t, 10, 2, 0.7) * 0.06, rz: shake(t, 9) * burst(t, 10, 2, 0.7) * 0.02 }),
  // The frame hangs crooked and keeps swinging, though no one touched it.
  'photo-frame': (t) => ({ rz: Math.sin(t * 0.9) * 0.05 }),
  // The globe turns slowly, keeping its burnt house facing you.
  'snow-globe': (t) => ({ ry: Math.sin(t * 0.35) * 0.35 }),
  'valve-radio': (t) => ({ s: 1 + Math.sin(t * 50) * 0.002 + burst(t, 7, 0.5, 0.1) * 0.01 }),
  typewriter: (t) => ({ y: -Math.abs(shake(t, 30)) * burst(t, 5, 1.2, 0.9) * 0.015 }),
  'instant-camera': (t) => ({ rx: -burst(t, 8, 0.25, 0.35) * 0.08 }),
  letter: (t) => ({ rx: Math.sin(t * 2.1) * 0.03 * burst(t, 6, 2.5, 0.2) }),
  'advent-calendar': (t) => ({ rz: burst(t, 9, 3, 0.6) * 0.04 }),
  'childs-drawing': (t) => ({ rx: Math.sin(t * 1.3) * 0.04 }),
  candle: (t) => ({ rz: Math.sin(t * 0.8) * 0.015 }),
  // The hourglass leans, as if something inside shifted its weight.
  hourglass: (t) => ({ rz: burst(t, 9, 2.4, 0.3) * 0.03 }),
  // The sleigh creeps forward an inch and settles back.
  sleigh: (t) => ({ x: burst(t, 10, 2.2, 0.5) * 0.04 }),
  // The lamp rocks on its base, the lid rattling.
  'oil-lamp': (t) => ({ rz: shake(t, 36) * burst(t, 7, 0.6, 0.4) * 0.03 }),
  // The box twitches: the lid straining against the latch.
  'jack-in-the-box': (t) => ({ y: burst(t, 6.5, 0.35, 0.7) * 0.03 }),
  // The guard turns his head a little toward you, then back to attention.
  nutcracker: (t) => ({ ry: burst(t, 8, 3, 0.2) * 0.18 }),
  // The board is still; only the pointer drifts (in the model).
};

export function HauntedMotion({ id, children }: { id: ProductId; children: ReactNode }) {
  const haunted = useHaunted();
  const g = useRef<THREE.Group>(null);
  const fn = MOTION[id];
  useFrame((state) => {
    const el = g.current;
    if (!el) return;
    if (!haunted || !fn || reducedMotion()) {
      el.position.set(0, 0, 0);
      el.rotation.set(0, 0, 0);
      el.scale.setScalar(1);
      return;
    }
    const p = fn(state.clock.elapsedTime);
    el.position.set(p.x ?? 0, p.y ?? 0, 0);
    el.rotation.set(p.rx ?? 0, p.ry ?? 0, p.rz ?? 0);
    el.scale.setScalar(p.s ?? 1);
  });
  return <group ref={g}>{children}</group>;
}
