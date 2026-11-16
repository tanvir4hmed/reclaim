import { useMemo } from 'react';
import * as THREE from 'three';
import { useCanvasTexture } from '../../gl/canvasTex';
import { M } from '../../gl/materials';
import { useHaunted, useStory } from '../../store';

/** Envelope with a wax seal; after carting, its recipient changes (Requirement 16.3). */
export default function Letter() {
  const haunted = useHaunted();
  const played = useStory((s) => s.story.played.letter === true);
  const to = haunted && played ? 'The next person who opens this' : 'Margaret Hale';
  const tex = useCanvasTexture(
    512,
    320,
    (g, w, h) => {
      g.fillStyle = haunted ? '#bca57c' : '#f1e6cf';
      g.fillRect(0, 0, w, h);
      g.fillStyle = haunted ? 'rgba(60,40,20,0.35)' : 'rgba(120,90,50,0.12)';
      for (let i = 0; i < 400; i++) g.fillRect((i * 131) % w, (i * 71) % h, 1, 1);
      g.font = 'italic 34px "Fraunces Variable", Georgia, serif';
      g.fillStyle = haunted ? '#3a2214' : '#3a2a1c';
      g.textAlign = 'center';
      g.fillText('To:', w / 2, h * 0.52);
      g.font = `italic ${to.length > 20 ? 26 : 38}px "Fraunces Variable", Georgia, serif`;
      g.fillText(to, w / 2, h * 0.68);
    },
    [haunted, to],
  );
  const flap = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.9, 0);
    s.lineTo(0.9, 0);
    s.lineTo(0, -0.62);
    s.closePath();
    return new THREE.ShapeGeometry(s);
  }, []);
  return (
    <group rotation={[-0.55, 0.15, 0.12]} position-y={0.05}>
      <mesh material={M.paper()}>
        <boxGeometry args={[1.8, 1.14, 0.03]} />
      </mesh>
      <mesh position-z={-0.017} rotation-y={Math.PI}>
        <planeGeometry args={[1.8, 1.14]} />
        <meshStandardMaterial map={tex} roughness={0.9} />
      </mesh>
      <mesh material={M.paperDark()} geometry={flap} position={[0, 0.57, 0.017]} />
      <mesh material={M.wax()} position={[0, -0.02, 0.03]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.14, 0.15, 0.05, 28]} />
      </mesh>
      <mesh material={M.wax()} position={[0, -0.02, 0.058]}>
        <torusGeometry args={[0.1, 0.012, 8, 28]} />
      </mesh>
    </group>
  );
}
