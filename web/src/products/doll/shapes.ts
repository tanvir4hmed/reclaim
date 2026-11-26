import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { seeded } from '../../director/footprints';

/*
 * Geometry for the doll (round 14 reference: three panels, Christmas, Halloween, after the Take).
 * She sits upright on the floor facing you, legs straight out under her skirt, a teddy on her
 * lap. Units: her height is about 1; x across (+x is your right), y up from the floor, z toward
 * you.
 */

/** Her head: a round porcelain baby face. */
export const HEAD = { x: 0, y: 0.673, r: 0.168 };
/** The eyes: large glass eyes either side of the nose. */
export const EYE = { x: 0.072, y: 0.692, r: 0.037 };
/** Directions (from the head's centre) of the two eye sockets: [her right (your left), her left]. */
export const EYE_DIRS = [-1, 1].map((s) => new THREE.Vector3(s * EYE.x, EYE.y - HEAD.y, Math.sqrt(HEAD.r ** 2 - EYE.x ** 2 - (EYE.y - HEAD.y) ** 2)).normalize());
/** Where each eyeball's centre is in the head's frame: set into its socket, its front flush with the face. */
export const EYE_CENTRES = EYE_DIRS.map((d) => {
  const k = HEAD.r - EYE.r * 0.95;
  return new THREE.Vector3(d.x * k, d.y * k * 1.07, d.z * k);
});

/** The painted face's square on the head (head frame, centred on the face): width and height. */
export const FACE = { w: 0.3, h: 0.34 };

/** A tube along `curve` whose radius changes along it (sleeves, the hat, blood). */
export function sweep(curve: THREE.Curve<THREE.Vector3>, radius: (t: number) => number, segs = 48, radial = 18): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(segs, false);
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = curve.getPointAt(t);
    const n = frames.normals[i]!;
    const b = frames.binormals[i]!;
    const r = radius(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      pos.push(p.x + r * (c * n.x + s * b.x), p.y + r * (c * n.y + s * b.y), p.z + r * (c * n.z + s * b.z));
      uv.push(j / radial, t);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** How far out the head's surface is in direction `d` (unit), before the 1.07 stretch in y. */
export function headScale(d: THREE.Vector3): number {
  let k = 1 + 0.05 * Math.max(0, -d.y) * Math.max(0, d.z);
  if (d.y < -0.2 && d.z > 0.2) k *= 1 + 0.04 * (1 - Math.abs(d.x) * 2);
  return k;
}

/** A point on her face in direction `d` (head frame), lifted `lift` off the porcelain. */
export function onHead(d: THREE.Vector3, lift: number): THREE.Vector3 {
  const u = d.clone().normalize();
  const r = HEAD.r * headScale(u) + lift;
  return new THREE.Vector3(u.x * r, u.y * r * 1.07, u.z * r);
}

/** Her head: a porcelain ball a little longer than wide, full in the cheeks, with sockets for the glass eyes. */
export function headGeometry(): THREE.BufferGeometry {
  // the sphere's seam at the back
  const g = new THREE.SphereGeometry(HEAD.r, 72, 54, -Math.PI / 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const noseDir = new THREE.Vector3(0, -0.1, 1).normalize();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const d = v.clone().normalize();
    v.multiplyScalar(headScale(d));
    v.y *= 1.07;
    // the sockets: round hollows the eyeballs sit in
    for (const e of EYE_DIRS) {
      const ang = d.angleTo(e);
      if (ang < 0.27) v.multiplyScalar(1 - 0.12 * Math.cos((ang / 0.27) * (Math.PI / 2)) ** 2);
    }
    // a small button nose
    const nose = d.angleTo(noseDir);
    if (nose < 0.12) v.multiplyScalar(1 + 0.04 * Math.cos((nose / 0.12) * (Math.PI / 2)));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** A cap of a sphere facing +z (half-angle `theta`) with flat, front-on UVs: an iris, a cornea, a hollow. */
export function frontCap(r: number, theta: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, 40, 16, 0, Math.PI * 2, 0, theta);
  g.rotateX(Math.PI / 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const R = r * Math.sin(theta);
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / (2 * R) + 0.5, p.getY(i) / (2 * R) + 0.5);
  return g;
}

/** Upper lashes along the lid's edge (a ring of radius `R` at height `y0`), longer at the outer corner. */
export function lashGeometry(R: number, y0: number, side: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const n = 13;
  for (let i = 0; i < n; i++) {
    const phi = -1.2 + (2.4 * i) / (n - 1);
    const out = new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi));
    const base = out.clone().multiplyScalar(R).setY(y0);
    const L = 0.011 + 0.007 * Math.max(0, Math.sin(phi) * side);
    const curve = new THREE.QuadraticBezierCurve3(
      base,
      base.clone().addScaledVector(out, L * 0.55).add(new THREE.Vector3(0, L * 0.15, 0)),
      base.clone().addScaledVector(out, L * 0.8).add(new THREE.Vector3(0, L * 0.75, 0)),
    );
    parts.push(sweep(curve, (t) => 0.0012 * (1 - 0.7 * t), 6, 4));
  }
  const g = mergeGeometries(parts) ?? new THREE.BufferGeometry();
  parts.forEach((x) => x.dispose());
  return g;
}

