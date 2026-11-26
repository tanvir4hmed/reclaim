import { useThree } from '@react-three/fiber';
import type { ReactNode, Ref } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { seeded } from '../../director/footprints';
import { mat, type MatParams } from '../../gl/decay';
import { useHaunted } from '../../store';
import { sweep } from '../doll/shapes';

/*
 * The teddy bear itself: a vintage jointed mohair bear, shared by the shop's teddy (the one that
 * is cut through the throat when taken) and the bear on the porcelain doll's lap, so both are the
 * same bear. Honey caramel mohair with fine directional pile, a short protruding muzzle in
 * lighter clipped fur, a nose stitched in dark brown thread (a rounded triangle of vertical
 * stitches) above a stitched mouth (an inverted Y), small black glass bead eyes set close to the
 * muzzle, round cupped ears lined with felt, a separate head, torso, curved arms and legs, felt
 * pads on the paws and feet, and a red velvet bow at the neck. After the Reveal the same bear,
 * worn: the pile matted, greyer and dirty, darned crosses of dark thread along its seams, a tuft
 * of stuffing poking out of a split side seam, the bow faded.
 *
 * Units are the shop teddy's: it sits on the floor at TEDDY_FLOOR and its head is a separate
 * part above the cut at TEDDY_NECK_Y (TeddyHead is drawn in the head's own frame, origin at the
 * cut), so the shop teddy can take its head off.
 */

/** Height of the cut through the throat: the torso ends here, the head starts here. */
export const TEDDY_NECK_Y = 0.11;
/** Where the bear sits. */
export const TEDDY_FLOOR = -0.79;
/** The space the head takes up when it is on, in the body's frame (for framing without it). */
export const TEDDY_HEAD_BOX: { centre: [number, number, number]; size: [number, number, number] } = { centre: [0, 0.39, 0.04], size: [0.66, 0.57, 0.6] };

// ---------------------------------------------------------------------------------------------
// The mohair: fine strands painted into a canvas, used as colour and bump
// ---------------------------------------------------------------------------------------------

const FUR = 512;

/** Draw `f` at every tiling offset that could touch the canvas, so the pile repeats seamlessly. */
function wrapped(x: number, y: number, m: number, f: (ox: number, oy: number) => void) {
  for (const ox of [-FUR, 0, FUR])
    for (const oy of [-FUR, 0, FUR]) {
      if (x + ox < -m || x + ox > FUR + m || y + oy < -m || y + oy > FUR + m) continue;
      f(ox, oy);
    }
}

/**
 * The pile, in warm greys (the material's colour tints it): soft clumps, then thousands of fine
 * strands combed one way (down the limbs, from the crown), lighter at the tips, darker where the
 * pile parts. Worn: shorter, matted strands twisted every way, grime and rubbed bald patches.
 */
function paintFur(g: CanvasRenderingContext2D, worn: boolean) {
  const r = seeded(worn ? 71 : 70);
  const base: [number, number, number] = worn ? [200, 186, 168] : [214, 206, 194];
  g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
  g.fillRect(0, 0, FUR, FUR);
  // clumps: lighter crowns and darker partings the strands lie in
  for (let i = 0; i < 90; i++) {
    const x = r() * FUR;
    const y = r() * FUR;
    const rad = 18 + r() * 46;
    const dark = r() < 0.55;
    const a = dark ? 0.1 + r() * 0.12 : 0.06 + r() * 0.08;
    const c = dark ? '70,44,22' : '255,246,226';
    wrapped(x, y, rad, (ox, oy) => {
      const grd = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
      grd.addColorStop(0, `rgba(${c},${a})`);
      grd.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = grd;
      g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
    });
  }
  g.lineCap = 'round';
  const n = worn ? 7500 : 10000;
  for (let i = 0; i < n; i++) {
    const x = r() * FUR;
    const y = r() * FUR;
    // the combing direction: mostly along v, swirling gently (periodic, so it tiles)
    const flow = Math.PI / 2 + 0.26 * Math.sin((x / FUR) * Math.PI * 4) + 0.2 * Math.sin((y / FUR) * Math.PI * 6 + 1.3);
    const matted = Math.sin((x / FUR) * Math.PI * 10) * Math.cos((y / FUR) * Math.PI * 8);
    const ang = worn ? flow + matted * 1.4 + (r() - 0.5) * 0.7 : flow + (r() - 0.5) * 0.32;
    const len = worn ? 5 + r() * 8 : 8 + r() * 13;
    const l = 0.6 + r() * 0.58;
    const dx = Math.cos(ang) * len;
    const dy = Math.sin(ang) * len;
    const bend = (r() - 0.5) * len * 0.45;
    const col = `rgba(${Math.min(255, base[0] * l) | 0},${Math.min(255, base[1] * l * 0.985) | 0},${Math.min(255, base[2] * l * 0.96) | 0},${0.5 + r() * 0.4})`;
    const wd = 0.7 + r() * (worn ? 1.6 : 1.0);
    wrapped(x, y, len, (ox, oy) => {
      g.strokeStyle = col;
      g.lineWidth = wd;
      g.beginPath();
      g.moveTo(x + ox, y + oy);
      g.quadraticCurveTo(x + ox + dx * 0.5 - (dy / len) * bend, y + oy + dy * 0.5 + (dx / len) * bend, x + ox + dx, y + oy + dy);
      g.stroke();
    });
  }
  if (!worn) return;
  // grime worked into it, and patches rubbed thin and flat
  for (let i = 0; i < 34; i++) {
    const x = r() * FUR;
    const y = r() * FUR;
    const rad = 12 + r() * 44;
    const bald = i < 8;
    const c = bald ? '176,150,120' : '62,40,22';
    const a = bald ? 0.38 : 0.12 + r() * 0.16;
    wrapped(x, y, rad, (ox, oy) => {
      const grd = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
      grd.addColorStop(0, `rgba(${c},${a})`);
      grd.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = grd;
      g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
    });
  }
}

