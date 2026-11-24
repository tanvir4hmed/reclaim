import type { Ref } from 'react';
import * as THREE from 'three';

/*
 * A human skull, modelled facing +z. `FaceUpSkull` lays it on its back so the face looks
 * straight up (the truffles); `UprightSkull` stands it up facing you (the gift's jack-in-the-box,
 * the music box). Geometry, the aged-bone texture and the materials are shared by every skull.
 */
let shared: ReturnType<typeof build> | null = null;

/** Old bone: yellowed and stained, darker in the pores and along the sutures, with fine cracks. */
function boneTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = '#cdbf9e';
    g.fillRect(0, 0, 256, 128);
    let s = 7;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    // blotches of yellowing and grime
    for (let i = 0; i < 70; i++) {
      g.fillStyle = r() < 0.5 ? `rgba(150,120,70,${0.08 + r() * 0.12})` : `rgba(70,55,35,${0.05 + r() * 0.1})`;
      g.beginPath();
      g.ellipse(r() * 256, r() * 128, 4 + r() * 22, 3 + r() * 12, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
    // pores
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = `rgba(60,45,28,${0.12 + r() * 0.25})`;
      g.fillRect(r() * 256, r() * 128, 1, 1);
    }
    // the zig-zag suture over the crown, and hairline cracks
    g.strokeStyle = 'rgba(55,40,25,0.7)';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x <= 256; x += 4) g.lineTo(x, 20 + ((x / 4) % 2 ? 3 : -3) + Math.sin(x / 30) * 4);
    g.stroke();
    g.strokeStyle = 'rgba(40,28,18,0.55)';
    for (let i = 0; i < 9; i++) {
      let x = r() * 256;
      let y = r() * 128;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += (r() - 0.5) * 18;
        y += r() * 9;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function build() {
  const tex = boneTexture();
  return {
    sphere: new THREE.SphereGeometry(1, 32, 22),
    lowSphere: new THREE.SphereGeometry(1, 14, 10),
    box: new THREE.BoxGeometry(1, 1, 1),
    toothGeo: new THREE.CapsuleGeometry(0.5, 0.9, 3, 8),
    nose: new THREE.ConeGeometry(1, 1, 3),
    ring: new THREE.TorusGeometry(1, 0.18, 8, 24),
    disc: new THREE.CircleGeometry(1, 20),
    bone: new THREE.MeshStandardMaterial({ color: '#e6dcc4', map: tex, bumpMap: tex, bumpScale: 0.6, roughness: 0.78 }),
    boneDark: new THREE.MeshStandardMaterial({ color: '#b8a888', map: tex, roughness: 0.85 }),
    hollow: new THREE.MeshStandardMaterial({ color: '#6e5d44', map: tex, roughness: 0.9 }),
    tooth: new THREE.MeshStandardMaterial({ color: '#e2d6b4', roughness: 0.45 }),
    toothOld: new THREE.MeshStandardMaterial({ color: '#a8935e', roughness: 0.6 }),
    hole: new THREE.MeshBasicMaterial({ color: '#050202' }),
    deep: new THREE.MeshStandardMaterial({ color: '#1c120b', roughness: 1 }),
    crack: new THREE.MeshBasicMaterial({ color: '#160d07' }),
    blood: new THREE.MeshStandardMaterial({ color: '#5c0609', roughness: 0.18, metalness: 0.05 }),
    bloodDry: new THREE.MeshStandardMaterial({ color: '#3e0405', roughness: 0.55 }),
  };
}

function parts() {
  shared ??= build();
  return shared;
}

type V3 = [number, number, number];

/** Upper and lower teeth along the curve of the jaw (x across, z forward); `gap` marks lost ones. */
const UPPER: { p: V3; gap?: boolean }[] = [-0.08, -0.054, -0.028, -0.009, 0.009, 0.028, 0.054, 0.08].map((x, i) => ({
  p: [x, -0.152, 0.205 - Math.abs(x) * 0.62],
  gap: i === 2 || i === 6,
}));
const LOWER: { p: V3; gap?: boolean }[] = [-0.066, -0.04, -0.014, 0.014, 0.04, 0.066].map((x, i) => ({ p: [x, -0.198, 0.185 - Math.abs(x) * 0.7], gap: i === 4 }));
/** Smears and runs of blood over the face and cranium: [position, scale]. */
const SMEARS: [V3, V3][] = [
  [[0.04, 0.13, 0.19], [0.11, 0.05, 0.03]],
  [[-0.11, 0.06, 0.2], [0.04, 0.09, 0.02]],
  [[0.1, -0.06, 0.18], [0.03, 0.08, 0.02]],
  [[-0.03, -0.16, 0.2], [0.07, 0.02, 0.02]],
  [[0.16, 0.12, 0.08], [0.05, 0.1, 0.04]],
];
/** A crack running back over the crown from the brow (broken skulls). */
const CRACK: V3[] = [
  [0.05, 0.12, 0.2],
  [0.07, 0.17, 0.15],
  [0.06, 0.22, 0.08],
  [0.09, 0.25, -0.01],
  [0.08, 0.25, -0.09],
];

interface SkullProps {
  /** Burning eyes deep in the sockets; their materials are handed back so they can flicker. */
  embers?: Ref<THREE.MeshBasicMaterial>[];
  /** 'small': fewer parts, for the two dozen in the truffle box. */
  detail?: 'full' | 'small';
  /** Blood smeared over it (and a pool under it when it lies face up). */
  bloody?: boolean;
  /** Old and broken: a cracked crown, a chipped hole, lost teeth, darker stains. */
  broken?: boolean;
}

/** The skull itself, facing +z, centred on the cranium. */
function SkullBody({ embers, detail = 'full', bloody = true, broken = false }: SkullProps) {
  const p = parts();
  const full = detail === 'full';
  return (
    <group>
      {/* cranium, a little long front to back, and the temples hollowed in at the sides */}
      <mesh geometry={p.sphere} material={p.bone} position={[0, 0.04, -0.03]} scale={[0.22, 0.23, 0.26]} />
      {full &&
        [-1, 1].map((s) => (
          <mesh key={s} geometry={p.lowSphere} material={p.hollow} position={[s * 0.19, 0.0, 0.07]} scale={[0.04, 0.08, 0.07]} />
        ))}
      {/* brow ridge, cheekbones and the arches back toward the ears */}
      <mesh geometry={p.sphere} material={p.bone} position={[0, 0.045, 0.15]} scale={[0.17, 0.05, 0.07]} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={p.lowSphere} material={p.bone} position={[s * 0.12, -0.05, 0.13]} scale={[0.058, 0.045, 0.07]} />
          {full && <mesh geometry={p.lowSphere} material={p.boneDark} position={[s * 0.17, -0.055, 0.05]} scale={[0.03, 0.022, 0.08]} />}
        </group>
      ))}
      {/* upper jaw under the nose */}
      <mesh geometry={p.sphere} material={p.boneDark} position={[0, -0.095, 0.125]} scale={[0.13, 0.085, 0.1]} />
      {/* eye sockets: a rim of bone, black and deep inside */}
      {[-1, 1].map((s, i) => (
        <group key={s} position={[s * 0.07, -0.005, 0.185]}>
          {full && <mesh geometry={p.ring} material={p.bone} scale={[0.056, 0.05, 0.03]} />}
          <mesh geometry={p.sphere} material={p.deep} scale={[0.054, 0.049, 0.036]} />
          <mesh geometry={p.sphere} material={p.hole} position-z={-0.004} scale={[0.044, 0.04, 0.032]} />
          {embers?.[i] && (
            <mesh geometry={p.lowSphere} position-z={0.012} scale={0.016}>
              <meshBasicMaterial ref={embers[i]} color="#ff5a1a" toneMapped={false} />
            </mesh>
          )}
        </group>
      ))}
      {/* the nose hole: two narrow openings, an upside-down heart */}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={p.nose} material={p.hole} position={[s * 0.011, -0.076, 0.214]} rotation-z={Math.PI + s * 0.18} scale={[0.016, 0.052, 0.012]} />
      ))}
      {/* teeth, each its own, yellowed, with gaps where some are lost; a dark line at the gum */}
      <mesh geometry={p.box} material={p.deep} position={[0, -0.135, 0.17]} scale={[0.17, 0.01, 0.07]} />
      {full
        ? UPPER.map((t) =>
            broken && t.gap ? null : <mesh key={t.p[0]} geometry={p.toothGeo} material={broken ? p.toothOld : p.tooth} position={t.p} scale={[0.021, 0.022, 0.016]} />,
          )
        : <mesh geometry={p.box} material={p.tooth} position={[0, -0.152, 0.17]} scale={[0.15, 0.03, 0.05]} />}
      {/* the jaw hangs a little open: black between the rows */}
      <mesh geometry={p.box} material={p.hole} position={[0, -0.174, 0.155]} scale={[0.15, 0.022, 0.06]} />
      <mesh geometry={p.sphere} material={p.boneDark} position={[0, -0.228, 0.1]} scale={[0.12, 0.035, 0.1]} />
      {full && <mesh geometry={p.lowSphere} material={p.boneDark} position={[0, -0.245, 0.17]} scale={[0.04, 0.025, 0.03]} />}
      {full
        ? LOWER.map((t) =>
            broken && t.gap ? null : <mesh key={t.p[0]} geometry={p.toothGeo} material={broken ? p.toothOld : p.tooth} position={t.p} scale={[0.02, 0.02, 0.015]} />,
          )
        : <mesh geometry={p.box} material={p.tooth} position={[0, -0.198, 0.16]} scale={[0.12, 0.026, 0.05]} />}
      {broken && (
        <>
          {/* a crack over the crown, and a piece broken out of the side of the skull */}
          {CRACK.slice(1).map((b, i) => {
            const a = CRACK[i]!;
            const mid: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
            const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
            return (
              <mesh key={i} geometry={p.box} material={p.crack} position={mid} rotation={[Math.atan2(b[1] - a[1], b[2] - a[2]) - Math.PI / 2, 0, (i % 2 ? 0.3 : -0.3)]} scale={[0.006, len * 1.05, 0.006]} />
            );
          })}
          <mesh geometry={p.sphere} material={p.hole} position={[-0.13, 0.16, 0.02]} scale={[0.05, 0.04, 0.05]} />
          <mesh geometry={p.ring} material={p.boneDark} position={[-0.135, 0.165, 0.025]} rotation={[0.4, -0.9, 0.2]} scale={0.052} />
        </>
      )}
      {bloody &&
        (full ? SMEARS : SMEARS.slice(0, 3)).map(([pos, sc], i) => (
          <mesh key={i} geometry={p.lowSphere} material={i % 2 ? p.bloodDry : p.blood} position={pos} scale={sc} />
        ))}
      {bloody && full && <mesh geometry={p.lowSphere} material={p.blood} position={[0, -0.005, 0.18]} scale={[0.03, 0.008, 0.02]} />}
    </group>
  );
}

/** Lying on the back of its head: the sockets, the nose hole and the teeth look straight up. */
export function FaceUpSkull(props: SkullProps) {
  const p = parts();
  const full = (props.detail ?? 'full') === 'full';
  return (
    <group rotation-x={-Math.PI / 2} position-y={0.2}>
      <SkullBody {...props} />
      {/* lying in it */}
      {props.bloody !== false && <mesh geometry={p.disc} material={p.blood} position={[0.02, 0.02, -0.29]} scale={full ? 0.34 : 0.3} />}
    </group>
  );
}

/** Standing, facing you (+z). Centred on the cranium; the jaw reaches down to about y −0.25. */
export function UprightSkull(props: SkullProps) {
  return <SkullBody {...props} />;
}
