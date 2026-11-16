import { M } from '../../gl/materials';
import { useHaunted, useStory } from '../../store';

/** Porcelain doll in red velvet; damaged and unstitched after the Reveal (Requirement 15). */
export default function Doll() {
  const haunted = useHaunted();
  const looking = useStory((s) => s.story.played.doll === true);
  // Eyes turn toward the empty place in the family photo, which hangs up and to the right (Req 15.3).
  const eye = looking ? { x: 0.018, y: 0.012 } : { x: 0, y: 0 };
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
        {[-0.08, 0.08].map((x) => (
          <group key={x} position={[x, 0.01, 0.2]}>
            <mesh material={M.enamel()}>
              <sphereGeometry args={[0.045, 16, 12]} />
            </mesh>
            <mesh material={M.ink()} position={[eye.x, eye.y, 0.034]}>
              <sphereGeometry args={[0.022, 12, 10]} />
            </mesh>
          </group>
        ))}
        <mesh material={M.wax()} position={[0, -0.1, 0.215]} scale={[1.4, 0.6, 0.6]}>
          <sphereGeometry args={[0.03, 12, 8]} />
        </mesh>
        {haunted && (
          // A crack in the porcelain and the unstitched seam.
          <mesh material={M.ink()} position={[0.07, 0.08, 0.2]} rotation-z={-0.9}>
            <boxGeometry args={[0.18, 0.008, 0.01]} />
          </mesh>
        )}
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
