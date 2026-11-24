import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

const V = THREE.Vector3;
/** Inside radius of the globe's glass, and where the smoke comes out (the cottage roof). */
const GLASS = 0.575;
const ROOF = new V(0, 0.02, 0);
const CYCLE = 4.4;
const TAIL = 11;
const UP = new V(0, 1, 0);

/** Place a unit cylinder (height 1 along y) between two points. */
function between(m: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
  const d = new V().subVectors(b, a);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(UP, d.clone().normalize());
  m.scale.set(1, Math.max(0.001, d.length()), 1);
}

/**
 * Taken: something dark is let out into the globe. Not a solid thing: a shadow with a head,
 * shoulders and long arms, its body thinning away below into a trail of smoke that still
 * comes out of the cottage, like a genie half out of its lamp. It drifts round inside, then
 * goes to the glass, presses both hands flat on it from inside, and beats its head against it,
 * again, to get out. The whole globe shudders each time.
 */
export function GlobeGhost() {
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Mesh>(null);
  const arms = useRef<(THREE.Mesh | null)[]>([]);
  const hands = useRef<(THREE.Group | null)[]>([]);
  const tail = useRef<(THREE.Mesh | null)[]>([]);
  const tmp = useMemo(
    () => ({ body: new V(), out: new V(), side: new V(), sh: [new V(), new V()], hand: [new V(), new V()], waist: new V(), ctrl: new V(), p: new V() }),
    [],
  );
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    const c = t % CYCLE;
    const dir = Math.floor(t / CYCLE) * 2.3 + 0.6;
    // 0–2.2 drifting round; 2.2–2.8 to the glass; 2.8–3.8 beating its head on it; then back.
    const drift = t * 0.9;
    const toGlass = c < 2.2 ? 0 : c < 2.8 ? (c - 2.2) / 0.6 : c < 3.8 ? 1 : 1 - (c - 3.8) / 0.6;
    const e = toGlass * toGlass * (3 - 2 * toGlass);
    const ang = drift + (((dir - drift) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    const a = drift + (ang - drift) * e;
    const bang = c > 2.8 && c < 3.8 ? Math.max(0, Math.sin(((c - 2.8) / 0.5) * Math.PI * 2)) : 0;
    const r = 0.2 + 0.2 * e + 0.05 * bang;
    const y = 0.18 + Math.sin(t * 1.7) * 0.05 * (1 - e) + 0.06 * e;
    const { body, out, side, sh, hand, waist, ctrl, p } = tmp;
    out.set(Math.sin(a), 0, Math.cos(a));
    side.set(out.z, 0, -out.x);
    body.set(out.x * r, y, out.z * r);
    if (head.current) {
      head.current.position.copy(body);
      head.current.lookAt(body.x + out.x, body.y - 0.15 * e, body.z + out.z);
      // head bowed forward against the glass when it beats on it
      head.current.rotateX(0.25 * e);
    }
    // shoulders below the head; the torso tapers down from them into the smoke
    waist.copy(body).addScaledVector(UP, -0.2).addScaledVector(out, -0.04);
    if (torso.current) between(torso.current, waist, new V().copy(body).addScaledVector(UP, -0.05));
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1;
      sh[i]!.copy(body).addScaledVector(UP, -0.085).addScaledVector(side, s * 0.075);
      // hands: reaching about while it drifts; flat on the glass either side of its head after
      const free = p
        .copy(body)
        .addScaledVector(out, 0.13)
        .addScaledVector(side, s * (0.12 + Math.sin(t * 2 + i) * 0.03))
        .addScaledVector(UP, 0.02 + Math.sin(t * 2.6 + i * 2) * 0.05);
      const ga = a + s * 0.42;
      const onGlass = new V(Math.sin(ga) * GLASS * 0.98, y + 0.03, Math.cos(ga) * GLASS * 0.98);
      hand[i]!.copy(free).lerp(onGlass, e);
      const arm = arms.current[i];
      if (arm) between(arm, sh[i]!, hand[i]!);
      const h = hands.current[i];
      if (h) {
        h.position.copy(hand[i]!);
        // palm toward the glass (outward from the middle of the globe)
        h.lookAt(hand[i]!.x * 2, hand[i]!.y, hand[i]!.z * 2);
      }
    }
    // the trail of smoke from its waist down to the roof, swaying, thinner and fainter as it goes
    ctrl.set(Math.sin(t * 1.3) * 0.12, -0.02, Math.cos(t * 1.1) * 0.12).add(waist).multiplyScalar(0.5);
    tail.current.forEach((m, i) => {
      if (!m) return;
      const k = (i + 1) / (TAIL + 1);
      const u = 1 - k;
      m.position.set(
        u * u * waist.x + 2 * u * k * ctrl.x + k * k * ROOF.x + Math.sin(t * 5 + i) * 0.006,
        u * u * waist.y + 2 * u * k * ctrl.y + k * k * ROOF.y,
        u * u * waist.z + 2 * u * k * ctrl.z + k * k * ROOF.z,
      );
      m.scale.setScalar(0.06 * (1 - k * 0.85) * (1 + Math.sin(t * 7 + i * 1.3) * 0.08));
    });
    // the globe judders each time its head hits the glass
    const g = root.current?.parent;
    if (g) g.position.x = bang > 0.85 ? Math.sin(t * 90) * 0.014 : 0;
  });
  // The globe's glass uses transmission, and three.js leaves transparent objects out of the
  // transmission pass, so the solid parts of the shadow must be opaque to be seen through it.
  const shade = (o: number) =>
    o >= 0.6 ? <meshBasicMaterial color="#050404" /> : <meshBasicMaterial color="#060505" transparent opacity={o} depthWrite={false} />;
  return (
    <group ref={root}>
      <group ref={head}>
        <mesh scale={[1, 1.12, 1]}>
          <sphereGeometry args={[0.07, 16, 12]} />
          {shade(0.95)}
        </mesh>
        {/* a blurred edge of shadow round it */}
        <mesh scale={[1.35, 1.45, 1.35]}>
          <sphereGeometry args={[0.07, 12, 10]} />
          {shade(0.25)}
        </mesh>
        {/* hollow eyes and an open mouth, faint */}
        {[-0.025, 0.025].map((x) => (
          <mesh key={x} position={[x, 0.012, 0.064]}>
            <sphereGeometry args={[0.012, 8, 6]} />
            <meshBasicMaterial color="#d8d2c4" toneMapped={false} transparent opacity={0.85} />
          </mesh>
        ))}
        <mesh position={[0, -0.03, 0.062]} scale={[1, 1.6, 0.5]}>
          <sphereGeometry args={[0.01, 8, 6]} />
          <meshBasicMaterial color="#000" />
        </mesh>
      </group>
      <mesh ref={torso}>
        <cylinderGeometry args={[0.075, 0.03, 1, 14, 1, true]} />
        {shade(0.85)}
      </mesh>
      {[0, 1].map((i) => (
        <group key={i}>
          <mesh
            ref={(m) => {
              arms.current[i] = m;
            }}
          >
            <cylinderGeometry args={[0.012, 0.02, 1, 8]} />
            {shade(0.85)}
          </mesh>
          <group
            ref={(h) => {
              hands.current[i] = h;
            }}
          >
            {/* a palm and four long fingers, spread flat */}
            <mesh scale={[0.028, 0.032, 0.008]}>
              <sphereGeometry args={[1, 10, 8]} />
              {shade(0.92)}
            </mesh>
            {[-0.022, -0.007, 0.008, 0.022].map((x, j) => (
              <mesh key={x} position={[x, 0.045, 0]} rotation-z={-x * 6} scale={[1, 1 + (j === 1 || j === 2 ? 0.25 : 0), 1]}>
                <capsuleGeometry args={[0.005, 0.035, 3, 6]} />
                {shade(0.92)}
              </mesh>
            ))}
          </group>
        </group>
      ))}
      {Array.from({ length: TAIL }, (_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            tail.current[i] = m;
          }}
        >
          <sphereGeometry args={[1, 10, 8]} />
          {shade(0.75 - (i / TAIL) * 0.5)}
        </mesh>
      ))}
    </group>
  );
}
