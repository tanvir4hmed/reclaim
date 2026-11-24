import { seeded } from '../../director/footprints';
import { drawGroup, useCanvasTexture } from '../../gl/canvasTex';
import { M } from '../../gl/materials';
import { useHaunted, useStory } from '../../store';
import type { ModelProps } from '../models';

/**
 * One crack through the glass: it starts at a point of impact near the top right corner and
 * runs down and across the picture in a jagged line that forks twice, with a few short spurs
 * round the impact. Pale and fine, light catching its edges, on a transparent texture.
 */
function drawCrack(g: CanvasRenderingContext2D, w: number, h: number) {
  g.clearRect(0, 0, w, h);
  let r = seeded(41);
  const hit = { x: w * 0.78, y: h * 0.16 };
  const line = (x0: number, y0: number, angle: number, len: number, width: number, forks: number) => {
    let x = x0;
    let y = y0;
    let a = angle;
    const steps = Math.max(4, Math.round(len / 14));
    g.beginPath();
    g.moveTo(x, y);
    for (let i = 0; i < steps; i++) {
      a += (r() - 0.5) * 0.7;
      x += Math.cos(a) * (len / steps);
      y += Math.sin(a) * (len / steps);
      g.lineTo(x, y);
      if (forks > 0 && i === Math.floor(steps * (0.35 + r() * 0.3))) {
        g.stroke();
        line(x, y, a + (r() < 0.5 ? -0.7 : 0.7), len * 0.45, width * 0.7, forks - 1);
        g.lineWidth = width;
        g.beginPath();
        g.moveTo(x, y);
      }
    }
    g.lineWidth = width;
    g.stroke();
  };
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // a dark hairline under a pale lit edge reads as a crack in glass on any picture
  for (const [style, off, k] of [
    ['rgba(10,8,6,0.55)', 1.2, 1.4],
    ['rgba(235,240,248,0.85)', 0, 1],
  ] as const) {
    g.save();
    g.translate(off, off);
    g.strokeStyle = style;
    // the same crack both times: restart the random sequence
    r = seeded(41);
    line(hit.x, hit.y, Math.PI * 0.72, w * 0.95, 1.6 * k, 2);
    g.restore();
  }
  // short spurs round the point of impact
  g.strokeStyle = 'rgba(235,240,248,0.8)';
  g.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + r() * 0.4;
    const l = 10 + r() * 22;
    g.beginPath();
    g.moveTo(hit.x, hit.y);
    g.lineTo(hit.x + Math.cos(a) * l, hit.y + Math.sin(a) * l);
    g.stroke();
  }
}

/** Same group, same pose; the middle one gone after the Reveal; room made for one more (Req 19). */
/** `glass` off in the hero, where the pane read as a white sheet in the dark. */
export default function PhotoFrame({ glass = true }: ModelProps & { glass?: boolean }) {
  const haunted = useHaunted();
  const played = useStory((s) => s.story.played['photo-frame'] === true);
  const closing = useStory((s) => s.story.closingPlayed);
  const tex = useCanvasTexture(
    512,
    384,
    (g, w, h) =>
      drawGroup(g, w, h, {
        haunted,
        middleGone: haunted && !closing,
        spread: played ? 1 : 0,
        lean: haunted && !played ? 1 : 0,
        edgeGap: closing,
        // Taken: she stands in the middle of the family, where the missing one was.
        witch: haunted && played,
      }),
    [haunted, played, closing],
  );
  const crack = useCanvasTexture(512, 384, drawCrack, []);
  return (
    <group rotation={[-0.08, -0.3, 0]} position-y={0.02}>
      <mesh material={M.gilt()}>
        <boxGeometry args={[1.7, 1.32, 0.1]} />
      </mesh>
      <mesh material={M.woodLight()} position-z={0.03}>
        <boxGeometry args={[1.5, 1.12, 0.06]} />
      </mesh>
      <mesh position-z={0.065}>
        <planeGeometry args={[1.32, 0.98]} />
        <meshStandardMaterial map={tex} roughness={0.35} />
      </mesh>
      {glass && (
        <mesh material={M.glass()} position-z={0.075}>
          <planeGeometry args={[1.34, 1]} />
        </mesh>
      )}
      {/* the moment she is there, the glass cracks across the family */}
      {haunted && played && (
        <mesh position-z={0.08} renderOrder={3}>
          <planeGeometry args={[1.34, 1]} />
          <meshBasicMaterial map={crack} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      <mesh material={M.woodLight()} position={[0, -0.4, -0.3]} rotation-x={0.5}>
        <boxGeometry args={[0.2, 0.9, 0.04]} />
      </mesh>
    </group>
  );
}
