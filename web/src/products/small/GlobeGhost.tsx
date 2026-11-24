import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { reducedMotion } from '../../director/runtime';
import { seeded } from '../../director/footprints';
import { useCanvasTexture } from '../../gl/canvasTex';

/** Just inside the globe's glass (its outer radius is 0.6). */
const GLASS_IN = 0.575;
const HAND_H = 0.25;
/** One cycle of a hand: slammed flat on the glass, held, dragged a little, lifted away, gone. */
const CYCLE = 1.5;

/**
 * A hand pressed flat from inside, palm to the glass: palm, four fingers spread, the thumb.
 * Its alpha carries a grain, so as it lifts off the glass it does not fade evenly but breaks
 * up and goes, like the mark of a hand on cold glass.
 */
function drawHand(g: CanvasRenderingContext2D, w: number, h: number) {
  g.clearRect(0, 0, w, h);
  g.save();
  g.filter = 'blur(2px)';
  g.fillStyle = '#fff';
  // palm
  g.beginPath();
  g.ellipse(w * 0.5, h * 0.72, w * 0.25, h * 0.2, 0, 0, Math.PI * 2);
  g.fill();
  // fingers, spread, the middle ones longest
  const fingers: [number, number, number][] = [
    [0.3, 0.27, -0.18],
    [0.44, 0.2, -0.06],
    [0.58, 0.22, 0.06],
    [0.71, 0.3, 0.2],
  ];
  g.lineCap = 'round';
  g.strokeStyle = '#fff';
  g.lineWidth = w * 0.12;
  for (const [x, top, lean] of fingers) {
    g.beginPath();
    g.moveTo(w * x, h * 0.62);
    g.lineTo(w * (x + lean * 0.5), h * top);
    g.stroke();
  }
  // the thumb, out to the side
  g.lineWidth = w * 0.13;
  g.beginPath();
  g.moveTo(w * 0.28, h * 0.76);
  g.lineTo(w * 0.1, h * 0.55);
  g.stroke();
  g.restore();
  // the grain: alpha 0.5..1 inside the hand, so a rising alphaTest eats it away in specks
  const img = g.getImageData(0, 0, w, h);
  const r = seeded(7);
  for (let i = 0; i < img.data.length; i += 4) {
    const a = img.data[i + 3]!;
    img.data[i] = 0;
    img.data[i + 1] = 0;
    img.data[i + 2] = 0;
    img.data[i + 3] = a > 30 ? Math.round(a * (0.5 + 0.5 * r())) : 0;
  }
  g.putImageData(img, 0, 0);
}

interface Hand {
  /** Where on the glass: across (radians from the front) and up. */
  az: number;
  el: number;
  /** Tilt of the hand on the glass, and its phase in the cycle. */
  roll: number;
  phase: number;
  mirror: boolean;
}

const HANDS: Hand[] = [
  { az: -0.42, el: 0.28, roll: 0.18, phase: 0, mirror: false },
  { az: 0.38, el: 0.22, roll: -0.15, phase: 0.62, mirror: true },
];

/**
 * Taken: something inside wants out. You never see it: only its two hands, and only where
 * they touch the glass. They slam flat against it from inside, hold, drag a little, are
 * pulled back and gone, and slam again; the globe shudders each time.
 */
export function GlobeGhost() {
  const root = useRef<THREE.Group>(null);
  const tex = useCanvasTexture(128, 160, drawHand, []);
  // Opaque with an alpha test, not transparent: the globe's glass uses transmission, and
  // three.js leaves transparent objects out of what is seen through it.
  const mats = useMemo(() => HANDS.map(() => new THREE.MeshBasicMaterial({ map: tex, color: '#0b0707', alphaTest: 0.05, side: THREE.DoubleSide })), [tex]);
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const places = useMemo(
    () =>
      HANDS.map((h) => {
        const n = new THREE.Vector3(Math.sin(h.az) * Math.cos(h.el), Math.sin(h.el), Math.cos(h.az) * Math.cos(h.el));
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
        q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), h.roll));
        return { n, q };
      }),
    [],
  );
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    const still = reducedMotion();
    let bang = 0;
    HANDS.forEach((h, i) => {
      const m = meshes.current[i];
      const mat = mats[i];
      const p = places[i];
      if (!m || !mat || !p) return;
      const c = ((t / CYCLE + h.phase) % 1) * CYCLE;
      // 0–0.06 s slam; held to 0.85 s, dragging down a little; lifted away by 1.15 s; gone
      let shown: number;
      if (still) shown = 1;
      else if (c < 0.06) shown = c / 0.06;
      else if (c < 0.85) shown = 1;
      else if (c < 1.15) shown = 1 - (c - 0.85) / 0.3;
      else shown = 0;
      if (!still && c < 0.12) bang = Math.max(bang, 1 - c / 0.12);
      setHand(m, mat, p, shown, still ? 0 : Math.min(1, Math.max(0, (c - 0.06) / 0.8)));
    });
    // the globe judders when a hand hits the glass
    const g = root.current?.parent;
    if (g) g.position.x = bang > 0 ? Math.sin(t * 95) * 0.012 * bang : 0;
  });
  return (
    <group ref={root}>
      {HANDS.map((h, i) => (
        <mesh
          key={i}
          ref={(m) => {
            meshes.current[i] = m;
          }}
          material={mats[i]}
          scale={[h.mirror ? -1 : 1, 1, 1]}
        >
          <planeGeometry args={[HAND_H * 0.8, HAND_H]} />
        </mesh>
      ))}
    </group>
  );
}

/** Outside the component, so the React compiler rules see no mutation of hook values. */
function setHand(m: THREE.Mesh, mat: THREE.MeshBasicMaterial, p: { n: THREE.Vector3; q: THREE.Quaternion }, shown: number, drag: number) {
  // pressed flat just inside the glass, sliding down a touch as it drags
  m.position.copy(p.n).multiplyScalar(GLASS_IN);
  m.position.y -= drag * 0.02;
  m.quaternion.copy(p.q);
  // fully there at 0.05; at 1 nothing is left
  mat.alphaTest = 0.05 + (1 - shown) * 0.95;
  m.visible = shown > 0.01;
}
