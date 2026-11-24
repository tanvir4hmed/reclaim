import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useCanvasTexture } from '../../gl/canvasTex';
import { M } from '../../gl/materials';
import { progress, useTaken } from '../../gl/useTaken';
import { useHaunted } from '../../store';

const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

/**
 * Wooden advent calendar whose doors are the dates of this month (the month you are looking at
 * it in). After the Reveal door 25 stands ajar (Requirement 39). Taken: today's date is struck
 * through with a red cross, as if someone has marked the day it happens.
 */
/**
 * Seconds into the calendar's Take. The cross at the speed a person draws one: a stroke from
 * top left to bottom right, a breath, a second one (a little bigger) from top right to bottom
 * left. Then the name, written by hand. Then one thin cut through the middle of it.
 */
const CAL = { cross1: 0.3, cross1For: 0.36, cross2: 0.82, cross2For: 0.4, nameFrom: 1.5, nameFor: 2.3, cutFrom: 4.05, cutFor: 0.35, end: 4.6 };
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** A stroke written in blood with a finger: uneven width, darker at the edges, no drips. */
function bloodStroke(g: CanvasRenderingContext2D, pts: [number, number][], k: number, width: number) {
  if (k <= 0) return;
  const n = Math.max(1, Math.floor((pts.length - 1) * k));
  for (const [color, wd] of [
    ['#3a0406', width + 2.5],
    ['#8a0b0f', width],
    ['#b3161a', width * 0.4],
  ] as const) {
    g.strokeStyle = color;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = wd;
    g.beginPath();
    pts.slice(0, n + 1).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
  }
}

/** A finger-drawn line from a to b, wobbling a little (fixed wobble, so redraws match). */
function wobbly(a: [number, number], b: [number, number], seed: number): [number, number][] {
  return Array.from({ length: 24 }, (_, i) => {
    const t = i / 23;
    const off = Math.sin(t * 9 + seed) * 2.2 + Math.sin(t * 23 + seed * 2) * 1;
    const nx = -(b[1] - a[1]);
    const ny = b[0] - a[0];
    const l = Math.hypot(nx, ny) || 1;
    return [a[0] + (b[0] - a[0]) * t + (nx / l) * off, a[1] + (b[1] - a[1]) * t + (ny / l) * off];
  });
}

const NAME = 'Saint Nicholas';
/** The name climbs a little as it goes, the way a hand writes on a board it is not used to. */
const NAME_RISE = -0.075;

/**
 * "Saint Nicholas" written by hand in blood across the empty space under the days, letter by
 * letter, left to right, the line rising a little: each letter its own slight tilt and height.
 * Dark and thin, only just recognisable as blood. Returns where the line ran, for the cut.
 */
function writeName(g: CanvasRenderingContext2D, w: number, midY: number, k: number, haunted: boolean) {
  g.save();
  g.font = 'italic 74px "Brush Script MT", "Segoe Script", cursive';
  g.textAlign = 'left';
  const widths = NAME.split('').map((c) => g.measureText(c).width * 0.94);
  const total = widths.reduce((a, b) => a + b, 0);
  const x0 = w / 2 - (total * Math.cos(NAME_RISE)) / 2;
  // the baseline a little under the middle, so the letters themselves sit centred in the space
  const y0 = midY + 12 - (total * Math.sin(NAME_RISE)) / 2;
  const shown = k * NAME.length;
  let adv = 0;
  NAME.split('').forEach((c, i) => {
    const a = clamp01(shown - i);
    if (a > 0) {
      const x = x0 + adv * Math.cos(NAME_RISE);
      const y = y0 + adv * Math.sin(NAME_RISE) + Math.sin(i * 2.3) * 1.6;
      g.save();
      g.translate(x, y);
      g.rotate(NAME_RISE + Math.sin(i * 1.7 + 0.4) * 0.05);
      g.globalAlpha = a;
      // a faint wet spread under each letter, then the letter, edged a little darker
      g.filter = 'blur(1.4px)';
      g.fillStyle = 'rgba(96,10,12,0.35)';
      g.fillText(c, 0, 0);
      g.filter = 'none';
      g.fillStyle = haunted ? '#6a0c0e' : '#5e0b0c';
      g.fillText(c, 0, 0);
      g.strokeStyle = 'rgba(40,4,5,0.55)';
      g.lineWidth = 1;
      g.strokeText(c, 0, 0);
      g.restore();
    }
    adv += widths[i] ?? 0;
  });
  g.restore();
  return { x0, y0, len: total };
}

