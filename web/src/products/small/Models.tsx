import type { ThreeElements } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useCanvasTexture } from '../../gl/canvasTex';
import { mat } from '../../gl/decay';
import { M } from '../../gl/materials';
import { useHaunted } from '../../store';
import { useTaken } from '../../gl/useTaken';
import { GlobeGhost } from './GlobeGhost';

export { ChocolateBox } from './Chocolates';
export { MusicBox } from './MusicBox';
export { TeddyBear } from './Teddy';

/* The globe's little world is the television's picture made small: the snowy log cottage with
 * its thick snow roof, chimney and lit windows, the big pine hung with warm lights on a drift,
 * and two dark pines behind. After the Reveal it all goes murky (the shared materials age), the
 * windows and bulbs die down, and snow turns to ash. */

/** The top of the globe's snow floor. */
const GLOBE_FLOOR = -0.35;

/** Stone for the chimney; soot-dark after the Reveal. */
const GLOBE_BRICK = () => mat('globeBrick', { color: '#7a3b2a', roughness: 0.9, hauntedColor: '#3a2a24', decay: { dust: 0.4, age: 0.5 } });
/** The pines behind the house: darker than the big one. */
const GLOBE_PINE_DARK = () => mat('globePineDark', { color: '#1d3627', roughness: 0.7, hauntedColor: '#22231e', decay: { dust: 0.5 } });
/** The tree's warm bulbs, and the same bulbs dead after the Reveal. */
const GLOBE_BULB = () => mat('globeBulb', { color: '#ffd9a0', emissive: '#ffb04a', emissiveIntensity: 2.6, roughness: 0.4 });
const GLOBE_BULB_DEAD = () => mat('globeBulbDead', { color: '#2a2622', roughness: 0.5, decay: { age: 0, dust: 0 } });
/** A window after the Reveal: nearly out, the faintest ember left behind the glass. */
const GLOBE_WINDOW_DEAD = () =>
  mat('globeWindowDead', { color: '#2c261d', emissive: '#3a2610', emissiveIntensity: 0.6, roughness: 0.6, decay: { age: 0, dust: 0 } });

/** A lumpy drift of snow over the floor, highest in the middle. */
function globeMound(): THREE.LatheGeometry {
  const prof: [number, number][] = [
    [0.476, -0.012],
    [0.47, 0],
    [0.44, 0.022],
    [0.38, 0.042],
    [0.3, 0.056],
    [0.2, 0.064],
    [0.1, 0.068],
    [0, 0.07],
  ];
  const g = new THREE.LatheGeometry(
    prof.map(([x, y]) => new THREE.Vector2(x, y)),
    64,
  );
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const k = Math.max(0, Math.min(1, (0.44 - Math.hypot(x, z)) / 0.1));
    p.setY(i, p.getY(i) + k * 0.008 * Math.sin(x * 23 + 1.3) * Math.sin(z * 19 + 0.4));
  }
  g.computeVertexNormals();
  return g;
}

/** One tier of pine boughs (unit size): a drooping skirt with bough tips round its rim. */
function pineTier(snow: boolean): THREE.LatheGeometry {
  const prof: [number, number][] = [
    [0, 0.05],
    [0.96, -0.04],
    [1, 0],
    [0.8, 0.12],
    [0.6, 0.27],
    [0.4, 0.46],
    [0.2, 0.7],
    [0, 1],
  ];
  // the snow: the same skirt drawn in and lifted, so it lies on the upper three quarters
  const pts = prof.map(([x, y]) => (snow ? new THREE.Vector2(x * 0.85, y + 0.14) : new THREE.Vector2(x, y)));
  const g = new THREE.LatheGeometry(pts, 54);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const y = p.getY(i);
    const rim = Math.max(0, 1 - Math.abs(y - (snow ? 0.14 : 0)) / 0.3);
    const lobe = Math.pow(0.5 + 0.5 * Math.cos(Math.atan2(z, x) * 9 + (snow ? Math.PI : 0)), 2);
    const s = 1 + rim * (snow ? 0.08 : 0.14) * lobe;
    p.setXYZ(i, x * s, y - rim * lobe * (snow ? 0.02 : 0.05), z * s);
  }
  g.computeVertexNormals();
  return g;
}

