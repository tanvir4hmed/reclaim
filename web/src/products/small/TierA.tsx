import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { useCanvasTexture } from '../../gl/canvasTex';
import { M } from '../../gl/materials';
import { progress, useTaken } from '../../gl/useTaken';
import { useHaunted, useStory } from '../../store';
import { FaceUpSkull } from './Skull';

const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

/**
 * Wooden advent calendar whose doors are the dates of this month (the month you are looking at
 * it in). After the Reveal door 25 stands ajar (Requirement 39). Taken: today's date is struck
 * through with a red cross, as if someone has marked the day it happens.
 */
export function AdventCalendar() {
  const haunted = useHaunted();
  const played = useStory((s) => s.story.played['advent-calendar'] === true);
  const [today] = useState(() => new Date());
  const [cross, setCross] = useState(() => (haunted && played ? 1 : 0));
  useEffect(() => {
    if (!haunted || !played) return;
    const t = setInterval(() => setCross((c) => (c >= 1 ? 1 : Math.min(1, c + 0.08))), 60);
    return () => clearInterval(t);
  }, [haunted, played]);
  const face = useCanvasTexture(
    512,
    400,
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
        if (cross > 0 && d === today.getDate()) {
          // Two strokes in blood, pressed hard, running at the ends.
          g.save();
          g.strokeStyle = '#b00d0d';
          g.lineCap = 'round';
          g.lineWidth = 7;
          const k = cross;
          g.beginPath();
          g.moveTo(cx - 6, cy - 6);
          g.lineTo(cx - 6 + (cw + 12) * Math.min(1, k * 2), cy - 6 + (ch + 12) * Math.min(1, k * 2));
          if (k > 0.5) {
            const k2 = (k - 0.5) * 2;
            g.moveTo(cx + cw + 6, cy - 6);
            g.lineTo(cx + cw + 6 - (cw + 12) * k2, cy - 6 + (ch + 12) * k2);
          }
          g.stroke();
          g.fillStyle = '#8a0a0a';
          g.fillRect(cx + cw + 2, cy + ch + 4, 4, 22 * k);
          g.fillRect(cx - 8, cy + ch + 4, 4, 30 * k);
          g.restore();
        }
      }
    },
    [haunted, cross, today],
  );
  return (
    <group rotation={[-0.1, -0.3, 0]}>
      <mesh material={M.woodLight()}>
        <boxGeometry args={[1.5, 1.1, 0.1]} />
      </mesh>
      <mesh material={M.woodLight()} position={[0, 0.72, 0]} rotation-z={Math.PI / 4}>
        <boxGeometry args={[0.75, 0.75, 0.1]} />
      </mesh>
      <mesh position={[0, 0, 0.052]}>
        <planeGeometry args={[1.42, 1.04]} />
        <meshStandardMaterial map={face} roughness={0.8} />
      </mesh>
      <group position={[0, 0.7, 0.06]} rotation-y={haunted ? -0.9 : 0}>
        <mesh material={M.gilt()} position-x={0.1}>
          <boxGeometry args={[0.2, 0.2, 0.03]} />
        </mesh>
      </group>
      {haunted && (
        <mesh material={M.glow()} position={[0, 0.7, 0.04]}>
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

/** Instant camera; after the Reveal a print hangs out of it. */
export function InstantCamera() {
  const haunted = useHaunted();
  return (
    <group rotation={[0.15, -0.45, 0]} position-y={-0.05}>
      <mesh material={M.enamel()}>
        <boxGeometry args={[1.3, 0.85, 0.6]} />
      </mesh>
      <mesh material={M.bakelite()} position={[0, -0.25, 0]}>
        <boxGeometry args={[1.32, 0.36, 0.62]} />
      </mesh>
      <mesh material={M.bakelite()} position={[0, 0.02, 0.33]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.26, 0.28, 0.12, 40]} />
      </mesh>
      <mesh material={M.glass()} position={[0, 0.02, 0.4]}>
        <circleGeometry args={[0.18, 32]} />
      </mesh>
      <mesh material={M.ink()} position={[0, 0.02, 0.395]}>
        <circleGeometry args={[0.12, 32]} />
      </mesh>
      <mesh material={M.glow()} position={[0.42, 0.28, 0.305]}>
        <planeGeometry args={[0.28, 0.12]} />
      </mesh>
      {haunted && (
        <mesh material={M.paperDark()} position={[0, -0.6, 0.2]} rotation-x={-0.2}>
          <boxGeometry args={[0.6, 0.62, 0.01]} />
        </mesh>
      )}
    </group>
  );
}

/** Wrapped gift with a gold ribbon and a "To: Dad" tag; the sender burns away. */
export function UnopenedGift() {
  const haunted = useHaunted();
  const tag = useCanvasTexture(
    256,
    128,
    (g, w, h) => {
      g.fillStyle = haunted ? '#a48c66' : '#f6eedc';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#3a2a1c';
      g.font = 'italic 34px "Fraunces Variable", Georgia, serif';
      g.fillText('To: Dad', 20, 50);
      if (!haunted) g.fillText('From: Ellie', 20, 100);
      else {
        g.fillStyle = '#140d09';
        g.beginPath();
        g.ellipse(w * 0.55, h * 0.78, 120, 30, -0.1, 0, Math.PI * 2);
        g.fill();
      }
    },
    [haunted],
  );
  // Taken: the lid blows off; inside, a skull with burning eyes, and the bat that was shut in
  // with it bursts out (the bat is drawn by the FX layer, flying off the card).
  const { taken, since } = useTaken('unopened-gift');
  const lid = useRef<THREE.Group>(null);
  const eyes = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  useFrame((st) => {
    const s = since();
    if (lid.current) {
      const k = taken ? progress(s, 0.7) : 0;
      lid.current.position.set(k * 0.9, 0.34 + Math.sin(k * Math.PI) * 0.6 - k * 0.55, k * 0.2);
      lid.current.rotation.set(k * 0.4, 0, -k * 1.9);
    }
    const f = 0.8 + Math.sin(st.clock.elapsedTime * 9) * 0.15 + Math.sin(st.clock.elapsedTime * 23) * 0.08;
    for (const m of eyes.current) m?.color.setRGB(2.2 * f, 0.5 * f, 0.1 * f);
  });
  return (
    <group rotation={[0.35, -0.6, 0]} position-y={-0.15}>
      {!taken ? (
        <>
          <mesh material={M.giftPaper()}>
            <boxGeometry args={[0.95, 0.75, 0.95]} />
          </mesh>
          <mesh material={M.ribbon()}>
            <boxGeometry args={[0.97, 0.77, 0.14]} />
          </mesh>
          <mesh material={M.ribbon()}>
            <boxGeometry args={[0.14, 0.77, 0.97]} />
          </mesh>
        </>
      ) : (
        <GiftOpen eyes={eyes} />
      )}
      <group ref={lid} position-y={0.34}>
        <mesh material={M.giftPaper()} position-y={0.02} visible={taken}>
          <boxGeometry args={[1.0, 0.1, 1.0]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} material={M.ribbon()} position={[s * 0.15, 0.11, 0]} rotation={[Math.PI / 2, 0, s * 0.5]} scale={[1, 0.6, 1]}>
            <torusGeometry args={[0.13, 0.04, 10, 24]} />
          </mesh>
        ))}
      </group>
      <mesh position={[0.3, 0.1, 0.49]} rotation-z={-0.2}>
        <planeGeometry args={[0.42, 0.21]} />
        <meshStandardMaterial map={tag} roughness={0.9} />
      </mesh>
    </group>
  );
}