const furCanvases = new Map<boolean, HTMLCanvasElement>();
const furTextures = new Map<string, THREE.Texture>();

function furCanvas(worn: boolean): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  let c = furCanvases.get(worn);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = FUR;
    const g = c.getContext('2d');
    if (g) paintFur(g, worn);
    furCanvases.set(worn, c);
  }
  return c;
}

/** The pile as a texture repeated `rep` times round (half as many along): colour or bump. */
function furTexture(worn: boolean, rep: number, colour: boolean): THREE.Texture | null {
  const key = `${worn}:${rep}:${colour}`;
  const hit = furTextures.get(key);
  if (hit) return hit;
  const c = furCanvas(worn);
  if (!c) return null;
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep, rep / 2);
  t.anisotropy = 4;
  if (colour) t.colorSpace = THREE.SRGBColorSpace;
  furTextures.set(key, t);
  return t;
}

/** A shared decaying material with the painted pile on it (set once, outside any component). */
function furred(key: string, p: MatParams, worn: boolean, rep: number, bump: number): THREE.MeshPhysicalMaterial {
  const m = mat(key, p);
  if (!m.map) {
    const map = furTexture(worn, rep, true);
    const b = furTexture(worn, rep, false);
    if (map && b) {
      m.map = map;
      m.bumpMap = b;
      m.bumpScale = bump;
      m.sheenRoughness = 0.45;
      m.needsUpdate = true;
    }
  }
  return m;
}

/** The bear's materials; `w` (worn) after the Reveal. */
/*
 * Colours: honey caramel mohair by day. Worn (after the Reveal) it stays caramel, only darker,
 * dirtier and flatter: the decay shader's greying (age) and grey dust are kept very low here,
 * because they are what used to turn the bear grey-beige and its red bow pink.
 */
const T = {
  fur: (w: boolean) =>
    w
      ? furred('teddyFurWorn14', { color: '#a5703f', roughness: 1, sheen: 0.45, sheenColor: '#b07a44', decay: { age: 0.06, dust: 0.08 } }, true, 4, 2)
      : furred('teddyFur14', { color: '#dc9a52', roughness: 0.9, sheen: 0.9, sheenColor: '#ffc98a', decay: { age: 0.06, dust: 0.08 } }, false, 4, 1.6),
  /** The muzzle: the same mohair clipped short, a shade lighter. */
  muzzle: (w: boolean) =>
    w
      ? furred('teddyMuzzleWorn14', { color: '#bf8f5c', roughness: 1, sheen: 0.4, sheenColor: '#c89a68', decay: { age: 0.06, dust: 0.08 } }, true, 7, 0.8)
      : furred('teddyMuzzle14', { color: '#f2c58c', roughness: 0.92, sheen: 0.8, sheenColor: '#ffe2b8', decay: { age: 0.06, dust: 0.08 } }, false, 7, 0.7),
  felt: (w: boolean) =>
    w
      ? furred('teddyFeltWorn14', { color: '#b0895e', roughness: 1, sheen: 0.3, sheenColor: '#b89470', decay: { age: 0.06, dust: 0.1 } }, true, 10, 0.7)
      : furred('teddyFelt14', { color: '#efcc9a', roughness: 0.95, sheen: 0.6, sheenColor: '#fff0d4', decay: { age: 0.06, dust: 0.1 } }, false, 10, 0.6),
  /** Felt seen from inside a cupped ear. */
  feltIn: (w: boolean) =>
    w
      ? furred('teddyFeltInWorn14', { color: '#a7825a', roughness: 1, side: THREE.BackSide, decay: { age: 0.06, dust: 0.1 } }, true, 10, 0.5)
      : furred('teddyFeltIn14', { color: '#e9c290', roughness: 0.95, sheen: 0.5, sheenColor: '#fff0d4', side: THREE.BackSide, decay: { age: 0.06, dust: 0.1 } }, false, 10, 0.5),
  thread: () => mat('teddyThread14', { color: '#2e1a10', roughness: 0.75, sheen: 0.5, sheenColor: '#6a4632', decay: { age: 0.05, dust: 0.05 } }),
  eye: () => mat('teddyEye', { color: '#050404', roughness: 0.05, clearcoat: 1, decay: { age: 0.1, dust: 0.15 } }),
  bow: () =>
    mat('teddyBow14', { surface: 'fabric', color: '#8c0c18', roughness: 0.7, sheen: 0.8, sheenColor: '#b8202c', decay: { age: 0.08, dust: 0.06 } }),
  stuffing: () => mat('teddyStuffing', { color: '#eee8dc', roughness: 1, sheen: 0.6, sheenColor: '#ffffff', hauntedColor: '#d2c8b4', decay: { age: 0.2, dust: 0.2 } }),
};