interface GlobeGeo {
  mound: THREE.LatheGeometry;
  tier: THREE.LatheGeometry;
  tierSnow: THREE.LatheGeometry;
  gable: THREE.ExtrudeGeometry;
  roofSnow: THREE.ExtrudeGeometry;
}

function globeGeometry(): GlobeGeo {
  const tri = new THREE.Shape();
  tri.moveTo(-0.085, 0);
  tri.lineTo(0.085, 0);
  tri.lineTo(0, 0.075);
  tri.closePath();
  const gable = new THREE.ExtrudeGeometry(tri, { depth: 0.19, bevelEnabled: false });
  gable.translate(0, 0, -0.095);
  // the thick snow on the roof, in section: rounded at the ridge, a heavy lip over each eave
  const s = new THREE.Shape();
  s.moveTo(-0.118, -0.022);
  s.quadraticCurveTo(-0.128, -0.002, -0.112, 0.012);
  s.lineTo(-0.012, 0.1);
  s.quadraticCurveTo(0, 0.112, 0.012, 0.1);
  s.lineTo(0.112, 0.012);
  s.quadraticCurveTo(0.128, -0.002, 0.118, -0.022);
  s.quadraticCurveTo(0.105, -0.018, 0.098, -0.008);
  s.lineTo(0, 0.084);
  s.lineTo(-0.098, -0.008);
  s.quadraticCurveTo(-0.105, -0.018, -0.118, -0.022);
  const roofSnow = new THREE.ExtrudeGeometry(s, { depth: 0.21, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.008, bevelSegments: 3, curveSegments: 8 });
  roofSnow.translate(0, 0, -0.105);
  return { mound: globeMound(), tier: pineTier(false), tierSnow: pineTier(true), gable, roofSnow };
}

/** A window: pane (lit by day), cross bars, a little snow on the sill. Faces +z. */
function GlobeWindow({ w, h, haunted, ...props }: { w: number; h: number; haunted: boolean } & ThreeElements['group']) {
  return (
    <group {...props}>
      <mesh material={haunted ? GLOBE_WINDOW_DEAD() : M.glow()}>
        <planeGeometry args={[w, h]} />
      </mesh>
      <mesh material={M.ink()} position-z={0.001}>
        <boxGeometry args={[w, 0.003, 0.002]} />
      </mesh>
      <mesh material={M.ink()} position-z={0.001}>
        <boxGeometry args={[0.003, h, 0.002]} />
      </mesh>
      <mesh material={M.snow()} position={[0, -h / 2 - 0.003, 0.004]}>
        <boxGeometry args={[w + 0.008, 0.006, 0.01]} />
      </mesh>
    </group>
  );
}

