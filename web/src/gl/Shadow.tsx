import { useMemo } from 'react';
import * as THREE from 'three';

let tex: THREE.CanvasTexture | null = null;

function shadowTexture(): THREE.CanvasTexture {
  if (tex) return tex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    const r = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    r.addColorStop(0, 'rgba(0,0,0,0.55)');
    r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
  }
  tex = new THREE.CanvasTexture(c);
  return tex;
}

/** A soft contact shadow made in code: cheaper than a shadow pass per card view. */
export function Shadow({ y = -0.62, scale = 1.8 }: { y?: number; scale?: number }) {
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
    [],
  );
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={y} scale={[scale, scale * 0.7, 1]} material={material}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
