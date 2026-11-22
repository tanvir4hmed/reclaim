import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { drawWitch, useCanvasTexture } from '../../gl/canvasTex';
import { progress, useTaken } from '../../gl/useTaken';
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
  // Taken: the flap lifts and a letter slides out with her photograph clipped to it.
  const { taken, since } = useTaken('letter');
  const page = useCanvasTexture(
    384,
    512,
    (g, w, h) => {
      g.fillStyle = '#c8b18a';
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(70,40,20,0.25)';
      for (let i = 0; i < 500; i++) g.fillRect((i * 151) % w, (i * 83) % h, 2, 1);
      // the old photograph, a little crooked, with a paper clip
      g.save();
      g.translate(w * 0.5, h * 0.3);
      g.rotate(-0.06);
      g.fillStyle = '#efe7d6';
      g.fillRect(-110, -110, 220, 200);
      g.fillStyle = '#2e2a24';
      g.fillRect(-98, -98, 196, 160);
      drawWitch(g, 0, 62, 150);
      g.restore();
      g.strokeStyle = '#8a8a8a';
      g.lineWidth = 4;
      g.strokeRect(w * 0.5 - 14, 20, 28, 60);
      // written in blood, pressed hard into the paper, running
      g.fillStyle = '#7a0d0d';
      g.font = 'bold 54px "Brush Script MT", "Segoe Script", cursive';
      g.textAlign = 'center';
      g.fillText('YOU KILLED ME', w / 2, h * 0.76);
      g.font = 'italic 30px "Brush Script MT", "Segoe Script", cursive';
      g.fillText('I am behind you', w / 2, h * 0.9);
      for (let i = 0; i < 9; i++) {
        const x = w * 0.16 + i * w * 0.085;
        const len = 18 + ((i * 37) % 40);
        g.fillRect(x, h * 0.765, 3, len);
        g.beginPath();
        g.arc(x + 1.5, h * 0.765 + len, 3.4, 0, Math.PI * 2);
        g.fill();
      }
    },
    [],
  );
  const sheet = useRef<THREE.Group>(null);
  const lid = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const s = since();
    const k = taken ? progress(s, 1.4, 0.3) : 0;
    if (sheet.current) {
      sheet.current.visible = taken;
      // Starts hidden inside the envelope (top edge below the opening), slides up and out.
      sheet.current.position.y = -0.3 + k * 1.25;
    }
    if (lid.current) lid.current.rotation.x = taken ? -progress(s, 0.4) * 2.6 : 0;
  });
  return (
    // Taken, the whole thing sits lower and smaller in the frame so the page that comes out shows.
    <group rotation={taken ? [-0.2, 0.1, 0.06] : [-0.55, 0.15, 0.12]} position-y={taken ? -0.55 : 0.05} scale={taken ? 0.62 : 1}>
      <group ref={sheet} position-z={0.005} visible={false}>
        <mesh>
          <planeGeometry args={[1.2, 1.6]} />
          <meshStandardMaterial map={page} roughness={0.95} />
        </mesh>
      </group>
      <mesh material={M.paper()}>
        <boxGeometry args={[1.8, 1.14, 0.03]} />
      </mesh>
      <mesh position-z={-0.017} rotation-y={Math.PI}>
        <planeGeometry args={[1.8, 1.14]} />
        <meshStandardMaterial map={tex} roughness={0.9} />
      </mesh>
      <group position={[0, 0.57, 0.017]}>
        <mesh ref={lid} material={M.paperDark()} geometry={flap} />
      </group>
      <mesh material={M.wax()} position={[0, -0.02, 0.03]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.14, 0.15, 0.05, 28]} />
      </mesh>
      <mesh material={M.wax()} position={[0, -0.02, 0.058]}>
        <torusGeometry args={[0.1, 0.012, 8, 28]} />
      </mesh>
    </group>
  );
}