/**
 * The skirt's outline from the hem (first) to the waist (last): [distance out from her middle,
 * height]. In front it runs from the waist down onto her lap, along her straight legs and over
 * her shins to the ankles; at the sides and back it is a soft dome spread on the floor.
 */
const SKIRT_FRONT: [number, number][] = [
  [0.47, 0.03],
  [0.485, 0.075],
  [0.45, 0.122],
  [0.36, 0.152],
  [0.24, 0.166],
  [0.15, 0.19],
  [0.112, 0.27],
  [0.09, 0.335],
];
const SKIRT_SIDE: [number, number][] = [
  [0.34, 0.012],
  [0.334, 0.05],
  [0.316, 0.1],
  [0.288, 0.15],
  [0.25, 0.2],
  [0.205, 0.25],
  [0.16, 0.3],
  [0.12, 0.335],
];
const SKIRT_BACK: [number, number][] = [
  [0.3, 0.012],
  [0.292, 0.05],
  [0.275, 0.1],
  [0.25, 0.15],
  [0.215, 0.2],
  [0.175, 0.25],
  [0.135, 0.3],
  [0.09, 0.335],
];
const OUTLINES = [SKIRT_FRONT, SKIRT_SIDE, SKIRT_BACK].map((pts) => new THREE.SplineCurve(pts.map(([r, y]) => new THREE.Vector2(r, y))));

/** How much of the front, side and back outline applies at angle `a` round her (0 = front). */
function outlineWeights(a: number): [number, number, number] {
  const c = Math.cos(a);
  const f = Math.max(0, c) ** 2;
  const b = Math.max(0, -c) ** 2;
  return [f, 1 - f - b, b];
}

/** The skirt's outline at angle `a` and `v` (0 hem .. 1 waist): x is the distance out, y the height. */
export function skirtOutline(a: number, v: number): THREE.Vector2 {
  const w = outlineWeights(a);
  const out = new THREE.Vector2();
  OUTLINES.forEach((c, i) => out.addScaledVector(c.getPoint(v), w[i]!));
  return out;
}

/** The velvet's soft folds round the skirt, deepest at the hem. */
function fold(a: number): number {
  return 0.016 * Math.sin(a * 9 + 1.3 * Math.sin(a * 2)) + 0.006 * Math.sin(a * 17 + 0.7);
}

/** A ring-shaped sheet round the y axis from `rows` rings: [radius, y] per ring at angle a, v 0..1. */
function ringSheet(rows: number, segs: number, at: (a: number, v: number) => THREE.Vector3): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= rows; j++) {
    const v = j / rows;
    for (let i = 0; i <= segs; i++) {
      // the seam at the back
      const a = Math.PI + (i / segs) * Math.PI * 2;
      const p = at(a, v);
      pos.push(p.x, p.y, p.z);
      uv.push(i / segs, v);
    }
  }
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < segs; i++) {
      const a = j * (segs + 1) + i;
      const b = a + segs + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * The red velvet skirt, from the waist down over her lap and legs to the floor, spread round
 * her in deep soft folds; the hem rolls under a little.
 */
export function skirtGeometry(): THREE.BufferGeometry {
  return ringSheet(40, 160, (a, v) => {
    const o = skirtOutline(a, v);
    const low = (1 - v) ** 1.4;
    const r = o.x + fold(a) * low + (v < 0.03 ? -0.012 * (1 - v / 0.03) : 0);
    const y = o.y + 0.006 * Math.cos(a * 9 + 1.3 * Math.sin(a * 2)) * low;
    return new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);
  });
}

