import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useState } from 'react';
import * as THREE from 'three';
import type { ProductId } from '../core/ids';
import { MODELS } from '../products/models';
import { useHaunted } from '../store';
import { SceneEnv } from './env';
import { Shadow } from './Shadow';
import { Studio } from './Studio';
import { HauntedInspection } from './HauntedInspection';

/**
 * The second WebGL context, alive only while a product view is open (Requirement 27.2).
 * Lets the visitor turn and zoom the object (Requirement 5.2). In the Haunted state the
 * product's haunted inspection plays around it (Requirement 5.3).
 */
export default function InspectionCanvas({ id, inspecting = false }: { id: ProductId; inspecting?: boolean }) {
  const Model = MODELS[id];
  const haunted = useHaunted();
  const [ready, setReady] = useState(false);
  if (!Model) return null;
  return (
    <div className="inspection-canvas" data-ready={ready} data-testid="inspection-canvas">
      <Canvas
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.setClearColor(0x000000, 0);
          setReady(true);
        }}
      >
        <SceneEnv />
        <Studio distance={inspecting ? 2.2 : 2.8} fov={32} />
        <Suspense fallback={null}>
          <Model open={inspecting} />
        </Suspense>
        <Shadow />
        {haunted && inspecting && <HauntedInspection id={id} />}
        <OrbitControls enablePan={false} minDistance={1.4} maxDistance={4.2} makeDefault />
      </Canvas>
    </div>
  );
}
