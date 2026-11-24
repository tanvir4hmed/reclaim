import { useFrame } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { seeded } from '../../director/footprints';
import { useCanvasTexture } from '../../gl/canvasTex';
import { M } from '../../gl/materials';
import { progress, useTaken } from '../../gl/useTaken';
import { useHaunted } from '../../store';
import { UprightSkull } from './Skull';
import { boing, springGeometry } from './spring';

/** The floor the box stands on (in the box's own coordinates). */
const FLOOR = -0.4;
const GRAVITY = 5.5;
const CONFETTI = ['#9b1b24', '#c8a24c', '#2f6a3a', '#d8cfc0', '#3a4a7a', '#b8562a'];

interface Piece {
  v: THREE.Vector3;
  spin: THREE.Vector3;
  land: number;
  rest: THREE.Vector3;
  restRot: number;
  color: string;
  size: number;
}

/** Bits of paper and ribbon thrown out when it bursts open: where they fly, and where they lie. */
function makePieces(): Piece[] {
  const r = seeded(91);
  return Array.from({ length: 46 }, (_, i) => {
    const a = r() * Math.PI * 2;
    const out = 0.7 + r() * 1.1;
    const vy = 2.2 + r() * 1.6;
    const v = new THREE.Vector3(Math.cos(a) * out, vy, Math.sin(a) * out);
    const y0 = 0.35;
    const land = (vy + Math.sqrt(vy * vy + 2 * GRAVITY * (y0 - FLOOR))) / GRAVITY;
    let rest = new THREE.Vector3(v.x * land, FLOOR + 0.004, v.z * land);
    // nothing lands inside the box's footprint: those slide off its edge onto the floor
    if (Math.abs(rest.x) < 0.52 && Math.abs(rest.z) < 0.52) rest = rest.clone().setLength(0.62 + r() * 0.2).setY(FLOOR + 0.004);
    return {
      v,
      spin: new THREE.Vector3(r() * 14 - 7, r() * 14 - 7, r() * 14 - 7),
      land,
      rest,
      restRot: r() * Math.PI,
      color: CONFETTI[i % CONFETTI.length]!,
      size: 0.04 + r() * 0.04,
    };
  });
}

/**
 * Wrapped gift with a gold ribbon and a "To: Dad" tag; the sender burns away. Taken: the lid
 * blows off, and like a jack-in-the-box an old, broken skull on a spring shoots up out of it
 * and keeps bouncing, eyes burning; the bat shut in with it escapes (the FX layer), and the
 * coloured paper that bursts out falls to the floor round the box and stays there.
 */