/** The cream petticoat under the lace tiers, a ring on the floor just past the hem. */
export function petticoatGeometry(): THREE.BufferGeometry {
  return ringSheet(4, 160, (a, v) => {
    const hem = skirtOutline(a, 0);
    const r = hem.x - 0.03 + 0.1 * (1 - v);
    return new THREE.Vector3(Math.sin(a) * r, 0.003 + 0.01 * v, Math.cos(a) * r);
  });
}

/**
 * One tier of ruffled cream lace showing below the hem: tucked under the skirt at the top, its
 * scalloped free edge `out` past the hem at height `lift`, gathered into `waves` ruffles round
 * (narrower in front, so her boots show). The scallops (the texture's lower edge) are at v 0.
 */
export function ruffleTier(out: number, lift: number, waves: number, amp: number, seed: number): THREE.BufferGeometry {
  return ringSheet(6, 260, (a, v) => {
    const hem = skirtOutline(a, 0);
    const [front] = outlineWeights(a);
    const o = out * (1 - 0.35 * front);
    const ph = a * waves + seed;
    const free = 1 - v;
    const r = hem.x - 0.018 + (o + 0.018) * free + amp * (0.25 + 0.75 * free) * Math.sin(ph) + fold(a) * 0.8;
    const y = Math.max(0.002, lift + (hem.y + 0.016 - lift) * v + amp * 0.5 * free * Math.cos(ph));
    return new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);
  });
}

/**
 * A ruffled lace collar lying over her shoulders and chest, from the neck (rIn, yIn) out to its
 * scalloped edge (rOut, yOut), a little flattened front to back like the bodice.
 */
export function collarGeometry(rIn: number, yIn: number, rOut: number, yOut: number, waves: number, amp: number, seed: number): THREE.BufferGeometry {
  return ringSheet(8, 160, (a, v) => {
    // v 0 at the outer edge (the scallops), 1 at the neck
    const ph = a * waves + seed;
    const free = 1 - v;
    const r = rOut + (rIn - rOut) * v + amp * 0.5 * free * Math.cos(ph);
    const y = yOut + (yIn - yOut) * Math.pow(v, 0.7) + amp * free * Math.sin(ph);
    return new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r * 0.8);
  });
}

/** A lace frill at the end of a sleeve: a flared ruffle round the y axis, the scallops at its open end. */
export function cuffGeometry(): THREE.BufferGeometry {
  return ringSheet(5, 64, (a, v) => {
    // v 0 at the open end, 1 at the wrist
    const free = 1 - v;
    const ph = a * 11;
    const r = 0.038 + 0.026 * free + 0.006 * free * Math.sin(ph);
    const y = 0.036 * free + 0.004 * free * Math.cos(ph);
    return new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);
  });
}

/** A furry ring (the hat's brim): a torus roughened into tufts. */
export function furRing(radius: number, tube: number, seed: number): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(radius, tube, 18, 72);
  const p = g.attributes.position as THREE.BufferAttribute;
  const n = (g.attributes.normal as THREE.BufferAttribute).clone();
  const r = seeded(seed);
  for (let i = 0; i < p.count; i++) {
    const k = (r() - 0.35) * tube * 0.4;
    p.setXYZ(i, p.getX(i) + n.getX(i) * k, p.getY(i) + n.getY(i) * k, p.getZ(i) + n.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}

/** A fluffy ball (the pom-pom): a sphere roughened into tufts. */
export function furBall(radius: number, seed: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(radius, 4);
  const p = g.attributes.position as THREE.BufferAttribute;
  const r = seeded(seed);
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(1 + (r() - 0.4) * 0.18);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * One ringlet: a corkscrew curl hanging from `top`, falling `len` and swinging out by `out`,
 * `turns` times round.
 */
export function ringlet(top: THREE.Vector3, len: number, out: THREE.Vector3, turns: number, coil: number, thick: number, seed: number): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  const n = Math.ceil(turns * 20);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * turns * Math.PI * 2 + seed;
    // the coil opens out from a tight start under the hat to a loose spring at the end
    const c = coil * Math.min(1, 0.35 + t * 2.2) * (1 - 0.15 * t);
    // the spiral is a little tighter near the top (the weight of the curl stretches it lower down)
    const y = top.y - len * (0.75 * t + 0.25 * t * t);
    pts.push(new THREE.Vector3(top.x + out.x * t * t + Math.cos(a) * c, y, top.z + out.z * t + Math.sin(a) * c));
  }
  return sweep(new THREE.CatmullRomCurve3(pts), (t) => thick * (1 - 0.35 * t) * Math.min(1, (1 - t) * 18 + 0.2), n * 2, 6);
}

