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
      g.translate(w * 0.5, h * 0.25);
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
      g.font = 'bold 44px "Brush Script MT", "Segoe Script", cursive';
      g.textAlign = 'center';
      // Written high on the page, above where the envelope still covers it.
      g.fillText('YOU KILLED ME', w / 2, h * 0.58);
      g.font = 'italic 30px "Brush Script MT", "Segoe Script", cursive';
      g.fillText('I am behind you', w / 2, h * 0.7);
      for (let i = 0; i < 9; i++) {
        const x = w * 0.16 + i * w * 0.085;
        const len = 18 + ((i * 37) % 40);
        g.fillRect(x, h * 0.585, 3, len);
        g.beginPath();
        g.arc(x + 1.5, h * 0.585 + len, 3.4, 0, Math.PI * 2);
        g.fill();
      }
    },
    [],
  );
  const sheet = useRef<THREE.Group>(null);
  const lid = useRef<THREE.Group>(null);
  const sealHalf = useRef<THREE.Group>(null);
  useFrame(() => {
    const s = since();
    // The seal tears first (it shudders and splits), then the flap folds open, then the page
    // rises out of the envelope until the words in blood and the run under them show; the
    // rest of the page stays inside.
    const tear = taken ? progress(s, 0.35, 0.15) : 0;
    const open = taken ? progress(s, 0.8, 0.5) : 0;
    const rise = taken ? progress(s, 1.6, 1.3) : 0;
    if (sealHalf.current) {
      const shake = taken && s < 0.5 ? Math.sin(s * 70) * 0.01 * (1 - s / 0.5) : 0;
      sealHalf.current.position.x = shake + tear * 0.012;
    }
    // Up and over to the back, so it stands open behind the page instead of covering it.
    if (lid.current) lid.current.rotation.x = open * 2.75;
    if (sheet.current) {
      sheet.current.visible = taken;
      // Starts hidden inside (top edge under the opening at y 0.57); stops with its edge
      // a little below the blood still inside the envelope.
      sheet.current.position.y = -0.3 + rise * 1.25;
    }
  });
  return (
    // Taken, it sits a little lower and smaller in the frame so the page and the open flap show.
    <group rotation={taken ? [-0.2, 0.1, 0.06] : [-0.55, 0.15, 0.12]} position-y={taken ? -0.45 : 0.05} scale={taken ? 0.7 : 1}>
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
      {/* the flap, hinged at the top edge; it folds up and back and stays open (both sides drawn) */}
      <group ref={lid} position={[0, 0.57, 0.017]}>
        <mesh geometry={flap}>
          <meshStandardMaterial color={haunted ? '#8d7553' : '#d9c8a6'} roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
        {/* the half of the seal that tears away with the flap's tip */}
        <group position={[0, -0.59, 0.013]}>
          <mesh material={M.wax()} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.14, 0.15, 0.05, 28, 1, false, 0, Math.PI]} />
          </mesh>
        </group>
      </group>
      {/* the half that stays on the envelope */}
      <group ref={sealHalf} position={[0, -0.02, 0.03]}>
        <mesh material={M.wax()} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.14, 0.15, 0.05, 28, 1, false, Math.PI, Math.PI]} />
        </mesh>
      </group>
      {!taken && (
        <mesh material={M.wax()} position={[0, -0.02, 0.058]}>
          <torusGeometry args={[0.1, 0.012, 8, 28]} />
        </mesh>
      )}
    </group>
  );
}
