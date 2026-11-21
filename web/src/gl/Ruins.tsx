import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

/** Small seeded generator so the skyline is the same on every visit (and in screenshots). */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * One row of bombed-out buildings as a single extruded silhouette: flat roofs broken into
 * jagged stumps, a few collapsed to rubble, with window holes punched through so the sky
 * shows behind them. Built once from a seed.
 */
function skyline(seed: number, left: number, right: number, minH: number, maxH: number, windows: boolean): THREE.ExtrudeGeometry {
  const rnd = seeded(seed);
  const shape = new THREE.Shape();
  shape.moveTo(left, 0);
  let x = left;
  const holes: THREE.Path[] = [];
  while (x < right) {
    const w = 0.35 + rnd() * 0.7;
    const ruined = rnd() < 0.45;
    // The street rises out of the dark from the left, so the skyline never sits behind the hero copy.
    const ramp = Math.min(1, 0.25 + (x - left) / 3);
    const h = ramp * (ruined ? minH + rnd() * (maxH - minH) * 0.5 : minH + rnd() * (maxH - minH));
    const x2 = Math.min(right, x + w);
    shape.lineTo(x, h);
    if (ruined) {
      // A broken top: three or four jagged teeth where floors fell in.
      const teeth = 3 + Math.floor(rnd() * 2);
      for (let i = 1; i <= teeth; i++) {
        const tx = x + ((x2 - x) * i) / (teeth + 1);
        shape.lineTo(tx, h - rnd() * h * 0.45);
        shape.lineTo(tx + (x2 - x) * 0.08, h - rnd() * h * 0.15);
      }
    } else if (rnd() < 0.3) {
      // A spire or a water tower stub.
      const mid = (x + x2) / 2;
      shape.lineTo(mid - 0.05, h);
      shape.lineTo(mid, h + 0.25 + rnd() * 0.3);
      shape.lineTo(mid + 0.05, h);
    }
    shape.lineTo(x2, h * (ruined ? 0.6 + rnd() * 0.3 : 1));
    if (windows && h > 0.6) {
      // Empty window frames: rows of small rectangles, some missing where the wall is gone.
      const cols = Math.max(1, Math.floor((x2 - x) / 0.16));
      const rows = Math.floor((h * 0.8) / 0.2);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (rnd() < 0.35) continue;
          const wx = x + 0.06 + c * 0.16;
          const wy = 0.12 + r * 0.2;
          if (wx + 0.07 > x2 - 0.04 || wy + 0.1 > h * 0.55) continue;
          const hole = new THREE.Path();
          hole.moveTo(wx, wy);
          hole.lineTo(wx + 0.07, wy);
          hole.lineTo(wx + 0.07, wy + 0.1);
          hole.lineTo(wx, wy + 0.1);
          hole.lineTo(wx, wy);
          holes.push(hole);
        }
      }
    }
    x = x2;
  }
  shape.lineTo(right, 0);
  shape.lineTo(left, 0);
  shape.holes = holes;
  return new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false });
}

/** A soft radial sprite for the moon halo and the fire glow (code-drawn, no image files). */
function glowTexture(inner: string, outer: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, inner);
    grd.addColorStop(1, outer);
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * The haunted hero's backdrop: the same street the shop stood on, after the war. A cold moon
 * behind smoke, two rows of ruined buildings, and a low orange glow where something still
 * burns. It sits far behind the still life and only exists after the Reveal.
 */
export function Ruins({ wide }: { wide: boolean }) {
  // The canvas draws over the DOM, so the street starts right of the hero copy (left ~third of
  // the banner) and runs off the right edge. On a phone the copy sits above, so it can span.
  const far = useMemo(() => skyline(11, wide ? -3.6 : -8, 14, 0.5, 1.6, false), [wide]);
  const near = useMemo(() => skyline(29, wide ? -3.2 : -7, 12, 0.4, 2.3, true), [wide]);
  useEffect(
    () => () => {
      far.dispose();
      near.dispose();
    },
    [far, near],
  );
  const halo = useMemo(() => glowTexture('rgba(190,205,235,0.55)', 'rgba(190,205,235,0)'), []);
  const fire = useMemo(() => glowTexture('rgba(255,120,40,0.5)', 'rgba(255,90,20,0)'), []);
  useEffect(
    () => () => {
      halo.dispose();
      fire.dispose();
    },
    [halo, fire],
  );
  return (
    <group position={[wide ? 0.8 : 0, wide ? -1.25 : -2.6, -6]}>
      {/* moon and its halo */}
      <mesh position={[wide ? 3.8 : 1.2, 3.1, -3]}>
        <circleGeometry args={[0.42, 48]} />
        <meshBasicMaterial color="#d9dfe8" toneMapped={false} />
      </mesh>
      <sprite position={[wide ? 3.8 : 1.2, 3.1, -3.1]} scale={3.2}>
        <spriteMaterial map={halo} transparent depthWrite={false} toneMapped={false} />
      </sprite>
      {/* far row: hazy blue, low */}
      <mesh geometry={far} position={[0, 0, -2]} scale={[1, 1.1, 1]}>
        <meshBasicMaterial color="#1c2536" />
      </mesh>
      {/* A fire still burning behind the near row (on the right, away from the hero copy). */}
      <sprite position={[wide ? 1.4 : 0.6, 0.35, -1.2]} scale={[5, 1.8, 1]}>
        <spriteMaterial map={fire} transparent depthWrite={false} toneMapped={false} />
      </sprite>
      {/* near row: almost black, with the sky through its windows */}
      <mesh geometry={near} position={[0, 0, -0.5]}>
        <meshStandardMaterial color="#0b0e14" roughness={1} metalness={0} />
      </mesh>
    </group>
  );
}
