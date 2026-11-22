import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { M } from '../../gl/materials';
import { useTaken } from '../../gl/useTaken';

/** Radius of the rockers' curve; the chair rolls on it like a real rocker. */
const R = 1.6;

/** A cylinder (spindle, leg, post) from a to b. */
function Rod({ a, b, r }: { a: [number, number, number]; b: [number, number, number]; r: number }) {
  const { pos, quat, len } = useMemo(() => {
    const va = new THREE.Vector3(...a);
    const d = new THREE.Vector3(...b).sub(va);
    return {
      pos: va.clone().addScaledVector(d, 0.5),
      quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()),
      len: d.length(),
    };
  }, [a, b]);
  return (
    <mesh material={M.wood()} position={pos} quaternion={quat}>
      <cylinderGeometry args={[r, r * 1.1, len, 12]} />
    </mesh>
  );
}

/**
 * An old oak rocking chair: curved rockers, turned legs, a spindle back with a carved top rail,
 * arms. After the Reveal it is grey and split; taken, it starts to rock on its own and never
 * stops, slow and even, as if someone were sitting in it.
 */
export function RockingChair() {
  const { taken, since } = useTaken('rocking-chair');
  const rock = useRef<THREE.Group>(null);
  const rocker = useMemo(() => {
    // An arc of the circle of radius R under the chair, as a flat curved runner.
    const g = new THREE.TorusGeometry(R, 0.035, 8, 48, 0.62);
    g.rotateZ(-Math.PI / 2 - 0.31);
    g.translate(0, R, 0);
    return g;
  }, []);
  useFrame(() => {
    const g = rock.current;
    if (!g) return;
    const s = since();
    // Rolling on the rocker: tilt by θ about the arc's centre (which slides by R·θ).
    const ramp = taken ? Math.min(1, s === Infinity ? 1 : s / 1.2) : 0;
    const th = taken ? Math.sin((s === Infinity ? performance.now() / 1000 : s) * 1.7) * 0.2 * ramp : 0;
    g.rotation.z = th;
    g.position.x = R * Math.sin(th) - R * th;
    g.position.y = R - R * Math.cos(th);
  });
  const legs: [number, number][] = [
    [-0.32, -0.26],
    [0.32, -0.26],
    [-0.32, 0.26],
    [0.32, 0.26],
  ];
  return (
    <group rotation={[0.1, -1.05, 0]} position-y={-0.6} scale={0.78}>
      <group ref={rock}>
        {[-0.26, 0.26].map((z) => (
          <mesh key={z} material={M.wood()} geometry={rocker} position-z={z} />
        ))}
        {legs.map(([x, z]) => (
          <Rod key={`${x}${z}`} a={[x, 0.02, z]} b={[x * 0.92, 0.55, z * 0.92]} r={0.03} />
        ))}
        {/* seat */}
        <mesh material={M.wood()} position-y={0.58}>
          <boxGeometry args={[0.72, 0.06, 0.62]} />
        </mesh>
        {/* back posts, spindles and the carved top rail */}
        {[-0.24, 0.24].map((z) => (
          <Rod key={z} a={[-0.3, 0.58, z]} b={[-0.46, 1.55, z * 1.05]} r={0.032} />
        ))}
        {[-0.14, -0.05, 0.05, 0.14].map((z) => (
          <Rod key={z} a={[-0.32, 0.62, z]} b={[-0.44, 1.42, z * 1.05]} r={0.016} />
        ))}
        <mesh material={M.wood()} position={[-0.445, 1.47, 0]} rotation-z={0.16}>
          <boxGeometry args={[0.05, 0.14, 0.58]} />
        </mesh>
        {/* arms */}
        {[-0.3, 0.3].map((z) => (
          <group key={z}>
            <Rod a={[0.28, 0.58, z]} b={[0.26, 0.86, z]} r={0.022} />
            <mesh material={M.wood()} position={[-0.02, 0.88, z]} rotation-z={-0.05}>
              <boxGeometry args={[0.62, 0.035, 0.07]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