/** The log cottage: walls with log seams, a gable roof under thick snow, a chimney, lit windows. */
function GlobeCottage({ geo, haunted }: { geo: GlobeGeo; haunted: boolean }) {
  const slope = Math.atan2(0.075, 0.085);
  return (
    <group position={[0.1, GLOBE_FLOOR + 0.058, 0.02]} rotation-y={-0.45}>
      <mesh material={M.woodLight()} position-y={0.055}>
        <boxGeometry args={[0.17, 0.11, 0.19]} />
      </mesh>
      {[0.022, 0.044, 0.066, 0.088].map((y) => (
        <mesh key={y} material={M.wood()} position-y={y}>
          <boxGeometry args={[0.172, 0.004, 0.192]} />
        </mesh>
      ))}
      <mesh geometry={geo.gable} material={M.woodLight()} position-y={0.11} />
      {([-1, 1] as const).map((sd) => (
        <mesh key={sd} material={M.wood()} position={[sd * 0.052, 0.11 + 0.0415, 0]} rotation-z={-sd * slope}>
          <boxGeometry args={[0.134, 0.01, 0.22]} />
        </mesh>
      ))}
      <mesh geometry={geo.roofSnow} material={M.snow()} position-y={0.11} />
      <mesh material={GLOBE_BRICK()} position={[0.045, 0.185, -0.04]}>
        <boxGeometry args={[0.028, 0.07, 0.028]} />
      </mesh>
      <mesh material={M.snow()} position={[0.045, 0.221, -0.04]} scale={[1, 0.45, 1]}>
        <sphereGeometry args={[0.02, 14, 10]} />
      </mesh>
      {/* the gable end: the door with its wreath, a window each side, a round one up top */}
      <mesh material={M.wood()} position={[0, 0.03, 0.0955]}>
        <planeGeometry args={[0.03, 0.06]} />
      </mesh>
      <mesh material={M.green()} position={[0, 0.047, 0.097]}>
        <torusGeometry args={[0.009, 0.0025, 6, 18]} />
      </mesh>
      <mesh material={M.berry()} position={[0, 0.057, 0.098]}>
        <sphereGeometry args={[0.003, 8, 6]} />
      </mesh>
      {[-0.052, 0.052].map((x) => (
        <GlobeWindow key={x} w={0.03} h={0.03} haunted={haunted} position={[x, 0.065, 0.0955]} />
      ))}
      <mesh material={haunted ? GLOBE_WINDOW_DEAD() : M.glow()} position={[0, 0.145, 0.0955]}>
        <circleGeometry args={[0.013, 20]} />
      </mesh>
      {/* the long sides, two windows each */}
      {([-1, 1] as const).flatMap((sd) =>
        [-0.045, 0.045].map((z) => (
          <GlobeWindow key={`${sd}${z}`} w={0.035} h={0.032} haunted={haunted} position={[sd * 0.0855, 0.06, z]} rotation-y={(sd * Math.PI) / 2} />
        )),
      )}
    </group>
  );
}

/** A snow-laden pine: stacked drooping tiers with snow on each; tiny warm bulbs if lit. */
function GlobePine({ geo, haunted, lights, dark, ...props }: { geo: GlobeGeo; haunted: boolean; lights?: boolean; dark?: boolean } & ThreeElements['group']) {
  const tiers = [0, 1, 2, 3, 4].map((k) => ({ r: 0.15 * (1 - k * 0.17), h: 0.11 * (1 - k * 0.08), y: 0.04 + k * 0.07 }));
  return (
    <group {...props}>
      <mesh material={M.wood()} position-y={0.03}>
        <cylinderGeometry args={[0.014, 0.018, 0.06, 10]} />
      </mesh>
      {tiers.map((t) => (
        <group key={t.y} position-y={t.y} scale={[t.r, t.h, t.r]}>
          <mesh geometry={geo.tier} material={dark ? GLOBE_PINE_DARK() : M.green()} />
          <mesh geometry={geo.tierSnow} material={M.snow()} />
        </group>
      ))}
      {lights &&
        tiers.slice(0, 4).flatMap((t, k) =>
          [0, 1, 2, 3, 4, 5, 6].map((j) => {
            const a = (j / 7) * Math.PI * 2 + k * 0.7;
            return (
              <mesh
                key={`${k}-${j}`}
                material={haunted ? GLOBE_BULB_DEAD() : GLOBE_BULB()}
                position={[Math.cos(a) * t.r * 0.9, t.y + 0.012, Math.sin(a) * t.r * 0.9]}
              >
                <sphereGeometry args={[0.0065, 8, 6]} />
              </mesh>
            );
          }),
        )}
    </group>
  );
}

