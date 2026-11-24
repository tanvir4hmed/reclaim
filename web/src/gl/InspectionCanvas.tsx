import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
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
          gl.toneMapping = THREE.NeutralToneMapping;
          gl.setClearColor(0x000000, 0);
          setReady(true);
        }}
      >
        <SceneEnv />
        <Studio distance={inspecting ? 2.2 : 2.8} fov={32} />
        <Suspense fallback={null}>
          <Framed margin={inspecting ? 1.08 : 1.32} refit={inspecting}>
            <Model open />
          </Framed>
        </Suspense>
        <Shadow />
        {haunted && inspecting && <HauntedInspection id={id} />}
        <OrbitControls enablePan={false} minDistance={1.4} maxDistance={4.2} makeDefault />
      </Canvas>
    </div>
  );
}

const box = new THREE.Box3();
const part = new THREE.Box3();
const centre = new THREE.Vector3();
const extent = new THREE.Vector3();
/** The direction the camera looks from: a little above, as the Studio camera does. */
const FROM = new THREE.Vector3(0, 0.25, 2.8).normalize();

/** The bounds of what is drawn: visible meshes only (hidden spare parts and points are left out). */
function visibleBounds(root: THREE.Object3D): THREE.Box3 {
  box.makeEmpty();
  root.updateWorldMatrix(true, true);
  root.traverseVisible((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const b = m.geometry.boundingBox;
    if (!b || b.isEmpty()) return;
    part.copy(b).applyMatrix4(m.matrixWorld);
    box.union(part);
  });
  return box;
}

/**
 * Frames the whole object in the product view, whatever its height or width: the camera is
 * moved back until the object's visible bounds fit the view with `margin` of breathing space
 * round them, and the orbit turns about the object's middle. Without this the tall objects
 * lost their tops or bottoms at the fixed distance the cards use.
 */
function Framed({ children, margin, refit }: { children: ReactNode; margin: number; refit: boolean }) {
  const group = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as Orbit | null;
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const frames = useRef(0);
  useEffect(() => {
    frames.current = 0;
  }, [width, height, refit, controls]);
  useFrame(() => {
    const g = group.current;
    // wait two frames, so every model has laid itself out once before it is measured
    if (!g || frames.current > 2) return;
    frames.current += 1;
    if (frames.current === 2) fitCamera(g, camera, controls, width / Math.max(1, height), margin);
  });
  return <group ref={group}>{children}</group>;
}

type Orbit = { target: THREE.Vector3; update: () => void; minDistance: number; maxDistance: number };

/** Outside the component, so the React compiler rules see no mutation of hook values. */
function fitCamera(g: THREE.Object3D, camera: THREE.PerspectiveCamera, controls: Orbit | null, aspect: number, margin: number) {
  const b = visibleBounds(g);
  if (b.isEmpty()) return;
  b.getCenter(centre);
  b.getSize(extent);
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const fitH = ((extent.y / 2) * margin) / tan;
  const fitW = ((extent.x / 2) * margin) / (tan * aspect);
  const dist = Math.max(fitH, fitW, 1.2) + extent.z / 2;
  camera.position.copy(centre).addScaledVector(FROM, dist);
  camera.lookAt(centre);
  camera.updateProjectionMatrix();
  if (controls) {
    controls.target.copy(centre);
    controls.minDistance = dist * 0.55;
    controls.maxDistance = dist * 1.6;
    controls.update();
  }
}
