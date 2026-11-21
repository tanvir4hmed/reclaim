import { drawGroup, useCanvasTexture } from '../../gl/canvasTex';
import { M } from '../../gl/materials';
import { useHaunted, useStory } from '../../store';
import type { ModelProps } from '../models';

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
      }),
    [haunted, played, closing],
  );
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
      <mesh material={M.woodLight()} position={[0, -0.4, -0.3]} rotation-x={0.5}>
        <boxGeometry args={[0.2, 0.9, 0.04]} />
      </mesh>
    </group>
  );
}
