import * as THREE from 'three';

/**
 * Surface detail made in code (no photos): small canvas textures for colour variation,
 * bump and roughness, per kind of material. They are what makes a shape read as wood,
 * leather or cloth instead of plastic. Generated once, shared by every material of a kind.
 */
export type SurfaceKind = 'wood' | 'leather' | 'fabric' | 'knit' | 'fur' | 'paper' | 'metal' | 'ceramic' | 'cake' | 'wax';

export interface SurfaceMaps {
  map: THREE.Texture;
  bumpMap: THREE.Texture;
  roughnessMap: THREE.Texture;
  bumpScale: number;
  repeat: number;
}

const SIZE = 256;

/** Seeded value noise with smooth interpolation, tileable at `period`. */
function makeNoise(seed: number, period: number) {
  const g = new Float32Array(period * period);
  let a = seed >>> 0;
  for (let i = 0; i < g.length; i++) {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    g[i] = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const at = (x: number, y: number) => g[(((y % period) + period) % period) * period + (((x % period) + period) % period)] ?? 0;
  return (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a0 = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * u;
    const a1 = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * u;
    return a0 + (a1 - a0) * v;
  };
}

/** Fractal noise on a tile: `f` is the base frequency in cells across the texture. */
function fbm(n: (x: number, y: number) => number, x: number, y: number, f: number, oct = 4) {
  let s = 0;
  let amp = 0.5;
  let freq = f;
  for (let o = 0; o < oct; o++) {
    s += amp * n((x * freq) / SIZE, (y * freq) / SIZE);
    amp *= 0.5;
    freq *= 2;
  }
  return s;
}

interface Sample {
  /** brightness multiplier for the colour (around 1) */
  c: number;
  /** height 0..1 */
  h: number;
  /** roughness multiplier 0..1 */
  r: number;
}

function sampler(kind: SurfaceKind): (x: number, y: number) => Sample {
  const n1 = makeNoise(kind.length * 7919 + 1, 64);
  const n2 = makeNoise(kind.length * 104729 + 3, 128);
  switch (kind) {
    case 'wood':
      return (x, y) => {
        // Long grain: rings stretched along y, warped by low-frequency noise.
        const warp = fbm(n1, x, y * 0.15, 4) * 18;
        const ring = 0.5 + 0.5 * Math.sin((x + warp) * 0.42);
        const fine = fbm(n2, x * 3, y * 0.3, 16, 2);
        const line = Math.pow(ring, 6);
        return { c: 0.82 + 0.22 * ring - 0.18 * line + 0.06 * fine, h: 0.5 + 0.3 * ring - 0.2 * line, r: 0.75 + 0.25 * fine };
      };
    case 'leather':
      return (x, y) => {
        const pebble = fbm(n1, x, y, 32, 3);
        const crease = Math.abs(fbm(n2, x, y, 6, 3) - 0.5) < 0.02 ? 1 : 0;
        return { c: 0.9 + 0.16 * pebble - 0.25 * crease, h: pebble - 0.4 * crease, r: 0.7 + 0.4 * pebble };
      };
    case 'fabric':
      return (x, y) => {
        // Plain weave: alternating warp and weft threads plus slub noise.
        const wx = 0.5 + 0.5 * Math.sin(x * 1.6);
        const wy = 0.5 + 0.5 * Math.sin(y * 1.6);
        const over = (Math.floor(x / 3.9) + Math.floor(y / 3.9)) % 2 === 0 ? wx : wy;
        const slub = fbm(n1, x, y, 20, 2);
        return { c: 0.86 + 0.14 * over + 0.06 * slub, h: over * 0.7 + slub * 0.3, r: 0.85 + 0.15 * slub };
      };
    case 'knit':
      return (x, y) => {
        // Rows of V stitches.
        const row = Math.floor(y / 10);
        const vx = ((x + (row % 2) * 5) % 10) / 10;
        const v = 1 - Math.abs(Math.abs(vx - 0.5) * 2 - (y % 10) / 10);
        const fuzz = fbm(n2, x, y, 48, 2);
        return { c: 0.78 + 0.22 * v + 0.05 * fuzz, h: v * 0.8 + fuzz * 0.2, r: 0.95 };
      };
    case 'fur':
      return (x, y) => {
        const strand = fbm(n2, x * 4, y * 0.6, 24, 3);
        const clump = fbm(n1, x, y, 8, 2);
        return { c: 0.75 + 0.3 * strand * clump + 0.1, h: strand, r: 1 };
      };
    case 'paper':
      return (x, y) => {
        const fiber = fbm(n2, x, y * 2, 40, 3);
        const blotch = fbm(n1, x, y, 4, 3);
        return { c: 0.94 + 0.08 * blotch - 0.04 * fiber, h: fiber, r: 0.9 + 0.1 * fiber };
      };
    case 'metal': {
      // Fine scratches: random short lines in roughness, plus fingerprint smudges.
      const scratches = new Float32Array(SIZE * SIZE);
      let s = 12345;
      const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
      for (let i = 0; i < 380; i++) {
        let px = rnd() * SIZE;
        let py = rnd() * SIZE;
        const ang = rnd() * Math.PI;
        const len = 8 + rnd() * 50;
        for (let k = 0; k < len; k++) {
          px += Math.cos(ang);
          py += Math.sin(ang);
          const idx = ((Math.floor(py) + SIZE) % SIZE) * SIZE + ((Math.floor(px) + SIZE) % SIZE);
          scratches[idx] = 1;
        }
      }
      return (x, y) => {
        const smudge = fbm(n1, x, y, 5, 3);
        const sc = scratches[y * SIZE + x] ?? 0;
        return { c: 0.94 + 0.08 * smudge - 0.05 * sc, h: 0.5 - 0.3 * sc, r: 0.55 + 0.5 * smudge + 0.5 * sc };
      };
    }
    case 'ceramic':
      return (x, y) => {
        const s = fbm(n1, x, y, 6, 3);
        return { c: 0.97 + 0.05 * s, h: 0.5 + 0.08 * fbm(n2, x, y, 64, 2), r: 0.6 + 0.6 * s };
      };
    case 'cake':
      return (x, y) => {
        const crumb = fbm(n2, x, y, 36, 3);
        const lump = fbm(n1, x, y, 8, 3);
        return { c: 0.9 + 0.12 * lump - 0.05 * crumb, h: lump * 0.6 + crumb * 0.4, r: 0.9 };
      };
    case 'wax':
      return (x, y) => {
        const drip = fbm(n1, x * 0.3, y, 10, 3);
        return { c: 0.95 + 0.07 * drip, h: drip, r: 0.75 + 0.3 * drip };
      };
  }
}

const BUMP: Record<SurfaceKind, number> = {
  wood: 0.6, leather: 1.2, fabric: 1.4, knit: 2.4, fur: 2.2, paper: 0.5,
  metal: 0.15, ceramic: 0.1, cake: 1.6, wax: 0.6,
};
const REPEAT: Record<SurfaceKind, number> = {
  wood: 1.5, leather: 3, fabric: 6, knit: 5, fur: 4, paper: 2, metal: 2, ceramic: 2, cake: 2, wax: 1.5,
};

function tex(data: Uint8ClampedArray<ArrayBuffer>, srgb: boolean, repeat: number): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d');
  if (g) g.putImageData(new ImageData(data, SIZE, SIZE), 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const cache = new Map<SurfaceKind, SurfaceMaps>();

export function surfaceMaps(kind: SurfaceKind): SurfaceMaps | null {
  if (typeof document === 'undefined') return null;
  const hit = cache.get(kind);
  if (hit) return hit;
  const f = sampler(kind);
  const col = new Uint8ClampedArray(new ArrayBuffer(SIZE * SIZE * 4));
  const hgt = new Uint8ClampedArray(new ArrayBuffer(SIZE * SIZE * 4));
  const rgh = new Uint8ClampedArray(new ArrayBuffer(SIZE * SIZE * 4));
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const s = f(x, y);
      const i = (y * SIZE + x) * 4;
      const c = Math.max(0, Math.min(255, s.c * 235));
      const h = Math.max(0, Math.min(255, s.h * 255));
      const r = Math.max(0, Math.min(255, s.r * 255));
      col[i] = col[i + 1] = col[i + 2] = c;
      hgt[i] = hgt[i + 1] = hgt[i + 2] = h;
      rgh[i] = rgh[i + 1] = rgh[i + 2] = r;
      col[i + 3] = hgt[i + 3] = rgh[i + 3] = 255;
    }
  }
  const repeat = REPEAT[kind];
  const maps: SurfaceMaps = {
    map: tex(col, true, repeat),
    bumpMap: tex(hgt, false, repeat),
    roughnessMap: tex(rgh, false, repeat),
    bumpScale: BUMP[kind],
    repeat,
  };
  cache.set(kind, maps);
  return maps;
}
