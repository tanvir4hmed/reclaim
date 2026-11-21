import { View } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { useHaunted } from '../store';
import { decayUniforms } from './decay';
import { glBus } from './bus';

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