// ---------------------------------------------------------------------------------------------
// The pile in 3D: shells of strands standing off the skin
// ---------------------------------------------------------------------------------------------

/**
 * Where the shells are drawn: the torso (none above the ribbon), the head (none over the glass
 * eyes), or a limb (everywhere).
 */
type ShellKind = 'torso' | 'head' | 'limb';

const SHELL_COMMON = /* glsl */ `
uniform float uShell;
uniform float uLayer;
uniform float uDensity;
uniform float uLean;
uniform float uClearY;
uniform vec4 uClearA;
uniform vec4 uClearB;
varying vec3 vFurP;
float tfHash(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
`;

/**
 * One shell: the skin pushed out along its normal by `uShell` (and drooping a little), drawn
 * only where a strand passes. Strands sit on a jittered 3D grid in the part's own frame (so
 * they stay put on the skin when it moves), thick at the root and tapering to the tips; each
 * strand a little lighter or darker than its neighbours. Shells are opaque (cut out), so they
 * need no sorting.
 */
function shellMaterial(color: THREE.Color, shell: number, layer: number, density: number, lean: number, kind: ShellKind, clears: THREE.Vector4[]): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.88 });
  const u = {
    uShell: { value: shell },
    uLayer: { value: layer },
    uDensity: { value: density },
    uLean: { value: lean },
    uClearY: { value: kind === 'torso' ? 0.0 : 99 },
    uClearA: { value: clears[0] ?? new THREE.Vector4(0, 0, 0, -1) },
    uClearB: { value: clears[1] ?? new THREE.Vector4(0, 0, 0, -1) },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${SHELL_COMMON}`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vFurP = position;
        transformed += normalize(objectNormal) * uShell + vec3(0.0, -uLean * uShell, 0.0);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${SHELL_COMMON}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        if (vFurP.y > uClearY) discard;
        if (distance(vFurP, uClearA.xyz) < uClearA.w || distance(vFurP, uClearB.xyz) < uClearB.w) discard;
        vec3 fp = vFurP * uDensity;
        float best = 9.0;
        float tone = 0.5;
        for (int g = 0; g < 2; g++) {
          vec3 q = fp + float(g) * vec3(0.5, 0.37, 0.61);
          vec3 cell = floor(q);
          float h1 = tfHash(cell + float(g) * 11.0);
          vec3 jit = vec3(tfHash(cell + 1.7), tfHash(cell + 3.1), tfHash(cell + 5.3)) - 0.5;
          float d = length(fract(q) - 0.5 - jit * 0.3);
          // strands of different lengths: the short ones stop at lower shells
          float len = 0.55 + 0.45 * h1;
          float rad = uLayer > len ? 0.0 : (0.46 - 0.34 * uLayer / len) * (0.8 + 0.3 * h1);
          if (d < rad && d / rad < best) { best = d / rad; tone = tfHash(cell + 7.9); }
        }
        if (best > 1.0) discard;
        diffuseColor.rgb *= 0.78 + 0.44 * tone;`,
      );
  };
  m.customProgramCacheKey = () => 'teddy-shell';
  return m;
}

/** Layers of pile: [layers, length, strands per unit, droop] by day and worn (shorter, matted into clumps). */
const PILE = { day: { n: 7, len: 0.03, density: 70, lean: 0.35 }, worn: { n: 5, len: 0.02, density: 46, lean: 0.9 } };
/** Pile colours, root to tip: dark in the creases, lighter at the tips. */
const PILE_COLOURS = { day: ['#7a4620', '#f3b46a'], worn: ['#4c2e15', '#b98550'] };

const shellCache = new Map<string, THREE.MeshStandardMaterial[]>();

