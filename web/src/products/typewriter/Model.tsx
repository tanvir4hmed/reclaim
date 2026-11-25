import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useCanvasTexture } from '../../gl/canvasTex';
import { M } from '../../gl/materials';
import { useHaunted, useStory } from '../../store';
import { cartedTime } from '../../director/consequences';
import { KEY_ROWS, confession, keyFor } from './confession';

/** The sheet: wide and tall enough to read, about half of it still inside the machine at the end. */
const PAPER_W = 1.3;
const PAPER_H = 0.95;
const PAPER_PX_W = 1024;
const PAPER_PX_H = Math.round((PAPER_PX_W * PAPER_H) / PAPER_W);
/** Texture px: the first line's baseline, the line spacing, how far it is fed at the end. */
const TOP_MARGIN = 110;
const LINE = 72;
const FEED_END = TOP_MARGIN + 2 * LINE + 3.2 * LINE;
/** "Help Me!!" sits in the blank space between the last typed line and the platen. */
const BLOOD_Y = TOP_MARGIN + 2 * LINE + 150;
/** The platen's top, in the carriage's frame, where the line being typed sits. */
const PLATEN_TOP = 0.07;

/** The sheet's centre height when `feed` px of it are out above the platen. */
function paperY(feed: number) {
  return PLATEN_TOP + feed * (PAPER_H / PAPER_PX_H) - PAPER_H / 2;
}

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
  // Three lines are enough on a sheet this size: the date, and two lines of the confession.
  const text = [lines[0], lines[2], lines[4]].join('\n');
  const [n, setN] = useState(0);
  const typed = haunted ? Math.min(n, text.length) : 0;
  // Taken: it stops dead. Then, with no key moving, words seep into the paper in blood.
  const [blood, setBlood] = useState(() => (haunted && played ? 1 : 0));

  useEffect(() => {
    if (!haunted || played) return;
    const t = setInterval(() => setN((k) => (k < text.length ? k + 1 : k)), 110);
    return () => clearInterval(t);
  }, [haunted, played, text.length]);

  useEffect(() => {
    if (!haunted || !played) return;
    // Slowly: about eight seconds from the first stain to the full words and their runs.
    const t = setInterval(() => setBlood((b) => (b >= 1 ? 1 : Math.min(1, b + 0.0125))), 100);
    return () => clearInterval(t);
  }, [haunted, played]);

  const current = played ? '' : (text[typed - 1] ?? '');
  const pressed = keyFor(current);
  const shown = text.slice(0, typed).split('\n');
  const line = shown.length - 1;
  const col = (shown[line] ?? '').length;

  // How far the sheet has been fed up out of the machine: the line being typed sits on the
  // platen; each carriage return feeds it up one line; once the three lines are done (or the
  // moment it is taken) it is fed on, so the blank part under the words comes up too.
  const done = typed >= text.length;
  const feed = !haunted || played || done ? FEED_END : TOP_MARGIN + line * LINE;
  const paper = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    const m = paper.current;
    if (!m) return;
    const target = paperY(feed);
    m.position.y += (target - m.position.y) * Math.min(1, dt * 9);
  });

  const tex = useCanvasTexture(
    PAPER_PX_W,
    PAPER_PX_H,
    (g, w) => {
      g.fillStyle = haunted ? '#d8c8a6' : '#f7f1e3';
      g.fillRect(0, 0, w, PAPER_PX_H);
      // big, dark, struck hard: readable at a glance on the card
      g.font = 'bold 52px "Courier New", monospace';
      g.fillStyle = '#0e0907';
      if (!haunted) {
        g.fillText('Dear Santa,', 64, TOP_MARGIN);
        return;
      }
      shown.forEach((l, i) => g.fillText(l, 56, TOP_MARGIN + i * LINE));
      if (blood > 0) {
        // "Help Me!!" seeps up through the blank part of the sheet under the typed lines,
        // as if written with a finger on the other side: a stain first, the letters, then runs.
        const a = blood;
        const ink = Math.min(1, a * 1.6);
        const y = BLOOD_Y;
        g.save();
        g.textAlign = 'center';
        g.font = 'bold 124px "Brush Script MT", "Segoe Script", cursive';
        g.globalAlpha = 0.35 * ink;
        g.fillStyle = '#7a1a12';
        g.filter = 'blur(7px)';
        g.fillText('Help Me!!', w / 2, y);
        g.filter = 'none';
        g.globalAlpha = ink;
        g.fillStyle = '#6e0909';
        g.fillText('Help Me!!', w / 2, y);
        // short runs down toward the platen (the sheet ends there, inside the machine)
        const run = Math.max(0, (a - 0.45) / 0.55);
        for (let i = 0; i < 10; i++) {
          const x = w * 0.18 + i * w * 0.07;
          const len = (14 + ((i * 53) % 40)) * run;
          if (len < 1) continue;
          g.fillRect(x, y - 4, 6, len);
          g.beginPath();
          g.arc(x + 3, y - 4 + len, 6.5, 0, Math.PI * 2);
          g.fill();
        }
        g.restore();
      }
    },
    [haunted, typed, blood],
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
        {/*
          The sheet, rolled round behind the platen: only what has been fed up shows above it;
          the rest is down inside the machine, behind the platen and the body.
        */}
        <mesh ref={paper} position={[0, paperY(FEED_END), -0.03]} rotation-x={-0.12}>
          <planeGeometry args={[PAPER_W, PAPER_H]} />
          <meshStandardMaterial map={tex} roughness={0.9} side={THREE.DoubleSide} />
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
