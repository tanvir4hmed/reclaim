import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { drawWitch, useCanvasTexture } from '../../gl/canvasTex';
import { M } from '../../gl/materials';
import { useTaken } from '../../gl/useTaken';
import { useHaunted } from '../../store';

/** The painted band round the middle: gold, with snowflakes and dots, worn away after the Reveal. */
function drawBand(g: CanvasRenderingContext2D, w: number, h: number, haunted: boolean) {
  g.clearRect(0, 0, w, h);
  const gold = haunted ? '#6e5a33' : '#e3bf5c';
  g.fillStyle = gold;
  g.fillRect(0, h * 0.18, w, h * 0.08);
  g.fillRect(0, h * 0.74, w, h * 0.08);
  g.strokeStyle = gold;
  g.fillStyle = gold;
  g.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const cx = (i + 0.5) * (w / 8);
    const cy = h / 2;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18);
      g.stroke();
    }
    g.beginPath();
    g.arc(cx + w / 16, cy, 4, 0, Math.PI * 2);
    g.fill();
  }
  if (haunted) {
    // flaked off in patches
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 40; i++) {
      g.beginPath();
      g.arc((i * 97) % w, (i * 53) % h, 6 + (i % 5) * 4, 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }
}

/** What is inside the bauble when it is taken: a warm, curved room and her, standing in it. */
function drawInside(g: CanvasRenderingContext2D, w: number, h: number) {
  g.clearRect(0, 0, w, h);
  // an oval, soft at the edge, so it sits inside the curve of the glass
  g.save();
  g.beginPath();
  g.ellipse(w / 2, h / 2, w / 2 - 2, h / 2 - 2, 0, 0, Math.PI * 2);
  g.clip();
  const room = g.createRadialGradient(w * 0.5, h * 0.75, 10, w * 0.5, h * 0.55, w * 0.6);
  room.addColorStop(0, '#6a2a18');
  room.addColorStop(0.5, '#2c0c0c');
  room.addColorStop(1, '#0c0303');
  g.fillStyle = room;
  g.fillRect(0, 0, w, h);
  drawWitch(g, w * 0.5, h * 0.95, h * 0.78);
  g.restore();
  const edge = g.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.5);
  edge.addColorStop(0, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = edge;
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
}

/**
 * Hand-blown glass ornament: a glossy bauble, a fluted gold cap with its wire loop, and a
 * painted band round the middle. Cracked after the Reveal. Taken: the glass goes dark and
 * clear, and she is inside it, standing very still, looking out at you. She stays in there.
 */
export function GlassOrnament() {
  const haunted = useHaunted();
  const { taken } = useTaken('glass-ornament');
  const band = useCanvasTexture(512, 128, (g, w, h) => drawBand(g, w, h, haunted), [haunted]);
  const inside = useCanvasTexture(256, 320, drawInside, []);
  const her = useRef<THREE.Mesh>(null);
  useFrame((st) => {
    // She always faces out of the glass toward you, however the bauble turns.
    const m = her.current;
    if (m) {
      m.lookAt(st.camera.position);
      m.position.y = -0.04 + Math.sin(st.clock.elapsedTime * 0.7) * 0.006;
    }
  });
  const red = haunted ? '#3c1a1d' : '#b3121f';
  return (
    <group position-y={-0.08}>
      {/* the glass: opaque and glossy until taken, then dark and see-through */}
      <mesh renderOrder={2}>
        <sphereGeometry args={[0.5, 64, 48]} />
        {/* Keyed so taking it builds a new material: flipping `transparent` on the old one would
            keep its compiled opaque shader, which forces alpha to 1. */}
        {taken ? (
          <meshPhysicalMaterial key="clear" color={red} metalness={0.2} roughness={0.05} clearcoat={1} transparent opacity={0.34} depthWrite={false} />
        ) : (
          <meshPhysicalMaterial key="whole" color={red} metalness={0.6} roughness={0.08} clearcoat={1} />
        )}
      </mesh>
      <mesh renderOrder={3}>
        <sphereGeometry args={[0.503, 64, 8, 0, Math.PI * 2, Math.PI / 2 - 0.16, 0.32]} />
        <meshStandardMaterial map={band} transparent alphaTest={0.3} metalness={0.7} roughness={0.3} />
      </mesh>
      {taken && (
        <>
          {/* inside: the dark room and her in it */}
          <mesh renderOrder={0}>
            <sphereGeometry args={[0.47, 32, 24]} />
            <meshBasicMaterial color="#0c0404" side={THREE.BackSide} />
          </mesh>
          <mesh ref={her} renderOrder={1}>
            <planeGeometry args={[0.56, 0.7]} />
            <meshBasicMaterial map={inside} transparent opacity={0.95} />
          </mesh>
        </>
      )}
      {/* the cap: a fluted gold collar, its rim, and the wire loop */}
      <mesh material={M.gilt()} position-y={0.52}>
        <cylinderGeometry args={[0.1, 0.13, 0.12, 16]} />
      </mesh>
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return (
          <mesh key={i} material={M.gilt()} position={[Math.sin(a) * 0.118, 0.51, Math.cos(a) * 0.118]} rotation-y={a}>
            <boxGeometry args={[0.012, 0.12, 0.012]} />
          </mesh>
        );
      })}
      <mesh material={M.gilt()} position-y={0.46} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.13, 0.012, 8, 32]} />
      </mesh>
      <mesh material={M.silver()} position-y={0.66}>
        <torusGeometry args={[0.06, 0.009, 8, 24]} />
      </mesh>
      <mesh material={M.silver()} position-y={0.6}>
        <cylinderGeometry args={[0.008, 0.008, 0.06, 6]} />
      </mesh>
      {haunted && (
        <>
          <mesh material={M.ink()} position={[0.12, 0.08, 0.47]} rotation-z={-0.7}>
            <boxGeometry args={[0.32, 0.008, 0.01]} />
          </mesh>
          <mesh material={M.ink()} position={[0.2, -0.02, 0.44]} rotation-z={0.5}>
            <boxGeometry args={[0.14, 0.006, 0.01]} />
          </mesh>
        </>
      )}
    </group>
  );
}
