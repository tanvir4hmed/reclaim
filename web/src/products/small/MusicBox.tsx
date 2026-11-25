import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SKULL_LAUNCH, skullLaunch } from '../../fx/scares/SkullPass';
import { M } from '../../gl/materials';
import { progress, useTaken } from '../../gl/useTaken';
import { useHaunted } from '../../store';
import { UprightSkull } from './Skull';
import { boing, springGeometry } from './spring';

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();

/** Where the big skull is on screen, and how big, for the pass (outside the component). */
function publishLaunch(head: THREE.Object3D, camera: THREE.Camera, canvas: HTMLCanvasElement) {
  if (!canvas.closest('.inspection-canvas')) return;
  head.updateWorldMatrix(true, false);
  head.getWorldPosition(tmpA);
  tmpB.copy(tmpA).add(new THREE.Vector3(0, 0.16, 0));
  tmpA.project(camera);
  tmpB.project(camera);
  const r = canvas.getBoundingClientRect();
  const x = r.left + ((tmpA.x + 1) / 2) * r.width;
  const y = r.top + ((1 - tmpA.y) / 2) * r.height;
  const top = r.top + ((1 - tmpB.y) / 2) * r.height;
  skullLaunch.at = { x, y, size: Math.max(20, Math.abs(y - top) * 2), when: performance.now() };
}

/** Where each skull comes up out of the box: x, z, how high, when, how it leans. */
const SKULLS: [number, number, number, number, number][] = [
  [0, 0.05, 0.8, 0.05, 0],
  [-0.36, -0.12, 0.55, 0.22, -0.35],
  [0.38, -0.1, 0.6, 0.32, 0.3],
  [-0.22, 0.2, 0.42, 0.45, -0.15],
  [0.24, 0.22, 0.46, 0.55, 0.2],
];

/**
 * The box after it is taken: the lid flung back, and skulls on springs bursting out of it. The
 * big one in the middle comes off its spring at SKULL_LAUNCH and flies out of the screen at you
 * (fx/scares/SkullPass takes it from here, from the very spot where it left the spring); its
 * empty spring stays and keeps twanging. The others go on bobbing in the box.
 */
function SkullsOut({ since }: { since: () => number }) {
  const spring = useMemo(() => springGeometry(10, 0.05, 1, 0.009), []);
  useEffect(() => () => spring.dispose(), [spring]);
  const coils = useRef<(THREE.Mesh | null)[]>([]);
  const heads = useRef<(THREE.Group | null)[]>([]);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const told = useRef(false);
  useFrame(() => {
    const s = since();
    // just before it goes, say where it is on screen (in the product view; on the shelf the
    // pass starts from the card)
    const big = heads.current[0];
    if (big && !told.current && s !== Infinity && s >= SKULL_LAUNCH - 0.05) {
      told.current = true;
      publishLaunch(big, camera, gl.domElement);
    }
    SKULLS.forEach(([, , tall, at, lean], i) => {
      const pop = progress(s, 0.22, at);
      // the middle spring, once its skull has torn off, twangs back hard and keeps springing
      // like the rest, light now, wobbling a little side to side
      const empty = i === 0 && s >= SKULL_LAUNCH;
      const bob = empty ? boing(s - SKULL_LAUNCH, 7) * 0.32 : pop > 0 ? boing(s - at, i) * 0.3 : 0;
      const h = Math.max(0.03, tall * pop * (1 + bob));
      const c = coils.current[i];
      if (c) {
        c.scale.set(1, h, 1);
        c.rotation.z = lean * pop + (empty ? boing(s - SKULL_LAUNCH, 3) * 0.12 : 0);
      }
      const g = heads.current[i];
      if (g) {
        // the top of the spring, carried over by the lean
        g.position.set(-Math.sin(lean * pop) * h, 0.225 + Math.cos(lean * pop) * h + 0.07, 0);
        g.rotation.z = lean * pop + boing(s - at, i + 2) * 0.2;
        // the big one has flown off its spring at you
        g.visible = pop > 0.01 && !(i === 0 && s >= SKULL_LAUNCH);
      }
    });
  });
  return (
    <group>
      {SKULLS.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh
            ref={(m) => {
              coils.current[i] = m;
            }}
            geometry={spring}
            material={M.silver()}
            position-y={0.225}
          />
          <group
            ref={(g) => {
              heads.current[i] = g;
            }}
            visible={false}
          >
            <group scale={i === 0 ? 0.32 : 0.26}>
              <UprightSkull broken bloody={i % 2 === 0} />
            </group>
          </group>
        </group>
      ))}
    </group>
  );
}

/**
 * Music box (Requirement 32.3). Shut, on the shelf and in the full view alike. Taken: the lid
 * bursts open and old skulls on springs shoot up out of it and keep bobbing; the biggest one
 * comes right out of the screen at you (the FX layer draws that one).
 */
export function MusicBox() {
  const { taken, since } = useTaken('music-box');
  const haunted = useHaunted();
  const lid = useRef<THREE.Group>(null);
  useFrame(() => {
    if (lid.current) lid.current.rotation.x = taken ? -progress(since(), 0.25) * 2.1 : 0;
  });
  return (
    <group rotation={[0.3, -0.5, 0]} position-y={-0.25}>
      <mesh material={M.wood()}>
        <boxGeometry args={[1.2, 0.45, 0.8]} />
      </mesh>
      <mesh material={M.gilt()} position={[0, 0.06, 0.405]}>
        <boxGeometry args={[0.5, 0.18, 0.01]} />
      </mesh>
      {/* the winding key on the side */}
      <mesh material={M.gilt()} position={[0.63, 0, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.02, 0.02, 0.08, 10]} />
      </mesh>
      <mesh material={M.gilt()} position={[0.68, 0, 0]} rotation-y={Math.PI / 2}>
        <torusGeometry args={[0.05, 0.012, 8, 20]} />
      </mesh>
      <group ref={lid} position={[0, 0.225, -0.4]}>
        <mesh material={M.wood()} position={[0, 0.03, 0.4]}>
          <boxGeometry args={[1.22, 0.06, 0.82]} />
        </mesh>
        <mesh material={M.mirror()} position={[0, -0.002, 0.4]} rotation-x={Math.PI / 2}>
          <planeGeometry args={[1.0, 0.65]} />
        </mesh>
      </group>
      {/* not drawn: after the Reveal, the room the springs shoot up into, so the product view frames it */}
      {haunted && (
        <mesh position-y={0.62}>
          <boxGeometry args={[1.2, 1.25, 0.8]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      )}
      {taken && (
        <>
          <mesh position-y={0.226} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[1.12, 0.72]} />
            <meshStandardMaterial color="#0a0605" roughness={1} />
          </mesh>
          <SkullsOut since={since} />
        </>
      )}
    </group>
  );
}