/**
 * One thin cut straight through the middle of the name, left to right: a narrow ragged slit,
 * black where the board shows through, a few torn fibres at its lips. Finer than a claw mark.
 */
function thinCut(g: CanvasRenderingContext2D, line: { x0: number; y0: number; len: number }, k: number) {
  if (k <= 0) return;
  const dx = Math.cos(NAME_RISE);
  const dy = Math.sin(NAME_RISE);
  // through the middle of the letters' height, a little past both ends
  const sx = line.x0 - dx * 22 + dy * 20;
  const sy = line.y0 - dy * 22 - dx * 20;
  const len = (line.len + 44) * k;
  const steps = 26;
  g.fillStyle = '#050303';
  g.beginPath();
  g.moveTo(sx, sy);
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const half = Math.sin(t * Math.PI) * 1.4 * (0.7 + ((s * 37) % 5) / 10);
    g.lineTo(sx + dx * len * t - dy * half, sy + dy * len * t + dx * half);
  }
  for (let s = steps - 1; s >= 0; s--) {
    const t = s / steps;
    const half = Math.sin(t * Math.PI) * 1.2 * (0.7 + ((s * 53) % 5) / 10);
    g.lineTo(sx + dx * len * t + dy * half, sy + dy * len * t - dx * half);
  }
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(214,196,160,0.7)';
  g.lineWidth = 0.7;
  for (let s = 2; s < steps; s += 3) {
    const t = s / steps;
    const px = sx + dx * len * t;
    const py = sy + dy * len * t;
    const side = s % 2 ? 1 : -1;
    g.beginPath();
    g.moveTo(px - dy * 1.5 * side, py + dx * 1.5 * side);
    g.lineTo(px - dy * 3.5 * side + dx * 1.5, py + dx * 3.5 * side + dy * 1.5);
    g.stroke();
  }
}