/** Snow globe with the television's snowy house inside; ash instead of snow after the Reveal (Requirement 32.1). */
export function SnowGlobe() {
  const haunted = useHaunted();
  const { taken } = useTaken('snow-globe');
  const geo = useMemo(() => globeGeometry(), []);
  useEffect(() => () => Object.values(geo).forEach((g: THREE.BufferGeometry) => g.dispose()), [geo]);
  const flakes = useMemo(() => {
    const pos = new Float32Array(160 * 3);
    for (let i = 0; i < 160; i++) {
      const a = (i * 2.399) % (Math.PI * 2);
      const r = 0.48 * Math.sqrt((i % 37) / 37);
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = -0.3 + ((i * 0.618) % 1) * 0.8;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  return (
    <group position-y={-0.05}>
      <mesh material={M.wood()} position-y={-0.55}>
        <cylinderGeometry args={[0.5, 0.58, 0.28, 48]} />
      </mesh>
      <mesh material={M.snow()} position-y={-0.38}>
        <cylinderGeometry args={[0.5, 0.5, 0.06, 48]} />
      </mesh>
      <mesh geometry={geo.mound} material={M.snow()} position-y={GLOBE_FLOOR} />
      <GlobeCottage geo={geo} haunted={haunted} />
      <GlobePine geo={geo} haunted={haunted} lights position={[-0.19, GLOBE_FLOOR + 0.05, 0.06]} />
      <GlobePine geo={geo} haunted={haunted} dark position={[0.27, GLOBE_FLOOR + 0.03, -0.24]} scale={0.7} />
      <GlobePine geo={geo} haunted={haunted} dark position={[-0.03, GLOBE_FLOOR + 0.035, -0.3]} scale={0.55} />
      <points geometry={flakes}>
        <pointsMaterial size={0.025} color={haunted ? '#5d5952' : '#ffffff'} />
      </points>
      {taken && <GlobeGhost />}
      <mesh material={M.glass()}>
        <sphereGeometry args={[0.6, 48, 36]} />
      </mesh>
    </group>
  );
}

/** A child's crayon drawing of home (appears only through the haunted search). */
export function ChildsDrawing() {
  const tex = useCanvasTexture(
    512,
    384,
    (g, w, h) => {
      g.fillStyle = '#f4ecd8';
      g.fillRect(0, 0, w, h);
      g.lineWidth = 6;
      g.lineCap = 'round';
      g.strokeStyle = '#c0392b';
      g.strokeRect(w * 0.35, h * 0.35, w * 0.3, h * 0.3);
      g.beginPath();
      g.moveTo(w * 0.32, h * 0.36);
      g.lineTo(w * 0.5, h * 0.18);
      g.lineTo(w * 0.68, h * 0.36);
      g.stroke();
      g.strokeStyle = '#f1c40f';
      g.beginPath();
      g.arc(w * 0.85, h * 0.15, 30, 0, Math.PI * 2);
      g.stroke();
      const colors = ['#2c3e50', '#8e44ad', '#16a085', '#d35400', '#2980b9'];
      colors.forEach((c, i) => {
        const x = w * (0.12 + i * 0.19);
        g.strokeStyle = c;
        g.beginPath();
        g.arc(x, h * 0.72, 12, 0, Math.PI * 2);
        g.moveTo(x, h * 0.75);
        g.lineTo(x, h * 0.9);
        g.moveTo(x - 14, h * 0.8);
        g.lineTo(x + 14, h * 0.8);
        g.stroke();
      });
      g.fillStyle = '#2c3e50';
      g.font = '28px "Comic Sans MS", cursive';
      g.fillText('HOME', w * 0.42, h * 0.98);
    },
    [],
  );
  return (
    <mesh rotation={[-0.2, -0.15, 0.04]}>
      <planeGeometry args={[1.6, 1.2]} />
      <meshStandardMaterial map={tex} roughness={0.95} side={THREE.DoubleSide} />
    </mesh>
  );
}
