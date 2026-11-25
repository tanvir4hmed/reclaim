import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import type { ProductId } from '../core/ids';
import { MODELS } from '../products/models';
import { useHaunted } from '../store';
import { bodyBounds } from './fit';
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
  const [fitted, setFitted] = useState(false);
  // never leave the view blank if a model has nothing to measure
  useEffect(() => {
    const t = window.setTimeout(() => setFitted(true), 1500);
    return () => window.clearTimeout(t);
  }, []);
  if (!Model) return null;
  return (
    <div className="inspection-canvas" data-ready={ready} data-fitted={fitted} data-testid="inspection-canvas">
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
        {/* the distance is only a start: Framed fits the camera to the object */}
        <Studio distance={2.8} fov={32} />
        <Suspense fallback={null}>
          <Framed margin={inspecting ? 1.08 : 1.32} refit={inspecting} onFitted={() => setFitted(true)}>
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
const centre = new THREE.Vector3();
const extent = new THREE.Vector3();
/** The direction the camera looks from: a little above, as the Studio camera does. */
const FROM = new THREE.Vector3(0, 0.25, 2.8).normalize();

/**
 * Frames the object in the product view, whatever its height or width: the camera is moved
 * back until the object's main body (gl/fit) fits the view with `margin` of breathing space
 * round it, and the orbit turns about its middle; so every product is shown at the same size.
 * The room its Take grows into (a box marked `userData.frame`) counts from the start, so the
 * view stays where it is when the Take plays. Without this the tall objects
 * lost their tops or bottoms at the fixed distance the cards use.
 * The first fit happens before anything is shown (the canvas fades in once framed), so the
 * object never jumps as the view opens; a later refit (Inspect, a resize) glides there.
 */
function Framed({ children, margin, refit, onFitted }: { children: ReactNode; margin: number; refit: boolean; onFitted: () => void }) {
  const group = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as Orbit | null;
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const frames = useRef(0);
  const glide = useRef<Glide | null>(null);
  const fitted = useRef(false);
  useEffect(() => {
    frames.current = 0;
  }, [width, height, refit, controls]);
  useFrame((_, dt) => {
    const g = group.current;
    if (glide.current) glide.current = stepGlide(glide.current, camera, controls, dt);
    // wait for the orbit controls and two frames, so every model has laid itself out once
    if (!g || !controls || frames.current > 2) return;
    frames.current += 1;
    if (frames.current !== 2) return;
    const fit = fitFor(g, camera, width / Math.max(1, height), margin);
    if (!fit) return;
    if (fitted.current) {
      glide.current = { from: camera.position.clone(), fromTarget: controls.target.clone(), fit, t: 0 };
    } else {
      applyFit(fit, camera, controls, 1, camera.position.clone(), controls.target.clone());
      fitted.current = true;
      onFitted();
    }
  });
  return <group ref={group}>{children}</group>;
}

type Orbit = { target: THREE.Vector3; update: () => void; minDistance: number; maxDistance: number };
type Fit = { centre: THREE.Vector3; position: THREE.Vector3; dist: number };
type Glide = { from: THREE.Vector3; fromTarget: THREE.Vector3; fit: Fit; t: number };

/** Where the camera must stand to frame what is drawn, seen from `FROM`. */
function fitFor(g: THREE.Object3D, camera: THREE.PerspectiveCamera, aspect: number, margin: number): Fit | null {
  const b = bodyBounds(g, box, true);
  if (b.isEmpty()) return null;
  b.getCenter(centre);
  b.getSize(extent);
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const fitH = ((extent.y / 2) * margin) / tan;
  const fitW = ((extent.x / 2) * margin) / (tan * aspect);
  const dist = Math.max(fitH, fitW, 1.2) + extent.z / 2;
  return { centre: centre.clone(), position: centre.clone().addScaledVector(FROM, dist), dist };
}

/** Outside the component, so the React compiler rules see no mutation of hook values. */
function applyFit(fit: Fit, camera: THREE.PerspectiveCamera, controls: Orbit, k: number, from: THREE.Vector3, fromTarget: THREE.Vector3) {
  camera.position.lerpVectors(from, fit.position, k);
  controls.target.lerpVectors(fromTarget, fit.centre, k);
  camera.lookAt(controls.target);
  camera.updateProjectionMatrix();
  controls.minDistance = fit.dist * 0.55;
  controls.maxDistance = fit.dist * 1.6;
  controls.update();
}

/** One step of the glide to a new framing (about a third of a second, eased). */
function stepGlide(gl: Glide, camera: THREE.PerspectiveCamera, controls: Orbit | null, dt: number): Glide | null {
  if (!controls) return null;
  const t = Math.min(1, gl.t + dt / 0.35);
  const k = t * t * (3 - 2 * t);
  applyFit(gl.fit, camera, controls, k, gl.from, gl.fromTarget);
  return t >= 1 ? null : { ...gl, t };
}
