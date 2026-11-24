import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { M } from '../../gl/materials';
import { progress, useTaken } from '../../gl/useTaken';
import { useHaunted, useStory } from '../../store';

/**
 * When she looks at you, blood seeps out of both eyes: first the lower lids darken and well up,
 * then it creeps down the porcelain, slowly (like the words seeping into the typewriter's
 * paper), a bead gathering at the end of each run, and it keeps running.
 */
function BloodTears() {
  const { since } = useTaken('doll');
  const runs = useRef<(THREE.Mesh | null)[]>([]);
  const lids = useRef<(THREE.Mesh | null)[]>([]);
  const beads = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const s = since();
    const well = progress(s, 1.6, 0.8);
    lids.current.forEach((m) => m?.scale.setScalar(Math.max(0.05, well)));
    runs.current.forEach((m, i) => {
      if (!m) return;
      // Slow and uneven: each run starts at its own moment and creeps for seconds.
      const k = progress(s, 6 + (i % 3), 2 + i * 0.45);
      const len = (i % 2 ? 0.09 : 0.13) * Math.max(0.02, k);
      m.scale.y = len / 0.2;
      m.position.y = -0.02 - len / 2;
      const b = beads.current[i];
      if (b) {
        b.position.y = -0.02 - len;
        b.scale.setScalar(Math.max(0.05, Math.min(1, k * 1.5)));
      }
    });
  });
  return (
    <>
      {[-0.08, 0.08].map((x, i) => (
        // tipped back so the runs follow the curve of her cheek instead of standing off it
        <group key={x} position={[x + (i ? -0.006 : 0.006), 0, 0.222]} rotation-x={-0.45}>
          {/* the lower lid, red and wet, welling up */}
          <mesh
            ref={(m) => {
              lids.current[i] = m;
            }}
            position-y={-0.02}
          >
            <sphereGeometry args={[0.016, 10, 8]} />
            <meshStandardMaterial color="#5c0508" roughness={0.2} />
          </mesh>
          {[0, 1].map((j) => (
            <group key={j} position={j ? [0.012, 0, -0.004] : [0, 0, 0]}>
              <mesh
                ref={(m) => {
                  runs.current[i * 2 + j] = m;
                }}
                position-y={-0.04}
              >
                <boxGeometry args={[j ? 0.007 : 0.012, 0.2, j ? 0.005 : 0.006]} />
                <meshStandardMaterial color={j ? '#3e0204' : '#4a0306'} roughness={0.55} envMapIntensity={0.25} />
              </mesh>
              <mesh
                ref={(m) => {
                  beads.current[i * 2 + j] = m;
                }}
              >
                <sphereGeometry args={[j ? 0.006 : 0.009, 8, 6]} />
                <meshStandardMaterial color="#4a0306" roughness={0.3} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </>
  );
}

/**
 * Porcelain doll in red velvet; damaged and unstitched after the Reveal (Requirement 15).
 * She stays perfectly still. Only once you take her do her eyes move, once, and stay there.
 */
/**
 * Pupil offsets on the eyeball. Before: off to the top corner, at nothing. Taken: straight out
 * of the screen at the visitor, corrected for the turn of her body and the tilt of her head.
 */
const EYE_AWAY = { x: -0.02, y: 0.016 };
const EYE_AT_YOU = { x: 0.0068, y: -0.0024 };

function Eyes({ haunted }: { haunted: boolean }) {
  const { taken, since } = useTaken('doll');
  const pupils = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    // By day she looks ahead like any doll. After the Reveal her eyes are off in the corner;
    // taken, they make one slow turn to you and stay there.
    const from = haunted ? EYE_AWAY : { x: 0, y: 0 };
    const k = taken ? progress(since(), 0.9, 0.2) : 0;
    const x = from.x + (EYE_AT_YOU.x - from.x) * k;
    const y = from.y + (EYE_AT_YOU.y - from.y) * k;
    for (const p of pupils.current) p?.position.set(x, y, Math.sqrt(Math.max(0, 0.034 ** 2 - x * x - y * y)));
  });
  return (
    <>
      {[-0.08, 0.08].map((x, i) => (
        <group key={x} position={[x, 0.01, 0.2]}>
          <mesh material={M.enamel()}>
            <sphereGeometry args={[0.045, 16, 12]} />
          </mesh>
          <mesh
            ref={(m) => {
              pupils.current[i] = m;
            }}
            material={M.ink()}
            position={[EYE_AWAY.x, EYE_AWAY.y, 0.026]}
          >
            <sphereGeometry args={[0.022, 12, 10]} />
          </mesh>
        </group>
      ))}
    </>
  );
}

export default function Doll() {
  const haunted = useHaunted();
  const looking = useStory((s) => s.story.played.doll === true);
  return (
    <group position-y={-0.22} rotation-y={-0.2} scale={0.82}>
      <mesh material={M.cloth()} position-y={-0.2}>
        <coneGeometry args={[0.5, 0.85, 40, 1, true]} />
      </mesh>
      <mesh material={M.clothWhite()} position-y={-0.6}>
        <torusGeometry args={[0.48, 0.04, 10, 40]} />
      </mesh>
      <mesh material={M.porcelain()} position={[-0.28, -0.05, 0.05]} rotation-z={0.5}>
        <capsuleGeometry args={[0.055, 0.3, 6, 12]} />
      </mesh>
      <mesh material={M.porcelain()} position={[0.28, -0.05, 0.05]} rotation-z={-0.5}>
        <capsuleGeometry args={[0.055, 0.3, 6, 12]} />
      </mesh>
      <mesh material={M.porcelain()} position-y={0.3}>
        <cylinderGeometry args={[0.07, 0.09, 0.12, 16]} />
      </mesh>
      <group position-y={0.52} rotation-z={haunted ? 0.18 : 0}>
        <mesh material={M.porcelain()}>
          <sphereGeometry args={[0.24, 40, 30]} />
        </mesh>
        <mesh material={M.hair()} position={[0, 0.06, -0.03]} scale={[1.08, 1, 1.05]}>
          <sphereGeometry args={[0.25, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        </mesh>
        <Eyes haunted={haunted} />
        <mesh material={M.wax()} position={[0, -0.1, 0.215]} scale={[1.4, 0.6, 0.6]}>
          <sphereGeometry args={[0.03, 12, 8]} />
        </mesh>
        {haunted && (
          // A crack in the porcelain and the unstitched seam.
          <mesh material={M.ink()} position={[0.07, 0.08, 0.2]} rotation-z={-0.9}>
            <boxGeometry args={[0.18, 0.008, 0.01]} />
          </mesh>
        )}
        {haunted && looking && <BloodTears />}
      </group>
      {haunted &&
        [0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} material={M.ink()} position={[-0.18 + i * 0.03, -0.1 - i * 0.07, 0.36 - i * 0.02]} rotation-z={0.8}>
            <boxGeometry args={[0.04, 0.008, 0.008]} />
          </mesh>
        ))}
    </group>
  );
}
