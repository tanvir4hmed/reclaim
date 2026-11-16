import { useEffect, useMemo, useState } from 'react';
import { useCanvasTexture } from '../../gl/canvasTex';
import { M } from '../../gl/materials';
import { useHaunted, useStory } from '../../store';
import { cartedTime } from '../../director/consequences';
import { KEY_ROWS, confession, keyFor } from './confession';

/**
 * Typewriter that types tomorrow's confession one letter at a time. Each letter's key presses
 * down as the letter strikes the paper; line ends return the carriage (Requirement 17).
 */
export default function Typewriter() {
  const haunted = useHaunted();
  const played = useStory((s) => s.story.played.typewriter === true);
  const [now] = useState(() => new Date());
  const lines = useMemo(() => {
    const t = played ? cartedTime('typewriter') : null;
    return confession(now, played ? (t !== null ? new Date(t) : now) : null);
  }, [played, now]);
  const text = lines.join('\n');
  const [n, setN] = useState(0);
  const typed = haunted ? Math.min(n, text.length) : 0;

  useEffect(() => {
    if (!haunted) return;
    const t = setInterval(() => setN((k) => (k < text.length ? k + 1 : k)), 110);
    return () => clearInterval(t);
  }, [haunted, text.length]);

  const current = text[typed - 1] ?? '';
  const pressed = keyFor(current);
  const shown = text.slice(0, typed).split('\n');
  const line = shown.length - 1;
  const col = (shown[line] ?? '').length;

  const tex = useCanvasTexture(
    512,
    420,
    (g, w, h) => {
      g.fillStyle = haunted ? '#d8c8a6' : '#f7f1e3';
      g.fillRect(0, 0, w, h);
      g.font = '22px "Courier New", monospace';
      g.fillStyle = '#2a1e18';
      if (!haunted) {
        g.fillText('Dear Santa,', 40, 70);
        return;
      }
      shown.forEach((l, i) => g.fillText(l, 36, 60 + i * 34));
    },
    [haunted, typed],
  );

  return (
    <group rotation={[0.5, -0.3, 0]} position-y={-0.2} scale={0.95}>
      <mesh material={M.bakelite()} position-y={-0.2}>
        <boxGeometry args={[1.5, 0.3, 0.95]} />
      </mesh>
      <mesh material={M.bakelite()} position={[0, 0.02, -0.25]} rotation-x={-0.3}>
        <boxGeometry args={[1.35, 0.25, 0.4]} />
      </mesh>
      {/* Carriage: slides left as the line fills, returns at line end. */}
      <group position={[0.25 - col * 0.012, 0.32, -0.36]}>
        <mesh material={M.silver()} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.07, 0.07, 1.5, 24]} />
        </mesh>
        <mesh position={[0, 0.3, -0.02]} rotation-x={-0.15}>
          <planeGeometry args={[0.95, 0.78]} />
          <meshStandardMaterial map={tex} roughness={0.9} />
        </mesh>
      </group>
      {KEY_ROWS.map((row, r) =>
        row.split('').map((_, i) => {
          const down = pressed !== null && pressed[0] === r && pressed[1] === i;
          return (
            <group key={`${r}-${i}`} position={[-0.55 + i * 0.12 + r * 0.05, -0.02 - r * 0.02 - (down ? 0.035 : 0), 0.05 + r * 0.13]}>
              <mesh material={M.silver()}>
                <cylinderGeometry args={[0.045, 0.045, 0.02, 18]} />
              </mesh>
              <mesh material={M.enamel()} position-y={0.012}>
                <cylinderGeometry args={[0.038, 0.038, 0.006, 18]} />
              </mesh>
            </group>
          );
        }),
      )}
      <mesh material={M.silver()} position={[0, -0.05, 0.47]}>
        <boxGeometry args={[0.7, 0.03, 0.08]} />
      </mesh>
    </group>
  );
}
