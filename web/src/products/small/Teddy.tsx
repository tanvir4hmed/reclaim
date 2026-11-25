import { useFrame, useThree } from '@react-three/fiber';
import { Decal } from '@react-three/drei';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { seeded } from '../../director/footprints';
import { teddyThroat } from '../../fx/scares/Slash';
import { useCanvasTexture } from '../../gl/canvasTex';
import { M } from '../../gl/materials';
import { progress, useTaken } from '../../gl/useTaken';

/*
 * The bear is built round its neck: the body below (chest top at y 0.1), a short neck, the head
 * above. The cut is through the neck at NECK_Y, so the blade goes through the throat.
 */
const NECK_Y = 0.11;
const FLOOR = -0.79;
/**
 * When the blade goes through, in seconds after the take: the stroke on screen starts at 0.12 s
 * and crosses the throat (the middle of the picture) at about 0.19 s; the neck parts right then.
 */
const CUT_AT = 0.19;
const GRAV = 3.2;

const BODY: [number, number, number, number][] = [
  [0, -0.3, 0, 0.4],
  [-0.24, -0.64, 0.18, 0.15],
  [0.24, -0.64, 0.18, 0.15],
];
const ARMS: [number, number, number][] = [
  [-0.38, -0.14, 0.1],
  [0.38, -0.14, 0.1],
];
/** The head, measured from the cut. */
const HEAD: [number, number, number, number][] = [
  [0, 0.27, 0.02, 0.28],
  [-0.22, 0.47, 0, 0.1],
  [0.22, 0.47, 0, 0.1],
];
/** Where the head comes to rest: on its side on the floor in front of the body, face to you. */
const HEAD_REST = new THREE.Vector3(-0.02, FLOOR + 0.26, 0.5);

interface Drop {
  v: THREE.Vector3;
  t0: number;
  land: number;
  at: THREE.Vector3;
  r: number;
}

/** Blood thrown from the neck as the blade goes through, and in the pulses after: where each lands. */
function makeDrops(): Drop[] {
  const rnd = seeded(13);
  return Array.from({ length: 44 }, (_, i) => {
    // the first spray is flung along the blade's path (to the right and toward you); the rest pump up
    const spray = i < 18;
    const a = spray ? -0.2 + rnd() * 0.9 : rnd() * Math.PI * 2;
    const sp = spray ? 1.3 + rnd() * 1.1 : 0.5 + rnd() * 0.6;
    const vy = spray ? 0.4 + rnd() * 0.9 : 1.1 + rnd() * 0.7;
    const v = new THREE.Vector3(Math.cos(a) * sp, vy, Math.sin(a) * sp * 0.8 + (spray ? 0.4 : 0.15));
    const t0 = spray ? rnd() * 0.08 : 0.3 + Math.floor((i - 18) / 6) * 0.55 + rnd() * 0.12;
    const h = NECK_Y + 0.05 - FLOOR;
    const land = (vy + Math.sqrt(vy * vy + 2 * GRAV * h)) / GRAV;
    const at = new THREE.Vector3(v.x * land, FLOOR + 0.004 + (i % 7) * 0.0004, v.z * land);
    return { v, t0, land, at, r: 0.018 + rnd() * 0.03 };
  });
}

const throatAt = new THREE.Vector3();

/** Project the cut through the neck onto the screen, with the picture it is in (outside the component). */
function publishThroat(root: THREE.Object3D, camera: THREE.Camera, canvas: HTMLCanvasElement) {
  if (!canvas.closest('.inspection-canvas')) return;
  root.updateWorldMatrix(true, false);
  throatAt.set(0, NECK_Y, 0.12);
  root.localToWorld(throatAt);
  throatAt.project(camera);
  const r = canvas.getBoundingClientRect();
  teddyThroat.at = {
    x: r.left + ((throatAt.x + 1) / 2) * r.width,
    y: r.top + ((1 - throatAt.y) / 2) * r.height,
    rect: { left: r.left, top: r.top, width: r.width, height: r.height },
    when: performance.now(),
  };
}

/**
 * Christmas teddy bear with a ribbon. Taken: one sword stroke through the throat. The head is
 * cut clean off: it slides down the slope of the cut, tips, drops and rolls onto the floor in
 * front of the body, and lies there on its side, still looking at you. The body jerks back,
 * then twitches; blood sprays out along the stroke, pumps up out of the neck in weakening
 * pulses, runs down the chest, soaks the fur and spreads across the floor under both.
 */
