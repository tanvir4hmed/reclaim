import type { Ref } from 'react';
import * as THREE from 'three';

/*
 * A human skull, modelled facing +z, then laid on its back so the face looks straight up:
 * eye sockets, the nose hole and the teeth are what you see from above, not the round top.
 * Geometry and materials are shared by every skull (the truffle box holds two dozen).
 */
let shared: ReturnType<typeof build> | null = null;

function build() {
  return {
    sphere: new THREE.SphereGeometry(1, 28, 20),
    lowSphere: new THREE.SphereGeometry(1, 14, 10),
    box: new THREE.BoxGeometry(1, 1, 1),
    nose: new THREE.ConeGeometry(1, 1, 3),
    disc: new THREE.CircleGeometry(1, 20),
    bone: new THREE.MeshStandardMaterial({ color: '#d4c8ab', roughness: 0.72 }),
    boneDark: new THREE.MeshStandardMaterial({ color: '#b4a685', roughness: 0.8 }),
    tooth: new THREE.MeshStandardMaterial({ color: '#e8dfc6', roughness: 0.45 }),
    hole: new THREE.MeshBasicMaterial({ color: '#060303' }),
    blood: new THREE.MeshStandardMaterial({ color: '#5c0609', roughness: 0.18, metalness: 0.05 }),
    bloodDry: new THREE.MeshStandardMaterial({ color: '#3e0405', roughness: 0.55 }),
  };
}

function parts() {
  shared ??= build();
  return shared;
}

type V3 = [number, number, number];

/** Teeth along the curve of the jaw (x across, z forward). */
const UPPER: V3[] = [-0.075, -0.045, -0.015, 0.015, 0.045, 0.075].map((x) => [x, -0.148, 0.2 - Math.abs(x) * 0.55]);
const LOWER: V3[] = [-0.06, -0.03, 0, 0.03, 0.06].map((x) => [x, -0.2, 0.18 - Math.abs(x) * 0.6]);
/** Smears and runs of blood over the face and cranium: [position, scale]. */
const SMEARS: [V3, V3][] = [
  [[0.04, 0.13, 0.19], [0.11, 0.05, 0.03]],
  [[-0.11, 0.06, 0.2], [0.04, 0.09, 0.02]],
  [[0.1, -0.06, 0.18], [0.03, 0.08, 0.02]],
  [[-0.03, -0.16, 0.2], [0.07, 0.02, 0.02]],
  [[0.16, 0.12, 0.08], [0.05, 0.1, 0.04]],
];

export function FaceUpSkull({
  embers,
  detail = 'full',
}: {
  /** Burning eyes deep in the sockets (the gift); their materials are handed back to flicker. */
  embers?: Ref<THREE.MeshBasicMaterial>[];
  detail?: 'full' | 'small';
}) {
  const p = parts();
  const full = detail === 'full';
  return (
    // Lying on the back of its head: +z (the face) turns to +y.
    <group rotation-x={-Math.PI / 2} position-y={0.2}>
      {/* cranium, a little long front to back */}
      <mesh geometry={p.sphere} material={p.bone} position={[0, 0.04, -0.03]} scale={[0.22, 0.23, 0.26]} />
      {/* brow ridge and cheekbones */}
      <mesh geometry={p.sphere} material={p.bone} position={[0, 0.045, 0.15]} scale={[0.17, 0.05, 0.07]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={p.lowSphere} material={p.bone} position={[s * 0.12, -0.05, 0.12]} scale={[0.055, 0.045, 0.07]} />
      ))}
      {/* the face: upper jaw and the bridge of the nose */}
      <mesh geometry={p.sphere} material={p.boneDark} position={[0, -0.09, 0.12]} scale={[0.14, 0.09, 0.1]} />
      {/* eye sockets: deep and black */}
      {[-1, 1].map((s, i) => (
        <group key={s} position={[s * 0.07, -0.005, 0.185]}>
          <mesh geometry={p.sphere} material={p.hole} scale={[0.055, 0.05, 0.035]} />
          {embers?.[i] && (
            <mesh geometry={p.lowSphere} position-z={0.012} scale={0.018}>
              <meshBasicMaterial ref={embers[i]} color="#ff5a1a" toneMapped={false} />
            </mesh>
          )}
        </group>
      ))}
      {/* the nose hole, an upside-down heart */}
      <mesh geometry={p.nose} material={p.hole} position={[0, -0.075, 0.214]} rotation-z={Math.PI} scale={[0.024, 0.05, 0.012]} />
      {/* upper teeth */}
      {UPPER.map((t) => (
        <mesh key={t[0]} geometry={p.box} material={p.tooth} position={t} scale={[0.024, 0.034, 0.016]} />
      ))}
      {/* the jaw hangs a little open: black between the rows */}
      <mesh geometry={p.box} material={p.hole} position={[0, -0.172, 0.155]} scale={[0.15, 0.022, 0.06]} />
      <mesh geometry={p.sphere} material={p.boneDark} position={[0, -0.225, 0.1]} scale={[0.12, 0.035, 0.1]} />
      {LOWER.map((t) => (
        <mesh key={t[0]} geometry={p.box} material={p.tooth} position={t} scale={[0.024, 0.03, 0.016]} />
      ))}
      {/* blood: smeared over the brow and down the cheeks, dried darker on the crown */}
      {(full ? SMEARS : SMEARS.slice(0, 3)).map(([pos, sc], i) => (
        <mesh key={i} geometry={p.lowSphere} material={i % 2 ? p.bloodDry : p.blood} position={pos} scale={sc} />
      ))}
      {full && <mesh geometry={p.lowSphere} material={p.blood} position={[0, -0.005, 0.18]} scale={[0.03, 0.008, 0.02]} />}
      {/* lying in it */}
      <mesh geometry={p.disc} material={p.blood} position={[0.02, 0.02, -0.29]} scale={full ? 0.34 : 0.3} />
    </group>
  );
}