/** The shells for one kind of part (made once, shared by every bear). */
function shells(worn: boolean, kind: ShellKind): THREE.MeshStandardMaterial[] {
  const key = `${worn}:${kind}`;
  const hit = shellCache.get(key);
  if (hit) return hit;
  const p = worn ? PILE.worn : PILE.day;
  const [c0, c1] = worn ? PILE_COLOURS.worn : PILE_COLOURS.day;
  const root = new THREE.Color(c0);
  const tip = new THREE.Color(c1);
  const clears = kind === 'head' ? bear().eyes.map((e) => new THREE.Vector4(e.at.x - HEAD_C.x, e.at.y - HEAD_C.y, e.at.z - HEAD_C.z, 0.05)) : [];
  const list = Array.from({ length: p.n }, (_, i) => {
    const k = (i + 1) / p.n;
    return shellMaterial(root.clone().lerp(tip, Math.pow(k, 0.7)), p.len * k, k, p.density, p.lean, kind, clears);
  });
  shellCache.set(key, list);
  return list;
}

/**
 * A furred part: the skin (with any decals as `children`) and its shells of pile. The shells are
 * drawn only in the product view (the large picture): on the small shop cards the painted pile
 * reads the same, and the shop's canvas (every card at once, on slow machines) stays fast.
 */
