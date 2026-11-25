import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useCanvasTexture } from '../../gl/canvasTex';
import { M } from '../../gl/materials';
import { useTaken } from '../../gl/useTaken';
import { useHaunted } from '../../store';

const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

/**
 * Wooden advent calendar whose doors are the dates of this month (the month you are looking at
 * it in). After the Reveal door 25 stands ajar (Requirement 39). Taken: today's date is struck
 * through with a red cross, as if someone has marked the day it happens.
 */
/**
 * Seconds into the calendar's Take. The cross is two quick, straight pen strokes, the way you
 * strike out a date: one corner to corner, then a second, much longer one across it. Then the
 * name, written by hand. Then one cut through the middle of it, and the wet letters start to run.
 */
const CAL = { cross1: 0.3, cross1For: 0.13, cross2: 0.58, cross2For: 0.17, nameFrom: 1.2, nameFor: 2.3, cutFrom: 3.75, cutFor: 0.3, meltFrom: 3.85, meltFor: 2.4, end: 6.4 };
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** The red of the name and the cross: blood, still wet. */
const BLOOD = '#8f0a10';

/**
 * One quick, straight pen stroke from a to b, drawn up to `k` of its length: thin where the
 * pen lands and lifts, fullest in the middle, with the slightest bow of a fast hand.
 */
function penStroke(g: CanvasRenderingContext2D, a: [number, number], b: [number, number], k: number, width: number) {
  if (k <= 0) return;
  const steps = 28;
  const n = Math.max(1, Math.round(steps * k));
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const at = (t: number, side: number) => {
    // thin at both ends, full from a fifth of the way to four fifths
    const w = width * (0.18 + 0.82 * Math.sin(Math.PI * Math.min(1, Math.max(0, t))) ** 0.55) * 0.5;
    const bow = Math.sin(t * Math.PI) * len * 0.012;
    return [a[0] + dx * t + nx * (side * w + bow), a[1] + dy * t + ny * (side * w + bow)] as const;
  };
  g.save();
  g.fillStyle = BLOOD;
  g.beginPath();
  const end = Math.min(1, k);
  for (let i = 0; i <= n; i++) {
    const [x, y] = at((i / n) * end, 1);
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  for (let i = n; i >= 0; i--) {
    const [x, y] = at((i / n) * end, -1);
    g.lineTo(x, y);
  }
  g.closePath();
  g.fill();
  // a darker edge where the ink pooled along one side
  g.strokeStyle = 'rgba(40,2,4,0.45)';
  g.lineWidth = 0.8;
  g.stroke();
  g.restore();
}

const NAME = 'Saint Nicholas';
/** The name climbs a little as it goes, the way a hand writes on a board it is not used to. */
const NAME_RISE = -0.075;

/**
 * "Saint Nicholas" written by hand in blood across the empty space under the days, letter by
 * letter, left to right, the line rising a little: each letter its own slight tilt and height.
 * In wet blood red; once it is cut, the letters begin to run, a little. Returns where the line
 * ran, for the cut.
 */
function writeName(g: CanvasRenderingContext2D, w: number, midY: number, k: number, melt: number) {
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
      g.fillStyle = 'rgba(120,8,12,0.35)';
      g.fillText(c, 0, 0);
      g.filter = 'none';
      g.fillStyle = BLOOD;
      g.fillText(c, 0, 0);
      g.strokeStyle = 'rgba(40,4,5,0.55)';
      g.lineWidth = 1;
      g.strokeText(c, 0, 0);
      if (melt > 0 && c !== ' ') meltLetter(g, c, i, melt);
      g.restore();
    }
    adv += widths[i] ?? 0;
  });
  g.restore();
  return { x0, y0, len: total };
}

/**
 * The letters running after the cut, only a little: each sags a pixel or two, and a short
 * drip or two creeps down from its foot. Drawn in the letter's own (rotated) frame.
 */
function meltLetter(g: CanvasRenderingContext2D, c: string, i: number, melt: number) {
  const wdt = g.measureText(c).width;
  // the letter slumps: a smear of itself, a little lower
  g.globalAlpha *= 0.45;
  g.fillText(c, 0, 2.2 * melt);
  g.globalAlpha /= 0.45;
  const drips = 1 + ((i * 7) % 3 === 0 ? 1 : 0);
  for (let d = 0; d < drips; d++) {
    const x = wdt * (0.25 + ((i * 37 + d * 53) % 50) / 100);
    const len = (5 + ((i * 29 + d * 17) % 9)) * melt;
    const r = 1.6 + ((i + d) % 3) * 0.4;
    g.fillRect(x - r * 0.55, -2, r * 1.1, len + 2);
    g.beginPath();
    g.arc(x, len, r, 0, Math.PI * 2);
    g.fill();
  }
}

/**
 * One cut straight through the middle of the name, left to right: a narrow ragged slit, black
 * where the board shows through, a few torn fibres at its lips, running well past both ends.
 */
function thinCut(g: CanvasRenderingContext2D, line: { x0: number; y0: number; len: number }, k: number) {
  if (k <= 0) return;
  const dx = Math.cos(NAME_RISE);
  const dy = Math.sin(NAME_RISE);
  // through the middle of the letters' height, well past both ends
  const over = 46;
  const sx = line.x0 - dx * over + dy * 20;
  const sy = line.y0 - dy * over - dx * 20;
  const len = (line.len + over * 2) * k;
  const steps = 30;
  g.fillStyle = '#050303';
  g.beginPath();
  g.moveTo(sx, sy);
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const half = Math.sin(t * Math.PI) * 2.6 * (0.7 + ((s * 37) % 5) / 10);
    g.lineTo(sx + dx * len * t - dy * half, sy + dy * len * t + dx * half);
  }
  for (let s = steps - 1; s >= 0; s--) {
    const t = s / steps;
    const half = Math.sin(t * Math.PI) * 2.3 * (0.7 + ((s * 53) % 5) / 10);
    g.lineTo(sx + dx * len * t + dy * half, sy + dy * len * t - dx * half);
  }
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(214,196,160,0.7)';
  g.lineWidth = 0.8;
  for (let s = 2; s < steps; s += 3) {
    const t = s / steps;
    const px = sx + dx * len * t;
    const py = sy + dy * len * t;
    const side = s % 2 ? 1 : -1;
    g.beginPath();
    g.moveTo(px - dy * 2.6 * side, py + dx * 2.6 * side);
    g.lineTo(px - dy * 5 * side + dx * 1.5, py + dx * 5 * side + dy * 1.5);
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
  const melt = taken ? clamp01((t - CAL.meltFrom) / CAL.meltFor) : 0;
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
          // Two quick straight pen strokes, struck through the door: corner to corner, then a
          // second one, much longer, slashed right across it and well past both corners.
          penStroke(g, [cx + 5, cy + 4], [cx + cw - 4, cy + ch - 5], stroke1, 7);
          penStroke(g, [cx + cw + 26, cy - 22], [cx - 30, cy + ch + 26], stroke2, 8);
        }
      }
      // The empty space under the days: from the bottom of the last row to the foot of the board.
      const rows = Math.ceil((first + days) / 7);
      const lastBottom = 90 + (rows - 1) * 51 + ch;
      const midY = (lastBottom + h) / 2;
      if (named > 0) {
        // the name of the one who comes in the night, written by hand, rising as it goes
        const line = writeName(g, w, midY, named, melt);
        // then one thin cut through the middle of it
        thinCut(g, line, cut);
      }
    },
    [haunted, stroke1, stroke2, named, cut, melt, today],
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

