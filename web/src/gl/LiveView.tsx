import { View } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import type { ProductId } from '../core/ids';
import { MODELS } from '../products/models';
import { useHaunted } from '../store';
import { glBus } from './bus';
import { bodyBounds, fitBounds, remember } from './fit';
import { useTaken } from './useTaken';
import { HauntedMotion } from './HauntedMotion';
import { SceneEnv } from './env';
import { Shadow } from './Shadow';
import { Studio } from './Studio';

/** Slow turn while the pointer is over the card (Requirement 31.3). */
function Turntable({ hover, children }: { hover: { current: boolean }; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const target = hover.current ? g.rotation.y + dt * 0.6 : 0;
    const next = hover.current ? target : g.rotation.y * (1 - Math.min(1, dt * 4));
    if (Math.abs(next - g.rotation.y) > 1e-4) {
      g.rotation.y = next;
      invalidate();
    }
  });
  return <group ref={group}>{children}</group>;
}

/**
 * Every product the same size and in the same place on its card: the model's main body (see
 * gl/fit) is scaled to fill the same share of the picture, whichever is the tighter of its
 * height and its width, and centred, with the same breathing space all round. Extras (a chain,
 * the room a Take grows into) do not count. Hidden until it has been measured, so it never jumps.
 */
const FILL = { h: 0.6, w: 0.62 };
const box = new THREE.Box3();
const framed = new THREE.Box3();
const mid = new THREE.Vector3();
const ext = new THREE.Vector3();

function Fit({ id, children, onFloor }: { id: ProductId; children: ReactNode; onFloor: (y: number) => void }) {
  const group = useRef<THREE.Group>(null);
  const haunted = useHaunted();
  const { taken } = useTaken(id);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const progress = useRef({ frames: 0, done: false });
  useEffect(() => {
    progress.current = { frames: 0, done: false };
  }, [haunted, width, height]);
  useFrame((st) => {
    const g = group.current;
    const p = progress.current;
    if (!g || p.done) return;
    // let every model lay itself out first (some build their shapes in their first frames)
    p.frames += 1;
    st.invalidate();
    if (p.frames < 3) return;
    const floor = fitCard(g, st.camera as THREE.PerspectiveCamera, width / Math.max(1, height), id, haunted, taken);
    p.done = true;
    if (floor !== null) onFloor(floor);
  });
  return (
    <group ref={group} visible={false}>
      {children}
    </group>
  );
}

/** Outside the component, so the React compiler rules see no mutation of hook values. */
function fitCard(g: THREE.Group, camera: THREE.PerspectiveCamera, aspect: number, id: ProductId, haunted: boolean, taken: boolean): number | null {
  g.scale.setScalar(1);
  g.position.set(0, 0, 0);
  g.visible = true;
  const state = haunted ? 'h' : 'd';
  const b = fitBounds(g, box, `card:${id}:${state}`, taken);
  // while it is whole, also remember the product view's measure, for its views after the Take
  if (!taken) remember(`view:${id}:${state}`, bodyBounds(g, framed, true));
  if (b.isEmpty()) return null;
  b.getCenter(mid);
  b.getSize(ext);
  const dist = Math.max(0.5, camera.position.z - mid.z);
  const visH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const visW = visH * aspect;
  const s = Math.min((FILL.h * visH) / Math.max(1e-3, ext.y), (FILL.w * visW) / Math.max(1e-3, ext.x));
  // the middle of the picture is level with the camera, which looks straight ahead
  const cy = camera.position.y - visH * 0.02;
  g.scale.setScalar(s);
  g.position.set(-mid.x * s, cy - mid.y * s, -mid.z * s);
  return cy - (ext.y * s) / 2;
}

export function LiveView({ id, className }: { id: ProductId; className?: string }) {
  const hover = useRef(false);
  const [floor, setFloor] = useState(-0.62);
  const Model = MODELS[id];
  if (!Model) return null;
  return (
    <div
      className={className}
      onPointerEnter={() => {
        hover.current = true;
        glBus.invalidate();
      }}
      onPointerLeave={() => (hover.current = false)}
    >
      <View className="live-view">
        <SceneEnv />
        <Studio />
        <Suspense fallback={null}>
          <Turntable hover={hover}>
            <HauntedMotion id={id}>
              <Fit id={id} onFloor={setFloor}>
                <Model />
              </Fit>
            </HauntedMotion>
          </Turntable>
        </Suspense>
        <Shadow y={floor} />
      </View>
    </div>
  );
}