function Furred({ geometry, material, kind, worn, children }: { geometry: THREE.BufferGeometry; material: THREE.Material; kind: ShellKind; worn: boolean; children?: ReactNode }) {
  const large = useThree((s) => s.gl.domElement.closest('.inspection-canvas') !== null);
  return (
    <>
      <mesh geometry={geometry} material={material}>
        {children}
      </mesh>
      {large && shells(worn, kind).map((m, i) => (
        <mesh key={i} geometry={geometry} material={m} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Shapes (built once and shared by every view of the bear)
// ---------------------------------------------------------------------------------------------

const ray = new THREE.Raycaster();
const probe = new THREE.Mesh(undefined, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));

/** Where a ray from `from` toward `to` meets `geo` (its own frame), and the surface normal there. */
function hit(geo: THREE.BufferGeometry, from: THREE.Vector3, to: THREE.Vector3): { p: THREE.Vector3; n: THREE.Vector3 } | null {
  probe.geometry = geo;
  probe.updateMatrixWorld();
  ray.set(from, to.clone().sub(from).normalize());
  const h = ray.intersectObject(probe, false)[0];
  if (!h || !h.face) return null;
  return { p: h.point.clone(), n: h.face.normal.clone() };
}

/** A plump tube along `pts`, its ends rounded off into half-balls (arms, legs). */
function limb(pts: THREE.Vector3[], radius: (t: number) => number): THREE.BufferGeometry {
  const c = new THREE.CatmullRomCurve3(pts);
  const L = c.getLength();
  const e0 = radius(0) / L;
  const e1 = radius(1) / L;
  return sweep(
    c,
    (t) => {
      let k = 1;
      if (t < e0) k = Math.sqrt(Math.max(0, 1 - ((e0 - t) / e0) ** 2));
      else if (t > 1 - e1) k = Math.sqrt(Math.max(0, 1 - ((t - (1 - e1)) / e1) ** 2));
      return radius(t) * Math.max(k, 0.03);
    },
    56,
    22,
  );
}

/**
 * The torso: a pear, narrow at the shoulders and full in the belly, a little deeper in front, the
 * hump of an old jointed bear at the back of the shoulders, cut flat at the throat.
 */
function torsoGeometry(): THREE.BufferGeometry {
  const ctrl: [number, number][] = [
    [0.001, -0.705],
    [0.16, -0.695],
    [0.27, -0.648],
    [0.335, -0.565],
    [0.36, -0.455],
    [0.356, -0.345],
    [0.33, -0.235],
    [0.29, -0.125],
    [0.24, -0.035],
    [0.19, 0.045],
    [0.158, 0.095],
    [0.15, 0.11],
  ];
  const pts = new THREE.SplineCurve(ctrl.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(44);
  pts.push(new THREE.Vector2(0.075, TEDDY_NECK_Y), new THREE.Vector2(0.001, TEDDY_NECK_Y));
  // the lathe's seam at the back
  const g = new THREE.LatheGeometry(pts, 72, Math.PI);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    let z = p.getZ(i);
    const rad = Math.hypot(x, z) || 1;
    const front = Math.max(0, z / rad);
    const back = Math.max(0, -z / rad);
    const k = Math.min(1, Math.max(0, (y + 0.2) / 0.25));
    z *= 0.86 + 0.14 * k * k * (3 - 2 * k);
    z += 0.035 * front * Math.exp(-(((y + 0.42) / 0.17) ** 2));
    z -= 0.032 * back * Math.exp(-(((y + 0.03) / 0.12) ** 2));
    p.setZ(i, z);
  }
  g.computeVertexNormals();
  return g;
}

/** The arm, from the shoulder joint (its origin): hanging, curving forward, the paw turned in. */
function armGeometry(s: number): { geo: THREE.BufferGeometry; pad: { at: THREE.Vector3; q: THREE.Quaternion } } {
  const pts = [
    new THREE.Vector3(0, 0.03, -0.01),
    new THREE.Vector3(s * 0.055, -0.08, 0.03),
    new THREE.Vector3(s * 0.085, -0.22, 0.11),
    new THREE.Vector3(s * 0.07, -0.34, 0.19),
    new THREE.Vector3(s * 0.035, -0.41, 0.235),
  ];
  const R1 = 0.1;
  const geo = limb(pts, (t) => 0.092 - 0.017 * Math.sin(Math.PI * t) + 0.008 * t);
  // the felt pad on the inside of the paw's tip
  const c = new THREE.CatmullRomCurve3(pts);
  const end = c.getPointAt(1);
  const tan = c.getTangentAt(1);
  const ctr = end.clone().addScaledVector(tan, -R1);
  const dir = tan.clone().multiplyScalar(0.7).add(new THREE.Vector3(-s * 0.55, -0.2, 0.25)).normalize();
  return { geo, pad: { at: ctr.addScaledVector(dir, R1 - 0.012), q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir) } };
}

/** A leg, from the hip forward to the foot (the foot is its own ball). */
function legGeometry(s: number): THREE.BufferGeometry {
  return limb(
    [new THREE.Vector3(s * 0.14, -0.55, -0.03), new THREE.Vector3(s * 0.2, -0.62, 0.08), new THREE.Vector3(s * 0.24, -0.645, 0.2)],
    (t) => 0.138 - 0.01 * t,
  );
}

/** The feet: [x, y, z, turn out]; each a fat oval with its felt pad facing you. */
const FEET: [number, number, number, number][] = [
  [-0.25, -0.64, 0.235, -0.14],
  [0.25, -0.64, 0.235, 0.14],
];

/** The head: a ball, broad and full in the cheeks, a little narrower at the crown. */
function headGeometry(): THREE.BufferGeometry {
  // the sphere's seam at the back
  const g = new THREE.SphereGeometry(0.275, 56, 40, -Math.PI / 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const d = v.clone().normalize();
    v.x *= 1.1 - 0.07 * d.y + 0.04 * Math.max(0, d.z) * Math.max(0, -d.y);
    v.y *= 0.95;
    v.z *= 0.92 - 0.03 * Math.max(0, d.z) ** 3;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** The head's centre above the cut. */
const HEAD_C = new THREE.Vector3(0, 0.285, 0);
/** The muzzle: an ellipsoid on the lower face [centre, radii], standing well out of it. */
const MZ = { c: new THREE.Vector3(0, 0.19, 0.205), a: 0.125, b: 0.095, d: 0.13 };

/** A point on the muzzle at (x, y), lifted `lift` off it along its normal. */
function onMuzzle(x: number, y: number, lift: number): THREE.Vector3 {
  const u = x / MZ.a;
  const w = (y - MZ.c.y) / MZ.b;
  const q = Math.sqrt(Math.max(0, 1 - u * u - w * w));
  const n = new THREE.Vector3(u / MZ.a, w / MZ.b, q / MZ.d).normalize();
  return new THREE.Vector3(x, y, MZ.c.z + MZ.d * q).addScaledVector(n, lift);
}

function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts) ?? parts[0] ?? new THREE.BufferGeometry();
  parts.forEach((x) => x !== g && x.dispose());
  return g;
}

/** The nose: a rounded triangle of vertical satin stitches in dark thread, drawn in at the point. */
function noseGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const top = 0.252;
  const apex = 0.198;
  const half = 0.052;
  const n = 13;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1) - 0.5) * 2 * half;
    const ax = Math.abs(x) / half;
    const yT = top - 0.013 * ax ** 2.2;
    const yB = apex + (top - 0.018 - apex) * ax ** 1.1;
    if (yT - yB < 0.006) continue;
    const pts = [0, 0.25, 0.5, 0.75, 1].map((k) => onMuzzle(x * (1 - 0.22 * k * k), yT + (yB - yT) * k, 0.0035));
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.0055, 6, false));
  }
  return merged(parts);
}

/** The mouth: a stitched inverted Y under the nose. */
function mouthGeometry(): THREE.BufferGeometry {
  const line = (pts: [number, number][]) =>
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y]) => onMuzzle(x, y, 0.0025))), 12, 0.0034, 6, false);
  return merged([
    line([
      [0, 0.2],
      [0, 0.178],
      [0, 0.156],
    ]),
    line([
      [0, 0.157],
      [-0.02, 0.146],
      [-0.04, 0.141],
      [-0.054, 0.145],
    ]),
    line([
      [0, 0.157],
      [0.02, 0.146],
      [0.04, 0.141],
      [0.054, 0.145],
    ]),
  ]);
}

