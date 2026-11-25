import { View } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { useHaunted, useUi } from '../store';
import { decayUniforms } from './decay';
import { glBus } from './bus';
import { reducedMotion } from '../director/runtime';

/** Extra canvas above and below the viewport, as a share of its height (see `Slide`). */
const MARGIN = 0.2;

/**
 * Keeps the canvas glued to the page. The canvas is part of the scrolling document, a strip a
 * little taller than the window: the browser scrolls it with the page on its own thread, so the
 * objects never lag behind their shelves. Each frame it is slid to where the window now is and
 * the views are drawn for that spot (drei's View reads the canvas offset from `size`).
 */
function Slide({ slide }: { slide: RefObject<HTMLDivElement | null> }) {
  useFrame((state) => {
    const el = slide.current;
    if (el) slideTo(el, state.size);
  }, 0);
  return null;
}

/** Outside the component, so the React compiler rules see no mutation of hook values. */
function slideTo(el: HTMLDivElement, size: { top: number; left: number }) {
  const clip = el.parentElement;
  if (!clip) return;
  const vh = window.innerHeight;
  const m = Math.round(vh * MARGIN);
  const h = vh + 2 * m;
  if (el.style.height !== `${h}px`) el.style.height = `${h}px`;
  const sy = window.scrollY;
  const y = Math.max(0, Math.min(sy - m, clip.clientHeight - h));
  el.style.transform = `translate3d(0, ${y}px, 0)`;
  size.top = y - sy;
  size.left = -window.scrollX;
}

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
 * The one shared canvas for every card (design: Rendering layers, z 3). It lies over the
 * DOM with pointer events off, under the darkness so it dims with the lights; each card's
 * ObjectBox is a drei View tracked by it.
 */
export default function ShopCanvas() {
  const slide = useRef<HTMLDivElement>(null);
  return (
    <div className="shop-canvas-clip" aria-hidden="true">
      <div ref={slide} className="shop-canvas-slide">
        <Canvas
          className="shop-canvas"
          frameloop="demand"
          dpr={[1, 1.5]}
          resize={{ scroll: false }}
          eventSource={document.getElementById('root') ?? undefined}
          gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.NeutralToneMapping;
            gl.toneMappingExposure = 1.05;
            gl.setClearColor(0x000000, 0);
          }}
        >
          <Slide slide={slide} />
          <Invalidator />
          <View.Port />
        </Canvas>
      </div>
    </div>
  );
}
