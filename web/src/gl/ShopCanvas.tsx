import { View } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { useHaunted, useUi } from '../store';
import { decayUniforms } from './decay';
import { glBus } from './bus';
import { reducedMotion } from '../director/runtime';

/** Redraws on scroll and resize (views track DOM boxes) and while effects animate. */
function Invalidator() {
  const invalidate = useThree((s) => s.invalidate);
  const haunted = useHaunted();
  useEffect(() => {
    const on = () => invalidate();
    glBus.invalidate = invalidate;
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => {
      window.removeEventListener('scroll', on);
      window.removeEventListener('resize', on);
    };
  }, [invalidate]);
  // Without an animated Reveal (reload in the Haunted state), snap decay to its end state.
  useEffect(() => {
    if (!glBus.revealing) decayUniforms.uDecay.value = haunted ? 1 : 0;
    invalidate();
  }, [haunted, invalidate]);
  // After the Reveal the objects have idle life (HauntedMotion, the doll, the watch): redraw at a
  // modest rate while the tab is visible. Off-screen views are skipped by drei, so cost stays low.
  // Paused while a panel covers the shelves (cart drawer, product view), where no one sees it.
  // Each redraw waits for an idle moment, so a slow device (or software WebGL) backs off on its
  // own instead of starving clicks and timers; a fast one gets about 11 frames a second.
  useEffect(() => {
    if (!haunted || reducedMotion()) return;
    const idle =
      typeof window.requestIdleCallback === 'function'
        ? (fn: () => void) => window.requestIdleCallback(fn, { timeout: 1000 })
        : (fn: () => void) => window.setTimeout(fn, 200);
    let alive = true;
    let timer = 0;
    const tick = () => {
      if (!alive) return;
      if (!document.hidden && !useUi.getState().cartOpen && !document.querySelector('dialog[open]')) invalidate();
      timer = window.setTimeout(() => idle(tick), 90);
    };
    timer = window.setTimeout(() => idle(tick), 90);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [haunted, invalidate]);
  useFrame((state) => {
    decayUniforms.uTime.value = state.clock.elapsedTime;
  });
  return null;
}

/**
 * The one shared canvas for every card (design: Rendering layers, z 3). It sits over the
 * DOM with pointer events off; each card's ObjectBox is a drei View tracked by it.
 */
export default function ShopCanvas() {
  return (
    <Canvas
      className="shop-canvas"
      frameloop="demand"
      dpr={[1, 1.5]}
      eventSource={document.getElementById('root') ?? undefined}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 3 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.setClearColor(0x000000, 0);
      }}
    >
      <Invalidator />
      <View.Port />
    </Canvas>
  );
}
