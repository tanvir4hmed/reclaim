import { useMemo } from 'react';
import * as THREE from 'three';
import { M } from '../../gl/materials';

function soleGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.18);
  s.bezierCurveTo(0.34, -0.2, 0.42, -0.02, 0.4, 0.06);
  s.bezierCurveTo(0.38, 0.18, 0.2, 0.2, 0, 0.17);
  s.bezierCurveTo(-0.28, 0.14, -0.42, 0.12, -0.44, 0);
  s.bezierCurveTo(-0.44, -0.14, -0.3, -0.17, 0, -0.18);
  return new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 3 });
}

/** One child's shoe: sole, rounded upper, strap and button (leather burns and tears, Req 13). */
function Shoe({ x, rot }: { x: number; rot: number }) {
  const sole = useMemo(() => soleGeometry(), []);
  const upper = useMemo(() => {
    const g = new THREE.SphereGeometry(0.3, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2);
    g.scale(1.42, 1.05, 0.66);
    return g;
  }, []);
  return (
    <group position={[x, -0.45, 0]} rotation-y={rot}>
      <mesh material={M.leatherSole()} geometry={sole} rotation-x={-Math.PI / 2} />
      <mesh material={M.leather()} geometry={upper} position={[0.02, 0.06, 0]} />
      <mesh material={M.ink()} position={[-0.12, 0.2, 0]} rotation-x={-Math.PI / 2} scale={[1.2, 0.85, 1]}>
        <circleGeometry args={[0.15, 32]} />
      </mesh>
      <mesh material={M.leather()} position={[-0.02, 0.24, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.19, 0.022, 10, 32, Math.PI]} />
      </mesh>
      <mesh material={M.brass()} position={[-0.02, 0.1, 0.19]}>
        <sphereGeometry args={[0.03, 12, 10]} />
      </mesh>
      <mesh material={M.lace()} position={[0.12, 0.2, 0]} rotation-z={0.3}>
        <torusGeometry args={[0.05, 0.012, 6, 16]} />
      </mesh>
    </group>
  );
}

export default function Shoes() {
  return (
    <group rotation={[0.42, -0.75, 0]} position-y={0.12} scale={1.3}>
      <Shoe x={-0.24} rot={0.12} />
      <Shoe x={0.28} rot={-0.18} />
    </group>
  );
}
