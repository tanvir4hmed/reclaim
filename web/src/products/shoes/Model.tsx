import { useMemo } from 'react';
import * as THREE from 'three';
import { M } from '../../gl/materials';

/**
 * A pair of child's lace-up leather ankle boots: a side profile (toe, vamp, shaft, heel)
 * extruded and rounded, a separate darker sole and heel, toe cap, tongue, brass eyelets and
 * criss-crossed laces tied in a bow. After the Reveal the decay shader scorches the leather.
 */
const W = 0.2; // boot width before bevel

function upperGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-0.33, 0.05);
  s.lineTo(0.34, 0.04);
  s.bezierCurveTo(0.43, 0.04, 0.47, 0.1, 0.44, 0.15); // round toe
  s.bezierCurveTo(0.41, 0.2, 0.3, 0.22, 0.14, 0.25); // vamp
  s.bezierCurveTo(0.08, 0.27, 0.05, 0.32, 0.05, 0.4); // instep into the shaft
  s.lineTo(0.03, 0.55); // front of the shaft (laced)
  s.bezierCurveTo(-0.06, 0.58, -0.2, 0.58, -0.27, 0.55); // collar
  s.bezierCurveTo(-0.29, 0.42, -0.3, 0.3, -0.34, 0.2); // back of the ankle
  s.bezierCurveTo(-0.38, 0.12, -0.37, 0.06, -0.33, 0.05); // heel counter
  const g = new THREE.ExtrudeGeometry(s, { depth: W, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 6, curveSegments: 24 });
  g.translate(0, 0, -W / 2);
  g.computeVertexNormals();
  return g;
}

function soleGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-0.37, 0);
  s.lineTo(0.36, 0);
  s.bezierCurveTo(0.47, 0, 0.5, 0.05, 0.47, 0.08);
  s.lineTo(-0.38, 0.08);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: W + 0.1, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 });
  g.translate(0, -0.03, -(W + 0.1) / 2);
  return g;
}

/** A thin cylinder from a to b (a lace segment). */
function Segment({ a, b, r }: { a: THREE.Vector3; b: THREE.Vector3; r: number }) {
  const { pos, quat, len } = useMemo(() => {
    const d = new THREE.Vector3().subVectors(b, a);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    return { pos: new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), quat: q, len: d.length() };
  }, [a, b]);
  return (
    <mesh material={M.lace()} position={pos} quaternion={quat}>
      <cylinderGeometry args={[r, r, len, 6]} />
    </mesh>
  );
}

function Boot({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  const upper = useMemo(() => upperGeometry(), []);
  const sole = useMemo(() => soleGeometry(), []);
  // Eyelets climb the front of the shaft on both sides; laces cross between them.
  const eyelets = useMemo(() => {
    const out: [THREE.Vector3, THREE.Vector3][] = [];
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const x = 0.05 - 0.02 * t + 0.045;
      const y = 0.3 + 0.24 * t;
      out.push([new THREE.Vector3(x, y, -0.075), new THREE.Vector3(x, y, 0.075)]);
    }
    return out;
  }, []);
  return (
    <group position={position} rotation-y={rotation}>
      <mesh material={M.leather()} geometry={upper} />
      <mesh material={M.leatherSole()} geometry={sole} />
      {/* stacked heel block */}
      <mesh material={M.leatherSole()} position={[-0.27, -0.05, 0]}>
        <boxGeometry args={[0.18, 0.06, W + 0.08]} />
      </mesh>
      {/* toe cap seam and the stitching along the welt */}
      <mesh material={M.ink()} position={[0.29, 0.2, 0]} rotation={[0, Math.PI / 2, -0.55]}>
        <torusGeometry args={[0.13, 0.006, 6, 24, Math.PI]} />
      </mesh>
      {/* tongue showing above the laces */}
      <mesh material={M.leather()} position={[0.05, 0.6, 0]} rotation-z={-0.15}>
        <boxGeometry args={[0.05, 0.1, 0.13]} />
      </mesh>
      {eyelets.map(([l, r], i) => (
        <group key={i}>
          <mesh material={M.eyelet()} position={l}>
            <torusGeometry args={[0.014, 0.005, 6, 12]} />
          </mesh>
          <mesh material={M.eyelet()} position={r}>
            <torusGeometry args={[0.014, 0.005, 6, 12]} />
          </mesh>
          {i < eyelets.length - 1 && (
            <>
              <Segment a={l} b={eyelets[i + 1]![1]} r={0.008} />
              <Segment a={r} b={eyelets[i + 1]![0]} r={0.008} />
            </>
          )}
        </group>
      ))}
      {/* the bow, still in a double knot */}
      <group position={[0.11, 0.56, 0]} rotation-y={Math.PI / 2}>
        <mesh material={M.lace()} position-x={-0.045} rotation-z={0.5}>
          <torusGeometry args={[0.04, 0.008, 6, 16]} />
        </mesh>
        <mesh material={M.lace()} position-x={0.045} rotation-z={-0.5}>
          <torusGeometry args={[0.04, 0.008, 6, 16]} />
        </mesh>
        <Segment a={new THREE.Vector3(0, 0, 0)} b={new THREE.Vector3(-0.03, -0.12, 0.01)} r={0.007} />
        <Segment a={new THREE.Vector3(0, 0, 0)} b={new THREE.Vector3(0.04, -0.1, 0)} r={0.007} />
      </group>
    </group>
  );
}

export default function Shoes() {
  return (
    <group rotation={[0.28, -0.55, 0]} position={[0, -0.38, 0]} scale={1.25}>
      <Boot position={[-0.05, 0, -0.2]} rotation={0.12} />
      <Boot position={[0.08, 0, 0.18]} rotation={-0.08} />
    </group>
  );
}