/** The opened gift: four walls, a scorched inside, and the skull that was waiting in it. */
function GiftOpen({ eyes }: { eyes: RefObject<(THREE.MeshBasicMaterial | null)[]> }) {
  const walls: [number, number, number, number, number][] = [
    [0, 0, 0.465, 0.95, 0.02],
    [0, 0, -0.465, 0.95, 0.02],
    [0.465, 0, 0, 0.02, 0.95],
    [-0.465, 0, 0, 0.02, 0.95],
  ];
  return (
    <group position-y={-0.04}>
      {walls.map(([x, y, z, w, d], i) => (
        <mesh key={i} material={M.giftPaper()} position={[x, y, z]}>
          <boxGeometry args={[w, 0.67, d]} />
        </mesh>
      ))}
      <mesh material={M.ribbon()} position={[0, 0, 0.478]}>
        <boxGeometry args={[0.14, 0.67, 0.01]} />
      </mesh>
      <mesh position-y={-0.3}>
        <boxGeometry args={[0.9, 0.02, 0.9]} />
        <meshStandardMaterial color="#120806" roughness={1} />
      </mesh>
      {/* blood-soaked tissue paper, and on it the skull, lying on its back: the empty sockets,
          the nose hole and the teeth look straight up out of the box, eyes still burning */}
      <mesh position-y={-0.02}>
        <boxGeometry args={[0.9, 0.5, 0.9]} />
        <meshStandardMaterial color="#2c0b09" roughness={0.6} />
      </mesh>
      {/* lying back on the paper, high in the box and tipped a little toward you, so you look
          straight into its face over the rim */}
      <group position={[0, 0.2, 0.06]} rotation={[0.5, 0.6, 0]} scale={0.95}>
        <FaceUpSkull
          embers={[0, 1].map((i) => (m: THREE.MeshBasicMaterial | null) => {
            eyes.current[i] = m;
          })}
        />
      </group>
      <pointLight position={[0.3, 0.9, 0.5]} intensity={0.45} distance={2} color="#ff6a2a" />
    </group>
  );
}

export { RockingChair } from './RockingChair';
