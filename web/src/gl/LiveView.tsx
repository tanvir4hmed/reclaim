import { View } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Suspense, useRef, type ReactNode } from 'react';
import type * as THREE from 'three';
import type { ProductId } from '../core/ids';
import { MODELS } from '../products/models';
import { glBus } from './bus';
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

export function LiveView({ id, className }: { id: ProductId; className?: string }) {
  const hover = useRef(false);
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
              <Model />
            </HauntedMotion>
          </Turntable>
        </Suspense>
        <Shadow />
      </View>
    </div>
  );
}