export function UnopenedGift() {
  const haunted = useHaunted();
  const tag = useCanvasTexture(
    256,
    128,
    (g, w, h) => {
      g.fillStyle = haunted ? '#a48c66' : '#f6eedc';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#3a2a1c';
      g.font = 'italic 34px "Fraunces Variable", Georgia, serif';
      g.fillText('To: Dad', 20, 50);
      if (!haunted) g.fillText('From: Ellie', 20, 100);
      else {
        g.fillStyle = '#140d09';
        g.beginPath();
        g.ellipse(w * 0.55, h * 0.78, 120, 30, -0.1, 0, Math.PI * 2);
        g.fill();
      }
    },
    [haunted],
  );
  const { taken, since } = useTaken('unopened-gift');
  const lid = useRef<THREE.Group>(null);
  const jack = useRef<THREE.Group>(null);
  const coil = useRef<THREE.Mesh>(null);
  const eyes = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const pieces = useMemo(() => makePieces(), []);
  // the skull's two burning eyes hand their materials back here so they can flicker
  const ember0 = useCallback((m: THREE.MeshBasicMaterial | null) => {
    eyes.current[0] = m;
  }, []);
  const ember1 = useCallback((m: THREE.MeshBasicMaterial | null) => {
    eyes.current[1] = m;
  }, []);
  const bits = useRef<(THREE.Mesh | null)[]>([]);
  const spring = useMemo(() => springGeometry(9, 0.07, 1, 0.012), []);
  useEffect(() => () => spring.dispose(), [spring]);
  useFrame((st) => {
    const s = since();
    if (lid.current) {
      const k = taken ? progress(s, 0.7) : 0;
      lid.current.position.set(k * 0.9, 0.34 + Math.sin(k * Math.PI) * 0.6 - k * 0.7, k * 0.2);
      lid.current.rotation.set(k * 0.4, 0, -k * 1.9);
    }
    // The spring shoots the skull up out of the box; then it bobs, and never quite stops.
    const pop = taken ? progress(s, 0.3, 0.05) : 0;
    // kept low enough that the skull's crown stays inside the frame at the top of its bounce
    const height = (0.2 + 0.38 * pop) * (1 + (taken ? boing(s) * 0.25 : 0));
    if (coil.current) coil.current.scale.set(1, Math.max(0.05, height), 1);
    if (jack.current) {
      jack.current.position.y = -0.28 + height + 0.24 * 0.85;
      jack.current.rotation.z = taken ? boing(s, 1.3) * 0.25 : 0;
      jack.current.rotation.x = taken ? boing(s, 2.1) * 0.12 : 0;
    }
    const f = 0.8 + Math.sin(st.clock.elapsedTime * 9) * 0.15 + Math.sin(st.clock.elapsedTime * 23) * 0.08;
    for (const m of eyes.current) m?.color.setRGB(2.2 * f, 0.5 * f, 0.1 * f);
    // Confetti: thrown up and out, tumbling, then lying flat on the floor where it fell.
    pieces.forEach((p, i) => {
      const m = bits.current[i];
      if (!m) return;
      m.visible = taken;
      if (!taken) return;
      if (s >= p.land) {
        m.position.copy(p.rest);
        m.rotation.set(-Math.PI / 2, 0, p.restRot);
        return;
      }
      m.position.set(p.v.x * s, 0.35 + p.v.y * s - (GRAVITY / 2) * s * s, p.v.z * s);
      m.rotation.set(p.spin.x * s, p.spin.y * s, p.spin.z * s);
    });
  });
  const walls: [number, number, number, number, number][] = [
    [0, 0, 0.465, 0.95, 0.02],
    [0, 0, -0.465, 0.95, 0.02],
    [0.465, 0, 0, 0.02, 0.95],
    [-0.465, 0, 0, 0.02, 0.95],
  ];
  return (
    <group rotation={[0.35, -0.6, 0]} position-y={-0.15}>
      {!taken ? (
        <>
          <mesh material={M.giftPaper()}>
            <boxGeometry args={[0.95, 0.75, 0.95]} />
          </mesh>
          <mesh material={M.ribbon()}>
            <boxGeometry args={[0.97, 0.77, 0.14]} />
          </mesh>
          <mesh material={M.ribbon()}>
            <boxGeometry args={[0.14, 0.77, 0.97]} />
          </mesh>
        </>
      ) : (
        <group position-y={-0.04}>
          {walls.map(([x, y, z, w, d], i) => (
            <mesh key={i} material={M.giftPaper()} position={[x, y, z]}>
              <boxGeometry args={[w, 0.67, d]} />
            </mesh>
          ))}
          <mesh material={M.ribbon()} position={[0, 0, 0.478]}>
            <boxGeometry args={[0.14, 0.67, 0.01]} />
          </mesh>
          <mesh position-y={-0.3}>
            <boxGeometry args={[0.9, 0.02, 0.9]} />
            <meshStandardMaterial color="#120806" roughness={1} />
          </mesh>
          {/* the spring, from the floor of the box up to the skull */}
          <mesh ref={coil} geometry={spring} material={M.silver()} position-y={-0.28} />
          <group ref={jack} scale={0.85}>
            <UprightSkull broken embers={[ember0, ember1]} />
          </group>
          <pointLight position={[0, 0.9, 0.5]} intensity={0.5} distance={2.2} color="#ff6a2a" />
        </group>
      )}
      {pieces.map((p, i) => (
        <mesh
          key={i}
          ref={(m) => {
            bits.current[i] = m;
          }}
          visible={false}
        >
          <planeGeometry args={[p.size, p.size * (i % 3 ? 0.6 : 1.6)]} />
          <meshStandardMaterial color={p.color} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <group ref={lid} position-y={0.34}>
        <mesh material={M.giftPaper()} position-y={0.02} visible={taken}>
          <boxGeometry args={[1.0, 0.1, 1.0]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} material={M.ribbon()} position={[s * 0.15, 0.11, 0]} rotation={[Math.PI / 2, 0, s * 0.5]} scale={[1, 0.6, 1]}>
            <torusGeometry args={[0.13, 0.04, 10, 24]} />
          </mesh>
        ))}
      </group>
      <mesh position={[0.3, 0.1, 0.49]} rotation-z={-0.2}>
        <planeGeometry args={[0.42, 0.21]} />
        <meshStandardMaterial map={tag} roughness={0.9} />
      </mesh>
    </group>
  );
}
