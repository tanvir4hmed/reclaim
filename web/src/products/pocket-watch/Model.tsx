import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { M } from '../../gl/materials';
import { useFx } from '../../fx/fxStore';
import { useHaunted, useStory } from '../../store';
import { reducedMotion } from '../../director/runtime';

/** Stopped at 4:17 in the Haunted state (copy: "It stopped at 4:17"). */
const STOPPED = { h: 4, m: 17, s: 0 };

function useWatchTime(open: boolean) {
  const haunted = useHaunted();
  const reverse = useStory((s) => s.story.clockDirection === -1);
  const invalidate = useThree((s) => s.invalidate);
  const t = useRef(STOPPED.h * 3600 + STOPPED.m * 60);
  useEffect(() => {
    const id = setInterval(() => invalidate(), 1000);
    return () => clearInterval(id);
  }, [invalidate]);
  return (dt: number, whirl = false) => {
    if (!haunted) {
      const d = new Date();
      return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
    }
    // Haunted: it ticks backward, one stiff second at a time, from 4:17; opened it runs
    // forward; carted it races backward (Req 14.2–14.3). The moment you take it, every hand
    // whips backward, hours in a second, as if winding your time off.
    const step = Math.min(dt, 0.1);
    if (whirl) t.current -= step * 2400;
    else if (open && !reverse) t.current += step;
    else if (reverse) t.current -= step * 4;
    else t.current -= step;
    // Second hand jumps in whole seconds, like a real escapement.
    return reverse ? t.current : Math.ceil(t.current);
  };
}

export default function PocketWatch({ open = false }: { open?: boolean }) {
  const hour = useRef<THREE.Mesh>(null);
  const minute = useRef<THREE.Mesh>(null);
  const second = useRef<THREE.Mesh>(null);
  const time = useWatchTime(open);
  const shudder = useFx((s) => s.flags['watch-shudder'] !== undefined);
  const chain = useMemo(() => {
    const pts = [
      new THREE.Vector3(0, 0.78, 0),
      new THREE.Vector3(0.25, 1.0, -0.1),
      new THREE.Vector3(0.75, 0.85, -0.2),
      new THREE.Vector3(1.05, 0.25, -0.15),
      new THREE.Vector3(1.0, -0.4, 0.05),
    ];
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.022, 6, false);
  }, []);
  const markers = useMemo(() => Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2), []);
  const hands = useMemo(
    () => ({
      hour: new THREE.BoxGeometry(0.035, 0.26, 0.006).translate(0, 0.11, 0),
      minute: new THREE.BoxGeometry(0.022, 0.38, 0.006).translate(0, 0.17, 0),
      second: new THREE.BoxGeometry(0.008, 0.42, 0.004).translate(0, 0.16, 0),
    }),
    [],
  );

  useFrame((_, dt) => {
    const s = time(reducedMotion() ? 0 : dt, shudder);
    if (second.current) second.current.rotation.z = -((s % 60) / 60) * Math.PI * 2;
    if (minute.current) minute.current.rotation.z = -(((s / 60) % 60) / 60) * Math.PI * 2;
    if (hour.current) hour.current.rotation.z = -(((s / 3600) % 12) / 12) * Math.PI * 2;
    // Carted: the hands stop and shudder once before running backward (Req 14.3).
    if (shudder && minute.current) minute.current.rotation.z += Math.sin(performance.now() / 18) * 0.08;
  });

  return (
    <group rotation={[-0.35, -0.25, 0.08]} position={[-0.12, 0.02, 0]}>
      <mesh material={M.brass()} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.6, 0.6, 0.16, 64]} />
      </mesh>
      <mesh material={M.brass()} position-z={0.085}>
        <torusGeometry args={[0.57, 0.045, 16, 64]} />
      </mesh>
      <mesh material={M.enamel()} position-z={0.082}>
        <circleGeometry args={[0.53, 64]} />
      </mesh>
      {markers.map((a, i) => (
        <mesh key={i} material={M.ink()} position={[Math.sin(a) * 0.44, Math.cos(a) * 0.44, 0.086]} rotation-z={-a}>
          <boxGeometry args={[i % 3 === 0 ? 0.03 : 0.015, i % 3 === 0 ? 0.1 : 0.06, 0.004]} />
        </mesh>
      ))}
      <group position-z={0.09}>
        <mesh ref={hour} material={M.ink()} geometry={hands.hour} />
        <mesh ref={minute} material={M.ink()} position-z={0.004} geometry={hands.minute} />
        <mesh ref={second} material={M.wax()} position-z={0.008} geometry={hands.second} />
        <mesh material={M.brass()} position-z={0.012} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.025, 0.025, 0.02, 16]} />
        </mesh>
      </group>
      <mesh material={M.brass()} position-y={0.66}>
        <cylinderGeometry args={[0.07, 0.07, 0.12, 24]} />
      </mesh>
      <mesh material={M.brass()} position-y={0.78}>
        <torusGeometry args={[0.1, 0.022, 12, 32]} />
      </mesh>
      <mesh material={M.brass()} geometry={chain} />
    </group>
  );
}