const EAR_R = 0.098;
/** A cupped ear: a deep shell, the open side forward (pole at the back). */
function earGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(EAR_R, 30, 14, 0, Math.PI * 2, 0, 1.85);
  g.rotateX(-Math.PI / 2);
  g.scale(1, 0.96, 0.55);
  return g;
}
const EAR_RIM = { r: EAR_R * Math.sin(1.85), z: -EAR_R * Math.cos(1.85) * 0.55 };
/** The ears on the top corners of the head: [x, y, z]; tilted out and turned a little outward. */
const EARS: [number, number, number][] = [
  [-0.228, 0.468, -0.035],
  [0.228, 0.468, -0.035],
];

/** A darned cross of thread, lying on a surface at `p` with normal `n`. */
interface Mark {
  p: THREE.Vector3;
  q: THREE.Quaternion;
  s: number;
}
const Z = new THREE.Vector3(0, 0, 1);
function mark(h: { p: THREE.Vector3; n: THREE.Vector3 } | null, s: number, lift = 0.008): Mark[] {
  if (!h) return [];
  return [{ p: h.p.addScaledVector(h.n, lift), q: new THREE.Quaternion().setFromUnitVectors(Z, h.n), s }];
}

interface Geos {
  torso: THREE.BufferGeometry;
  legs: THREE.BufferGeometry[];
  arms: ReturnType<typeof armGeometry>[];
  head: THREE.BufferGeometry;
  foot: THREE.BufferGeometry;
  nose: THREE.BufferGeometry;
  mouth: THREE.BufferGeometry;
  ear: THREE.BufferGeometry;
  band: THREE.BufferGeometry;
  loops: THREE.BufferGeometry[];
  tails: THREE.BufferGeometry[];
  eyes: { at: THREE.Vector3; n: THREE.Vector3 }[];
  /** Worn: darned crosses on the torso, on the head (head frame) and on the left arm (arm frame). */
  darns: { torso: Mark[]; head: Mark[]; arm: Mark[] };
  /** Worn: where the side seam has split and the stuffing pokes out. */
  split: Mark | null;
  /** Spots for blood: on the torso, and on the head (head frame). */
  stains: { torso: Mark[]; head: Mark[] };
}

let geos: Geos | null = null;

/** Everything is built once and kept: the same bear is drawn in many views. */
function bear(): Geos {
  if (geos) return geos;
  const torso = torsoGeometry();
  const head = headGeometry();
  // the head in its own frame (it sits at HEAD_C above the cut), for finding points on it
  const headAt = head.clone().translate(HEAD_C.x, HEAD_C.y, HEAD_C.z);
  const eyes = [-1, 1].map((s) => {
    const h = hit(headAt, new THREE.Vector3(s * 0.094, 0.312, 1), new THREE.Vector3(s * 0.094, 0.312, 0));
    const p = h?.p ?? new THREE.Vector3(s * 0.094, 0.312, 0.23);
    const n = h?.n ?? new THREE.Vector3(0, 0, 1);
    return { at: p.addScaledVector(n, -0.009), n };
  });
  // the bow's ribbon round the neck, and the bow at the front
  // a wide velvet ribbon lying on the fur round the neck
  const band = new THREE.LatheGeometry(
    [
      [0.2, 0.008],
      [0.226, 0.012],
      [0.232, 0.026],
      [0.222, 0.048],
      [0.206, 0.068],
      [0.19, 0.08],
      [0.17, 0.082],
    ].map(([r, y]) => new THREE.Vector2(r!, y!)),
    64,
  );
  // the bow's loops: wide flattened tubes of velvet, plump at the ends
  const loops = [-1, 1].map((s) => {
    const c = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(s * 0.06, 0.05, 0.012),
        new THREE.Vector3(s * 0.13, 0.05, 0.004),
        new THREE.Vector3(s * 0.152, 0.002, 0),
        new THREE.Vector3(s * 0.12, -0.04, 0.006),
        new THREE.Vector3(s * 0.05, -0.028, 0.014),
      ],
      true,
    );
    const g = sweep(c, (t) => 0.017 + 0.009 * Math.sin(Math.PI * t), 60, 12);
    g.scale(1, 1, 0.5);
    return g;
  });
  const tails = [-1, 1].map((s) => {
    const g = sweep(
      new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(s * 0.03, -0.06, 0.016), new THREE.Vector3(s * 0.06, -0.13, 0.01), new THREE.Vector3(s * 0.075, -0.155, 0.004)]),
      (t) => 0.015 + 0.006 * t,
      24,
      10,
    );
    g.scale(1, 1, 0.42);
    return g;
  });
  const arms = [-1, 1].map((s) => armGeometry(s));
  const leftArm = arms[0]!.geo;
  const r = seeded(17);
  geos = {
    torso,
    legs: [-1, 1].map((s) => legGeometry(s)),
    arms,
    head,
    foot: new THREE.SphereGeometry(1, 32, 24).scale(0.13, 0.158, 0.122),
    nose: noseGeometry(),
    mouth: mouthGeometry(),
    ear: earGeometry(),
    band,
    loops,
    tails,
    eyes,
    darns: {
      // up the left side seam of the body
      torso: [-0.14, -0.2, -0.26, -0.32].flatMap((y, i) =>
        mark(hit(torso, new THREE.Vector3(-1, y, 0.45), new THREE.Vector3(0, y, 0)), 0.03 + (i % 2) * 0.006),
      ),
      // up the gusset seam over the brow
      head: [0.4, 0.44, 0.48].flatMap((y) => mark(hit(headAt, new THREE.Vector3(0.02, y + 0.3, 1), new THREE.Vector3(0.02, y - 0.05, 0)), 0.028)),
      // round the left shoulder joint
      arm: [-0.05, -0.1].flatMap((y) => mark(hit(leftArm, new THREE.Vector3(-0.6, y, 0.4), new THREE.Vector3(-0.05, y, 0.03)), 0.026)),
    },
    split: mark(hit(torso, new THREE.Vector3(1, -0.38, 0.4), new THREE.Vector3(0, -0.38, 0.02)), 1, 0)[0] ?? null,
    stains: {
      torso: Array.from({ length: 7 }, () => {
        const x = (r() - 0.5) * 0.4;
        const y = -0.05 - r() * 0.45;
        return mark(hit(torso, new THREE.Vector3(x, y, 1), new THREE.Vector3(x * 0.6, y, 0)), 0.025 + r() * 0.035, 0.012);
      }).flat(),
      head: [
        [0.06, 0.13, 0.02],
        [-0.12, 0.2, 0.028],
        [0.15, 0.33, 0.02],
      ].flatMap(([x, y, s]) => mark(hit(headAt, new THREE.Vector3(x!, y!, 1), new THREE.Vector3(x! * 0.5, y!, 0)), s!, 0.012)),
    },
  };
  headAt.dispose();
  return geos;
}