export function AdventCalendar() {
  const haunted = useHaunted();
  const { taken, since } = useTaken('advent-calendar');
  const [today] = useState(() => new Date());
  // Seconds into the Take, stepped for the canvas; the end state at once on reload or reduced motion.
  const [t, setT] = useState(() => (taken ? since() : 0));
  useEffect(() => {
    if (!taken) return;
    const id = setInterval(() => {
      const s = since();
      setT(s);
      if (s > CAL.end) clearInterval(id);
    }, 50);
    return () => clearInterval(id);
  }, [taken, since]);
  const stroke1 = taken ? clamp01((t - CAL.cross1) / CAL.cross1For) : 0;
  const stroke2 = taken ? clamp01((t - CAL.cross2) / CAL.cross2For) : 0;
  const named = taken ? clamp01((t - CAL.nameFrom) / CAL.nameFor) : 0;
  const cut = taken ? clamp01((t - CAL.cutFrom) / CAL.cutFor) : 0;
  const face = useCanvasTexture(
    512,
    480,
    (g, w, h) => {
      const y = today.getFullYear();
      const m = today.getMonth();
      const first = new Date(y, m, 1).getDay();
      const days = new Date(y, m + 1, 0).getDate();
      g.fillStyle = haunted ? '#3a2c20' : '#c99a5c';
      g.fillRect(0, 0, w, h);
      g.fillStyle = haunted ? '#c8b89a' : '#7a1a1a';
      g.font = 'bold 38px "Fraunces Variable", Georgia, serif';
      g.textAlign = 'center';
      g.fillText(`${MONTHS[m] ?? ''} ${y}`, w / 2, 46);
      g.font = '18px "Fraunces Variable", Georgia, serif';
      'SMTWTFS'.split('').forEach((d, i) => g.fillText(d, 44 + i * 70, 78));
      const cw = 62;
      const ch = 48;
      for (let d = 1; d <= days; d++) {
        const idx = first + d - 1;
        const cx = 14 + (idx % 7) * 70;
        const cy = 90 + Math.floor(idx / 7) * 51;
        const door = haunted ? (d % 3 ? '#4a1e18' : '#22301f') : d % 3 ? '#a4161f' : '#2f5a36';
        g.fillStyle = door;
        g.fillRect(cx, cy, cw, ch);
        g.strokeStyle = haunted ? '#1a110b' : '#e6c27a';
        g.lineWidth = 2;
        g.strokeRect(cx + 1, cy + 1, cw - 2, ch - 2);
        g.fillStyle = haunted ? '#a8987c' : '#f6e7c4';
        g.font = 'bold 22px "Fraunces Variable", Georgia, serif';
        g.fillText(String(d), cx + cw / 2, cy + 32);
        if (stroke1 > 0 && d === today.getDate()) {
          // Two strokes in blood with a finger, on the door itself: corner to corner, the
          // second reaching a little further than the first. No drips.
          g.save();
          bloodStroke(g, wobbly([cx + 4, cy + 3], [cx + cw - 3, cy + ch - 4], 1), stroke1, 6);
          bloodStroke(g, wobbly([cx + cw + 5, cy - 5], [cx - 6, cy + ch + 6], 4), stroke2, 7);
          g.restore();
        }
      }
      // The empty space under the days: from the bottom of the last row to the foot of the board.
      const rows = Math.ceil((first + days) / 7);
      const lastBottom = 90 + (rows - 1) * 51 + ch;
      const midY = (lastBottom + h) / 2;
      if (named > 0) {
        // the name of the one who comes in the night, written by hand, rising as it goes
        const line = writeName(g, w, midY, named, haunted);
        // then one thin cut through the middle of it
        thinCut(g, line, cut);
      }
    },
    [haunted, stroke1, stroke2, named, cut, today],
  );
  // A taller board, with a strip of plain wood under the days (where the name is written).
  return (
    <group rotation={[-0.1, -0.3, 0]} position-y={-0.08} scale={0.92}>
      <mesh material={M.woodLight()}>
        <boxGeometry args={[1.5, 1.4, 0.1]} />
      </mesh>
      <mesh material={M.woodLight()} position={[0, 0.87, 0]} rotation-z={Math.PI / 4}>
        <boxGeometry args={[0.75, 0.75, 0.1]} />
      </mesh>
      <mesh position={[0, 0, 0.052]}>
        <planeGeometry args={[1.42, 1.33]} />
        <meshStandardMaterial map={face} roughness={0.8} />
      </mesh>
      <group position={[0, 0.85, 0.06]} rotation-y={haunted ? -0.9 : 0}>
        <mesh material={M.gilt()} position-x={0.1}>
          <boxGeometry args={[0.2, 0.2, 0.03]} />
        </mesh>
      </group>
      {haunted && (
        <mesh material={M.glow()} position={[0, 0.85, 0.04]}>
          <planeGeometry args={[0.18, 0.18]} />
        </mesh>
      )}
    </group>
  );
}

/**
 * Wind-up tin soldier. Taken: he snaps in two at the chest with a crack of tin; the top half
 * (head, hat, rifle) drops sideways to a hard 90 degrees and hangs there on a torn seam.
 */
export function TinSoldier() {
  const haunted = useHaunted();
  const { taken, since } = useTaken('tin-soldier');
  const top = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!top.current) return;
    const s = since();
    // A snap, not a fall: almost all of the turn in the first fifth of a second, then a judder.
    const k = taken ? progress(s, 0.22) : 0;
    const judder = taken && s < 0.6 ? Math.sin(s * 60) * 0.06 * (1 - s / 0.6) : 0;
    top.current.rotation.z = -k * (Math.PI / 2) + judder;
  });
  return (
    <group position-y={-0.05} rotation={[0, -0.3, haunted ? 0.25 : 0]}>
      <mesh material={M.tinBlue()} position={[-0.08, -0.4, 0]}>
        <cylinderGeometry args={[0.065, 0.06, 0.45, 18]} />
      </mesh>
      <mesh material={M.tinBlue()} position={[0.08, -0.4, 0]}>
        <cylinderGeometry args={[0.065, 0.06, 0.45, 18]} />
      </mesh>
      {/* lower body, up to the break */}
      <mesh material={M.tin()} position-y={-0.07}>
        <cylinderGeometry args={[0.165, 0.16, 0.27, 24]} />
      </mesh>
      <mesh material={M.gilt()} position-y={-0.18}>
        <cylinderGeometry args={[0.172, 0.172, 0.05, 24]} />
      </mesh>
      <mesh material={M.brass()} position={[0, -0.04, -0.2]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.08, 0.015, 8, 20]} />
      </mesh>
      {taken && (
        // the torn tin at the break: jagged and dark inside
        <mesh position-y={0.07}>
          <cylinderGeometry args={[0.166, 0.166, 0.012, 12, 1, true]} />
          <meshStandardMaterial color="#1a1a1c" metalness={0.8} roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* upper body, hinged at the break on the soldier's right side */}
      <group position={[0.165, 0.07, 0]}>
        <group ref={top}>
          <group position={[-0.165, -0.07, 0]}>
            <mesh material={M.tin()} position-y={0.155}>
              <cylinderGeometry args={[0.17, 0.165, 0.17, 24]} />
            </mesh>
            <mesh material={M.porcelain()} position-y={0.36}>
              <sphereGeometry args={[0.13, 24, 18]} />
            </mesh>
            <mesh material={M.bakelite()} position-y={0.58}>
              <cylinderGeometry args={[0.12, 0.13, 0.3, 24]} />
            </mesh>
            <mesh material={M.silver()} position={[0.25, 0.05, 0.05]} rotation-z={0.05}>
              <boxGeometry args={[0.04, 0.8, 0.04]} />
            </mesh>
          </group>
        </group>
      </group>
      {taken && <BoneHand since={since} />}
    </group>
  );
}