export function TeddyBear() {
  const { taken, since } = useTaken('teddy-bear');
  const head = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const arms = useRef<(THREE.Mesh | null)[]>([]);
  const root = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  useFrame((st) => {
    const h = head.current;
    const b = body.current;
    if (!h || !b) return;
    // where the throat is on screen, for the sword stroke (product view only, before the cut)
    if (root.current && (!taken || since() < 0.2)) publishThroat(root.current, camera, gl.domElement);
    if (!taken) {
      h.position.set(0, NECK_Y, 0);
      h.rotation.set(0, 0, 0);
      b.rotation.set(0, 0, 0);
      arms.current.forEach((m) => m?.rotation.set(0, 0, 0));
      return;
    }
    const s = since();
    const t = s === Infinity ? 9 : s - CUT_AT;
    if (t <= 0) return;
    // the head: it slides off down the cut (to its right, a little down), tips, falls, bounces,
    // rolls. The slide starts at full speed, so the neck is seen to part the instant the blade is through.
    const k = Math.min(1, t / 0.16);
    const slide = 1 - (1 - k) ** 3;
    const fall = Math.min(1, Math.max(0, (t - 0.18) / 0.42));
    const roll = progress(t, 0.55, 0.6);
    const bounce = t > 0.6 && t < 0.95 ? Math.sin(((t - 0.6) / 0.35) * Math.PI) * 0.06 : 0;
    const sx = 0.07 * slide;
    const sy = NECK_Y - 0.025 * slide;
    const fy = sy + (HEAD_REST.y - sy) * fall * fall;
    h.position.set(sx + (HEAD_REST.x - sx) * fall * 0.7 + (HEAD_REST.x * 0.3) * roll, fy + bounce, HEAD_REST.z * (0.6 * fall + 0.4 * roll));
    h.rotation.set(0.12 * fall, -0.15 * roll, -0.22 * slide - 1.05 * fall - 0.35 * roll);
    // the body: thrown back by the blow, then it twitches, the arms jerking, for a few seconds
    const jerk = t < 0.35 ? Math.sin((t / 0.35) * Math.PI) : 0;
    const spasm = t < 3.2 ? Math.max(0, Math.sin(t * 23) * Math.sin(t * 7.3)) * (1 - t / 3.2) : 0;
    b.rotation.set(-0.14 * jerk + 0.04 * spasm, 0.03 * spasm, 0.06 * Math.min(1, t / 1.5) + 0.03 * spasm);
    b.position.x = Math.sin(st.clock.elapsedTime * 60) * 0.006 * spasm;
    arms.current.forEach((m, i) => {
      if (!m) return;
      const tw = t < 3.4 ? Math.max(0, Math.sin(t * (17 + i * 6) + i)) * (1 - t / 3.4) : 0;
      m.rotation.set(-0.5 * jerk - 0.6 * tw, 0, (i ? -1 : 1) * (0.2 * jerk + 0.35 * tw));
    });
  });
  return (
    <group ref={root} position-y={0.05} rotation-y={-0.25} scale={0.9}>
      <group ref={body}>
        {BODY.map(([x, y, z, r], i) => (
          <mesh key={i} material={M.plush()} position={[x, y, z]}>
            <sphereGeometry args={[r, 28, 20]} />
            {i === 0 && taken && <ChestBlood since={since} />}
          </mesh>
        ))}
        {ARMS.map(([x, y, z], i) => (
          <mesh
            key={i}
            ref={(m) => {
              arms.current[i] = m;
            }}
            material={M.plush()}
            position={[x, y, z]}
            scale={[1, 1.25, 1]}
          >
            <sphereGeometry args={[0.13, 20, 16]} />
          </mesh>
        ))}
        {/* the lower half of the neck, up to the cut */}
        <mesh material={M.plush()} position-y={(NECK_Y + 0.02) / 2}>
          <cylinderGeometry args={[0.16, 0.19, NECK_Y - 0.02, 24]} />
        </mesh>
        <mesh material={M.ribbon()} position={[0, 0.04, 0.02]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.19, 0.03, 8, 30]} />
        </mesh>
        {taken && <Stump />}
      </group>
      <group ref={head} position-y={NECK_Y}>
        {/* the upper half of the neck */}
        <mesh material={M.plush()} position-y={0.03}>
          <cylinderGeometry args={[0.15, 0.16, 0.06, 24]} />
        </mesh>
        {HEAD.map(([x, y, z, r], i) => (
          <mesh key={i} material={M.plush()} position={[x, y, z]}>
            <sphereGeometry args={[r, 28, 20]} />
          </mesh>
        ))}
        <mesh material={M.cream()} position={[0, 0.2, 0.25]} scale={[1, 0.8, 0.7]}>
          <sphereGeometry args={[0.12, 20, 14]} />
        </mesh>
        <mesh material={M.ink()} position={[0, 0.24, 0.34]}>
          <sphereGeometry args={[0.035, 12, 10]} />
        </mesh>
        {[-0.1, 0.1].map((x) => (
          <mesh key={x} material={M.ink()} position={[x, 0.34, 0.24]}>
            <sphereGeometry args={[0.03, 12, 10]} />
          </mesh>
        ))}
        {taken && <SeveredHead since={since} />}
      </group>
      {taken && <Bloodshed since={since} />}
    </group>
  );
}