// ---------------------------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------------------------

/** Darned crosses of dark thread. */
function Darns({ marks }: { marks: Mark[] }) {
  return (
    <>
      {marks.map((m, i) => (
        <group key={i} position={m.p} quaternion={m.q}>
          {[Math.PI / 4, -Math.PI / 4].map((a) => (
            <mesh key={a} material={T.thread()} rotation-z={a}>
              <capsuleGeometry args={[0.0034, m.s, 3, 6]} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

/** Stuffing poking out of a split seam: a dark gap, and lumps of grubby wadding through it. */
function Split({ at }: { at: Mark }) {
  const lumps: [number, number, number, number][] = [
    [0, 0.02, 0.012, 0.026],
    [0.008, -0.012, 0.016, 0.022],
    [-0.006, -0.04, 0.01, 0.018],
    [0.004, 0.048, 0.006, 0.016],
    [-0.01, 0.004, 0.022, 0.016],
  ];
  return (
    <group position={at.p} quaternion={at.q}>
      <mesh material={T.thread()} scale={[0.014, 0.07, 0.008]}>
        <sphereGeometry args={[1, 12, 10]} />
      </mesh>
      {lumps.map(([x, y, z, r], i) => (
        <mesh key={i} material={T.stuffing()} position={[x, y, z]}>
          <icosahedronGeometry args={[r, 1]} />
        </mesh>
      ))}
    </group>
  );
}

/** The red velvet ribbon round the neck, tied in a bow at the front. */
function Bow() {
  const g = bear();
  return (
    <group>
      <mesh geometry={g.band} material={T.bow()} />
      <group position={[0, 0.042, 0.232]} rotation-x={-0.12}>
        {g.loops.map((l, i) => (
          <mesh key={i} geometry={l} material={T.bow()} />
        ))}
        {g.tails.map((l, i) => (
          <mesh key={i} geometry={l} material={T.bow()} position={[0, -0.012, 0.006]} />
        ))}
        <mesh material={T.bow()} scale={[1, 0.9, 0.62]}>
          <sphereGeometry args={[0.03, 18, 14]} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * The body below the cut: torso, legs and feet with their felt pads, and the bow. `children` go
 * inside the torso mesh (a decal painted onto the fur).
 */
export function TeddyTorso({ children }: { children?: ReactNode }) {
  const worn = useHaunted();
  const g = bear();
  const fur = T.fur(worn);
  return (
    <group>
      <Furred geometry={g.torso} material={fur} kind="torso" worn={worn}>
        {children}
      </Furred>
      {g.legs.map((l, i) => (
        <Furred key={i} geometry={l} material={fur} kind="limb" worn={worn} />
      ))}
      {FEET.map(([x, y, z, turn], i) => (
        <group key={i} position={[x, y, z]} rotation={[-0.14, turn, 0]}>
          <Furred geometry={g.foot} material={fur} kind="limb" worn={worn} />
          {/* the big oval felt pad, standing a little proud of the pile */}
          <mesh material={T.felt(worn)} position-z={0.104} scale={[0.09, 0.122, 0.036]}>
            <sphereGeometry args={[1, 28, 16]} />
          </mesh>
        </group>
      ))}
      <Bow />
      {worn && <Darns marks={g.darns.torso} />}
      {worn && g.split && <Split at={g.split} />}
    </group>
  );
}

/** Where each arm's shoulder joint is on the body. */
const SHOULDERS: [number, number, number][] = [
  [-0.25, -0.03, 0.02],
  [0.25, -0.03, 0.02],
];

/** One arm (`side` -1 its right, on your left), pivoting at the shoulder joint. */
export function TeddyArm({ side, ref }: { side: number; ref?: Ref<THREE.Group> }) {
  const worn = useHaunted();
  const g = bear();
  const i = side < 0 ? 0 : 1;
  const a = g.arms[i]!;
  return (
    <group ref={ref} position={SHOULDERS[i]}>
      <Furred geometry={a.geo} material={T.fur(worn)} kind="limb" worn={worn} />
      <mesh material={T.felt(worn)} position={a.pad.at} quaternion={a.pad.q} scale={[0.064, 0.08, 0.026]}>
        <sphereGeometry args={[1, 24, 14]} />
      </mesh>
      {worn && i === 0 && <Darns marks={g.darns.arm} />}
    </group>
  );
}

/** The head, in its own frame with the origin at the cut: neck, head, muzzle, nose, mouth, eyes, ears. */
export function TeddyHead() {
  const worn = useHaunted();
  const g = bear();
  const fur = T.fur(worn);
  return (
    <group>
      {/* the top of the neck, down to the cut */}
      <mesh material={fur} position-y={0.035}>
        <cylinderGeometry args={[0.145, 0.15, 0.07, 32]} />
      </mesh>
      <group position={HEAD_C}>
        <Furred geometry={g.head} material={fur} kind="head" worn={worn} />
      </group>
      <mesh material={T.muzzle(worn)} position={MZ.c} scale={[MZ.a, MZ.b, MZ.d]}>
        <sphereGeometry args={[1, 40, 30, -Math.PI / 2]} />
      </mesh>
      <mesh geometry={g.nose} material={T.thread()} />
      <mesh geometry={g.mouth} material={T.thread()} />
      {g.eyes.map((e, i) => (
        <group key={i} position={e.at}>
          <mesh material={T.eye()}>
            <sphereGeometry args={[0.026, 24, 18]} />
          </mesh>
          {/* the window caught in the glass */}
          <mesh position={[-0.008, 0.01, 0.022]}>
            <sphereGeometry args={[0.0048, 10, 8]} />
            <meshBasicMaterial color={worn ? '#9a9890' : '#ffffff'} />
          </mesh>
        </group>
      ))}
      {EARS.map(([x, y, z], i) => {
        const s = i ? 1 : -1;
        return (
          <group key={i} position={[x, y, z]} rotation={[0.1, s * 0.35, -s * 0.4]}>
            <Furred geometry={g.ear} material={fur} kind="limb" worn={worn} />
            <mesh geometry={g.ear} material={T.feltIn(worn)} scale={0.94} />
            <mesh material={fur} position-z={EAR_RIM.z} scale={[1, 0.96, 1]}>
              <torusGeometry args={[EAR_RIM.r, 0.016, 10, 36]} />
            </mesh>
          </group>
        );
      })}
      {worn && <Darns marks={g.darns.head} />}
    </group>
  );
}

/** Blood soaked into the fur at the given spots. */
function Stains({ marks, material }: { marks: Mark[]; material: THREE.Material }) {
  return (
    <>
      {marks.map((m, i) => (
        <mesh key={i} position={m.p} quaternion={m.q} material={material} scale={[1, 0.8 + (i % 3) * 0.3, 1]}>
          <circleGeometry args={[m.s, 14]} />
        </mesh>
      ))}
    </>
  );
}

/**
 * The whole bear, sitting, at rest (the doll's lap). `stain`: if given, blood spots in that
 * material across its chest and face (the caller fades it in).
 */
export function TeddyFigure({ stain }: { stain?: THREE.Material }) {
  const g = bear();
  return (
    <group>
      <TeddyTorso />
      <TeddyArm side={-1} />
      <TeddyArm side={1} />
      <group position-y={TEDDY_NECK_Y}>
        <TeddyHead />
        {stain && <Stains marks={g.stains.head} material={stain} />}
      </group>
      {stain && <Stains marks={g.stains.torso} material={stain} />}
    </group>
  );
}