/**
 * Out of the broken soldier: a skeleton hand, much too big to have fitted inside him, pushing
 * up out of the torn tin, fingers uncurling.
 */
function BoneHand({ since }: { since: () => number }) {
  const hand = useRef<THREE.Group>(null);
  const fingers = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => {
    const s = since();
    const up = progress(s, 1.4, 0.5);
    if (hand.current) {
      hand.current.position.y = 0.0 + up * 0.32;
      hand.current.scale.setScalar(Math.max(0.001, up));
    }
    const open = progress(s, 1.0, 1.6);
    fingers.current.forEach((f, i) => {
      if (f) f.rotation.x = (1 - open) * 1.3 + Math.sin(s * 3 + i) * 0.05 * open;
    });
  });
  const bone = <meshStandardMaterial color="#e3d9c2" roughness={0.65} />;
  return (
    <group ref={hand} position={[0, 0.07, 0]} rotation-z={0.15}>
      {/* wrist and palm bones */}
      <mesh position-y={-0.06}>
        <cylinderGeometry args={[0.025, 0.03, 0.16, 8]} />
        {bone}
      </mesh>
      <mesh position-y={0.05} scale={[1.4, 0.6, 0.5]}>
        <sphereGeometry args={[0.06, 12, 10]} />
        {bone}
      </mesh>
      {[-0.045, -0.015, 0.015, 0.045].map((x, i) => (
        <group
          key={x}
          ref={(g) => {
            fingers.current[i] = g;
          }}
          position={[x, 0.08, 0]}
        >
          {[0, 1, 2].map((j) => (
            <mesh key={j} position-y={0.025 + j * 0.048}>
              <cylinderGeometry args={[0.009 - j * 0.002, 0.011 - j * 0.002, 0.042, 6]} />
              {bone}
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[-0.075, 0.04, 0]} rotation-z={0.8}>
        <cylinderGeometry args={[0.01, 0.012, 0.08, 6]} />
        {bone}
      </mesh>
    </group>
  );
}

/**
 * Walnut valve radio with a lit tuning scale (kHz, station ticks, a needle and a tuning knob).
 * One station is marked with a red smear and "Hz" scratched beside it. Taken: an unseen hand
 * turns the knob, the needle stopping at each station in turn, until it lands on the red mark.
 */
export function ValveRadio() {
  const haunted = useHaunted();
  const { taken, since } = useTaken('valve-radio');
  const needle = useRef<THREE.Mesh>(null);
  const knob = useRef<THREE.Mesh>(null);
  const dial = useCanvasTexture(512, 160, (g, w, h) => drawDial(g, w, h, haunted), [haunted]);
  useFrame(() => {
    const f = tunedAt(since(), taken, haunted);
    if (needle.current) needle.current.position.x = 0.38 - DIAL_W / 2 + 0.03 + f * (DIAL_W - 0.06);
    if (knob.current) knob.current.rotation.y = f * Math.PI * 3;
  });
  return (
    <group rotation={[0.1, -0.4, 0]} position-y={-0.1}>
      <mesh material={M.wood()}>
        <boxGeometry args={[1.4, 0.9, 0.55]} />
      </mesh>
      <mesh material={M.wood()} position-y={0.45} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.7, 0.7, 0.55, 40, 1, false, -Math.PI / 2, Math.PI]} />
      </mesh>
      <mesh material={M.knit()} position={[-0.32, 0.16, 0.28]}>
        <circleGeometry args={[0.3, 40]} />
      </mesh>
      {/* the tuning scale, lit from behind, and its needle */}
      <mesh material={M.darkBrass()} position={[0.38, 0.16, 0.279]}>
        <planeGeometry args={[DIAL_W + 0.05, 0.26]} />
      </mesh>
      <mesh position={[0.38, 0.16, 0.282]}>
        <planeGeometry args={[DIAL_W, 0.2]} />
        <meshBasicMaterial map={dial} toneMapped={false} />
      </mesh>
      <mesh ref={needle} position={[0.38, 0.16, 0.286]}>
        <planeGeometry args={[0.01, 0.2]} />
        <meshBasicMaterial color="#b0120c" />
      </mesh>
      {[-0.15, 0.2].map((x) => (
        <mesh key={x} material={M.brass()} position={[x, -0.28, 0.3]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.07, 0.07, 0.07, 24]} />
        </mesh>
      ))}
      {/* the tuning knob, with a ridge so you can see it turn */}
      <mesh ref={knob} material={M.brass()} position={[0.55, -0.28, 0.3]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.09, 0.09, 0.08, 10]} />
      </mesh>
    </group>
  );
}