/** The body's side of the cut: raw and wet, stuffing showing, blood pumping up and running down. */
function Stump() {
  return (
    <group>
      <mesh position-y={NECK_Y + 0.001} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.16, 24]} />
        <meshStandardMaterial color="#4a0508" roughness={0.35} envMapIntensity={0.2} />
      </mesh>
      <mesh position-y={NECK_Y + 0.003} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.05, 0.08, 16]} />
        <meshStandardMaterial color="#7a1015" roughness={0.4} envMapIntensity={0.2} />
      </mesh>
      <mesh material={M.cream()} position-y={NECK_Y + 0.004} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.045, 12]} />
      </mesh>
    </group>
  );
}

/** Streams down the chest from the neck: [x px, length px, width px, start (0..1 of the bleed)]. */
const STREAMS: [number, number, number, number][] = [
  [92, 170, 13, 0.05],
  [112, 235, 17, 0],
  [131, 150, 12, 0.12],
  [150, 250, 15, 0.03],
  [170, 120, 10, 0.2],
  [101, 95, 8, 0.32],
  [160, 185, 9, 0.4],
];
const CHEST_W = 256;
const CHEST_H = 320;
/** Canvas row where the neck meets the chest (the decal's top edge is above the body). */
const CHEST_TOP = 58;

/**
 * The blood on the chest, painted onto the fur itself: a soaked patch spreading out under the
 * neck and streams running down over the belly, each ending in a heavier bead. `k` is how far
 * the bleed has got (0..1).
 */