/** Frizz: thin wild strands standing out of the hair from `roots` (head frame), merged into one. */
export function frizzGeometry(roots: THREE.Vector3[], seed: number): THREE.BufferGeometry {
  const r = seeded(seed);
  const parts = roots.map((root) => {
    const out = root.clone().setY(root.y * 0.4).normalize();
    const len = 0.05 + r() * 0.11;
    const pts: THREE.Vector3[] = [root.clone()];
    const p = root.clone();
    for (let k = 1; k <= 6; k++) {
      p.addScaledVector(out, len / 6).add(new THREE.Vector3((r() - 0.5) * 0.02, (r() - 0.6) * 0.016, (r() - 0.5) * 0.02));
      pts.push(p.clone());
    }
    return sweep(new THREE.CatmullRomCurve3(pts), (t) => (0.0022 + r() * 0.0004) * (1 - 0.6 * t), 18, 4);
  });
  const g = mergeGeometries(parts) ?? new THREE.BufferGeometry();
  parts.forEach((x) => x.dispose());
  return g;
}

/** A holly leaf: an oval with spiky points along both sides. */
export function hollyLeaf(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const L = 0.06;
  s.moveTo(0, 0);
  const spikes = 4;
  for (let i = 1; i <= spikes; i++) {
    const t = i / spikes;
    const w = Math.sin(t * Math.PI) * 0.018 + 0.003;
    s.quadraticCurveTo(-w * 0.7, L * (t - 0.12), -w - 0.004, L * t - 0.006);
  }
  s.lineTo(0, L + 0.004);
  for (let i = spikes; i >= 1; i--) {
    const t = i / spikes;
    const w = Math.sin(t * Math.PI) * 0.018 + 0.003;
    s.lineTo(w + 0.004, L * t - 0.006);
    s.quadraticCurveTo(w * 0.7, L * (t - 0.12), 0.0, L * (t - 1 / spikes) + 0.001);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.002, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: 1 });
  g.computeVertexNormals();
  return g;
}

/** A small white snowflake ornament: six arms, each with two little branches, in the xy plane. */
export function snowflakeGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const arm = (len: number, r: number, a: number, at: THREE.Vector3) => {
    const g = new THREE.CapsuleGeometry(r, len, 2, 6);
    g.translate(0, len / 2, 0);
    g.rotateZ(a);
    g.translate(at.x, at.y, at.z);
    parts.push(g);
  };
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    arm(0.019, 0.0018, a, new THREE.Vector3());
    for (const k of [0.45, 0.72]) {
      const at = new THREE.Vector3(-Math.sin(a) * 0.019 * k, Math.cos(a) * 0.019 * k, 0);
      arm(0.006 * (1.2 - k), 0.0013, a + 0.8, at);
      arm(0.006 * (1.2 - k), 0.0013, a - 0.8, at);
    }
  }
  parts.push(new THREE.SphereGeometry(0.0035, 10, 8));
  const g = mergeGeometries(parts) ?? new THREE.BufferGeometry();
  parts.forEach((x) => x.dispose());
  return g;
}

/** A boot's sole seen from the front (toes up): narrow heel at the bottom, broad round toe at the top. */
export function soleGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.024, 0, 0.028, 0.03, 0.03, 0.055);
  s.bezierCurveTo(0.034, 0.085, 0.045, 0.1, 0.044, 0.122);
  s.bezierCurveTo(0.042, 0.15, 0.022, 0.158, 0, 0.158);
  s.bezierCurveTo(-0.022, 0.158, -0.042, 0.15, -0.044, 0.122);
  s.bezierCurveTo(-0.045, 0.1, -0.034, 0.085, -0.03, 0.055);
  s.bezierCurveTo(-0.028, 0.03, -0.024, 0, 0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 16 });
  g.computeVertexNormals();
  return g;
}