/** Where the needle stops while someone unseen tunes through the stations (fractions of the dial). */
const TUNING = [0.08, 0.22, 0.36, 0.5, 0.42, 0.6, 0.55, 0.78];
/** The station marked in red, the one it always ends on. */
const RED_STATION = 0.78;
const DIAL_W = 0.62;

/** Needle position 0..1: idle by day or haunted, stepping through the stations once taken. */
function tunedAt(s: number, taken: boolean, haunted: boolean): number {
  if (!taken) return haunted ? 0.3 : 0.2;
  if (s === Infinity) return RED_STATION;
  const per = 0.78; // 0.6 s held at a station, 0.18 s to swing to the next
  const i = Math.min(TUNING.length - 1, Math.floor(s / per));
  const k = Math.min(1, Math.max(0, (s - i * per - 0.6) / 0.18));
  const a = TUNING[i] ?? RED_STATION;
  const b = TUNING[Math.min(TUNING.length - 1, i + 1)] ?? RED_STATION;
  return a + (b - a) * k;
}

/** The lit scale: kHz numbers, station ticks, and the red station marked "Hz". */
function drawDial(g: CanvasRenderingContext2D, w: number, h: number, haunted: boolean) {
  const glow = g.createLinearGradient(0, 0, 0, h);
  glow.addColorStop(0, haunted ? '#3a2a12' : '#f3cf7a');
  glow.addColorStop(1, haunted ? '#1a1208' : '#c8902e');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = haunted ? '#d8b876' : '#3a2410';
  g.fillStyle = haunted ? '#d8b876' : '#3a2410';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(24, h * 0.62);
  g.lineTo(w - 24, h * 0.62);
  g.stroke();
  for (let i = 0; i <= 40; i++) {
    const x = 24 + (i / 40) * (w - 48);
    g.beginPath();
    g.moveTo(x, h * 0.62);
    g.lineTo(x, h * (i % 5 === 0 ? 0.42 : 0.52));
    g.stroke();
  }
  const labels = ['55', '60', '70', '80', '100', '120', '140', '160'];
  g.font = 'bold 22px "Courier New", monospace';
  g.textAlign = 'center';
  labels.forEach((l, i) => g.fillText(l, 24 + (i / (labels.length - 1)) * (w - 48), h * 0.32));
  g.font = '18px "Courier New", monospace';
  g.fillText('kHz × 10', w - 70, h * 0.92);
  const rx = 24 + RED_STATION * (w - 48);
  g.fillStyle = 'rgba(150,10,10,0.9)';
  g.beginPath();
  g.ellipse(rx, h * 0.6, 12, 26, 0.2, 0, Math.PI * 2);
  g.fill();
  g.fillRect(rx - 2, h * 0.6, 4, h * 0.36);
  g.fillStyle = '#9a0c0c';
  g.font = 'italic bold 26px "Brush Script MT", cursive';
  g.fillText('Hz', rx + 30, h * 0.86);
}


export { InstantCamera } from './InstantCamera';
export { UnopenedGift } from './SurpriseGift';
export { RockingChair } from './RockingChair';