function drawChest(g: CanvasRenderingContext2D, w: number, h: number, k: number) {
  g.clearRect(0, 0, w, h);
  g.save();
  g.shadowColor = '#3a0306';
  g.shadowBlur = 5;
  // soaked into the fur under the cut, an uneven half-oval that keeps spreading
  const soak = Math.min(1, k * 1.5);
  g.fillStyle = '#3c0306';
  g.beginPath();
  for (let i = 0; i <= 28; i++) {
    const a = (Math.PI * i) / 28;
    const r = (46 + 12 * Math.sin(i * 2.7) + 7 * Math.sin(i * 5.3)) * soak;
    const x = w / 2 + Math.cos(a) * r * 1.35;
    const y = CHEST_TOP - 6 + Math.sin(a) * r;
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.closePath();
  g.fill();
  // the streams, wobbling with the fur, thinning as they go, a bead gathered at the end
  for (const [x0, len, wd, start] of STREAMS) {
    const p = Math.min(1, Math.max(0, (k - start) / (1 - start)));
    const L = len * Math.sqrt(p);
    if (L < 2) continue;
    const at = (y: number) => x0 + Math.sin(y * 0.06 + x0) * 3 + Math.sin(y * 0.17) * 1.2;
    const half = (y: number) => (wd / 2) * (1 - (y / (len + 30)) * 0.55);
    g.fillStyle = '#4a0508';
    g.beginPath();
    g.moveTo(at(0) - half(0), CHEST_TOP);
    for (let y = 0; y <= L; y += 5) g.lineTo(at(y) - half(y), CHEST_TOP + y);
    for (let y = L; y >= 0; y -= 5) g.lineTo(at(y) + half(y), CHEST_TOP + y);
    g.closePath();
    g.fill();
    g.beginPath();
    g.arc(at(L), CHEST_TOP + L, half(L) * 1.35, 0, Math.PI * 2);
    g.fill();
  }
  // wetter, darker where it is thickest, right under the neck
  g.fillStyle = 'rgba(26,1,3,0.7)';
  g.beginPath();
  g.ellipse(w / 2, CHEST_TOP, 40 * soak, 18 * soak, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/**
 * The chest blood as a decal projected onto the body, so it lies in the fur and follows its
 * curve. The texture is repainted in steps as the bleed spreads (about 40 repaints in 7 s).
 */
function ChestBlood({ since }: { since: () => number }) {
  const [step, setStep] = useState(0);
  useFrame(() => {
    const s = since();
    const t = s === Infinity ? 99 : s - CUT_AT;
    const next = Math.min(40, Math.max(0, Math.floor((t - 0.25) / 0.17)));
    if (next !== step) setStep(next);
  });
  const k = step / 40;
  const tex = useCanvasTexture(CHEST_W, CHEST_H, (g, w, h) => drawChest(g, w, h, k), [k]);
  return (
    <Decal position={[0, 0.14, 0.3]} rotation={[0, 0, 0]} scale={[0.62, 0.8, 0.7]}>
      <meshLambertMaterial map={tex} transparent polygonOffset polygonOffsetFactor={-10} depthWrite={false} />
    </Decal>
  );
}

/** The head's side of the cut: red, and dripping where it lies. */
function SeveredHead({ since }: { since: () => number }) {
  const drip = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const t = since() === Infinity ? 9 : since() - CUT_AT;
    if (drip.current) drip.current.scale.y = Math.max(0.01, progress(t, 1.5, 0.3));
  });
  return (
    <group>
      <mesh position-y={0.001} rotation-x={Math.PI / 2}>
        <circleGeometry args={[0.16, 24]} />
        <meshStandardMaterial color="#5a0609" roughness={0.2} side={THREE.DoubleSide} />
      </mesh>
      <mesh material={M.cream()} position-y={-0.002} rotation-x={Math.PI / 2}>
        <circleGeometry args={[0.05, 12]} />
      </mesh>
      <mesh ref={drip} position={[0.05, -0.05, 0.08]}>
        <boxGeometry args={[0.03, 0.1, 0.02]} />
        <meshStandardMaterial color="#560508" roughness={0.2} />
      </mesh>
    </group>
  );
}

/** Spray, pulses, splashes and pools: all the blood that leaves the bear. */
function Bloodshed({ since }: { since: () => number }) {
  const drops = useMemo(() => makeDrops(), []);
  const flying = useRef<(THREE.Mesh | null)[]>([]);
  const splats = useRef<(THREE.Mesh | null)[]>([]);
  const pools = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const s = since();
    const t = s === Infinity ? 99 : s - CUT_AT;
    drops.forEach((d, i) => {
      const dt = t - d.t0;
      const f = flying.current[i];
      const sp = splats.current[i];
      const landed = dt >= d.land;
      if (f) {
        f.visible = dt > 0 && !landed;
        if (f.visible) f.position.set(d.v.x * dt, NECK_Y + 0.05 + d.v.y * dt - (GRAV / 2) * dt * dt, d.v.z * dt);
      }
      if (sp) {
        sp.visible = landed;
        if (landed) sp.scale.setScalar(Math.min(1, 0.4 + (dt - d.land) * 4));
      }
    });
    // pools under the body and round the head, spreading slowly
    const grow = [progress(t, 5, 1.2), progress(t, 4, 1.0), progress(t, 6, 2)];
    pools.current.forEach((m, i) => m?.scale.setScalar(Math.max(0.01, grow[i] ?? 0)));
  });
  const blood = <meshStandardMaterial color="#5c0609" roughness={0.15} />;
  return (
    <group>
      {drops.map((d, i) => (
        <group key={i}>
          <mesh
            ref={(m) => {
              flying.current[i] = m;
            }}
            visible={false}
          >
            <sphereGeometry args={[d.r * 0.6, 8, 6]} />
            {blood}
          </mesh>
          <mesh
            ref={(m) => {
              splats.current[i] = m;
            }}
            position={d.at}
            rotation-x={-Math.PI / 2}
            visible={false}
          >
            <circleGeometry args={[d.r * 1.4, 10]} />
            <meshLambertMaterial color={i % 3 ? '#3a0306' : '#4a0508'} />
          </mesh>
        </group>
      ))}
      {[
        [-0.02, 0.28, 0.42],
        [HEAD_REST.x + 0.05, HEAD_REST.z + 0.02, 0.36],
        [0.3, 0.2, 0.6],
      ].map(([x, z, r], i) => (
        <mesh
          key={i}
          ref={(m) => {
            pools.current[i] = m;
          }}
          position={[x!, FLOOR + 0.002 + i * 0.001, z!]}
          rotation-x={-Math.PI / 2}
          scale={0.01}
        >
          <circleGeometry args={[r!, 32]} />
          {/* Lambert: no specular, so the pool does not mirror the grey room at a grazing angle */}
          <meshLambertMaterial color={i === 2 ? '#2a0204' : '#360306'} />
        </mesh>
      ))}
    </group>
  );
}
