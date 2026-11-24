import * as THREE from 'three';
import { seeded } from '../../director/footprints';

/*
 * Geometry for the doll, measured from Tanvir's reference (round 11). The reference doll is
 * 490 px tall; every position here is in units of that height (x across, y up from the floor,
 * z toward the viewer), so x = (px − 265) / 490 and y = (490 − py) / 490 for a point (px, py)
 * on the reference, 265 px being the middle of her face.
 */

/** Her face: 170 px wide on the reference (half 85 / 490), centred at (265, 160). */
export const HEAD = { x: 0, y: 0.673, r: 0.168 };
/** The eyes: at (230, 150) and (300, 150), about 26 px across. */
export const EYE = { x: 0.071, y: 0.694, r: 0.027 };
/** Directions (from the head's centre) of the two eye sockets. */
export const EYE_DIRS = [-1, 1].map((s) => new THREE.Vector3(s * EYE.x, EYE.y - HEAD.y, Math.sqrt(HEAD.r ** 2 - EYE.x ** 2 - (EYE.y - HEAD.y) ** 2)).normalize());

/** A tube along `curve` whose radius changes along it (sleeves, the hat), capped at the end. */
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

/** Her head: a porcelain ball a little longer than wide, full in the cheeks, with two sockets for the glass eyes. */
export function headGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(HEAD.r, 64, 48);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const d = v.clone().normalize();
    // longer than wide, a soft full chin and cheeks, a flatter back under the hair
    let k = 1;
    k *= 1 + 0.05 * Math.max(0, -d.y) * Math.max(0, d.z);
    if (d.y < -0.2 && d.z > 0.2) k *= 1 + 0.04 * (1 - Math.abs(d.x) * 2);
    v.multiplyScalar(k);
    v.y *= 1.07;
    // the sockets: round hollows the eyeballs sit in
    for (const e of EYE_DIRS) {
      const ang = d.angleTo(e);
      if (ang < 0.22) v.multiplyScalar(1 - 0.11 * Math.cos((ang / 0.22) * (Math.PI / 2)) ** 2);
    }
    // a small nose
    const nose = d.angleTo(new THREE.Vector3(0, -0.1, 1).normalize());
    if (nose < 0.12) v.multiplyScalar(1 + 0.045 * Math.cos((nose / 0.12) * (Math.PI / 2)));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** The skirt's radius at height y: a full bell spread out on the floor round her. */
export function skirtRadius(y: number): number {
  // waist at 330 px (y 0.33), hem spread to 430 px across (radius 0.44) at 455 px (y 0.07)
  const t = Math.min(1, Math.max(0, (y - 0.04) / (0.34 - 0.04)));
  // wide at the floor, rounding in to the waist
  return 0.13 + (0.445 - 0.13) * (1 - t) ** 1.6;
}

/**
 * The velvet skirt: a lathe of the bell shape, drawn forward over her knees (she is sitting
 * with her legs out) and a little flattened front to back. Haunted, the hem is ragged.
 */
export function skirtGeometry(haunted: boolean): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 24; i++) {
    const y = 0.34 - (i / 24) * 0.3;
    pts.push(new THREE.Vector2(skirtRadius(y), y));
  }
  pts.push(new THREE.Vector2(skirtRadius(0.04) * 1.01, 0.03));
  const g = new THREE.LatheGeometry(pts, 96);
  const p = g.attributes.position as THREE.BufferAttribute;
  const r = seeded(23);
  const jag = Array.from({ length: 97 }, () => r());
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let y = p.getY(i);
    let z = p.getZ(i);
    const a = Math.atan2(x, z);
    const front = Math.max(0, Math.cos(a));
    // over the knees: the front of the lower skirt comes forward and up a little
    const low = 1 - Math.min(1, Math.max(0, (y - 0.04) / 0.25));
    z = z * 0.86 + front * low * 0.08;
    y += front * low * 0.025 * Math.sin(low * Math.PI);
    // soft folds round the bell
    const fold = Math.sin(a * 9) * 0.008 * low;
    x += Math.sin(a) * fold;
    z += Math.cos(a) * fold;
    if (haunted && y < 0.06) {
      const k = jag[Math.round(((a + Math.PI) / (Math.PI * 2)) * 96)] ?? 0;
      y += k * 0.05;
    }
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * A lace band lying on the skirt from y0 to y1, following its bell (pushed out by `out`). The
 * lace pattern, scallops and holes come from the texture's alpha.
 */
export function laceBand(y0: number, y1: number, out: number): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  // bottom to top, so the texture's lower edge (the scallops) is the band's lower edge
  for (let i = 0; i <= 8; i++) {
    const y = y0 + (i / 8) * (y1 - y0);
    pts.push(new THREE.Vector2(skirtRadius(y) + out, y));
  }
  const g = new THREE.LatheGeometry(pts, 96);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const a = Math.atan2(x, z);
    const front = Math.max(0, Math.cos(a));
    const low = 1 - Math.min(1, Math.max(0, (y - 0.04) / 0.25));
    p.setXYZ(i, x, y + front * low * 0.025 * Math.sin(low * Math.PI), z * 0.86 + front * low * 0.08);
  }
  g.computeVertexNormals();
  return g;
}

/** A furry ring (collar, cuffs, hat brim): a torus roughened into tufts. */
export function furRing(radius: number, tube: number, seed: number): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(radius, tube, 14, 56);
  const p = g.attributes.position as THREE.BufferAttribute;
  const n = (g.attributes.normal as THREE.BufferAttribute).clone();
  const r = seeded(seed);
  for (let i = 0; i < p.count; i++) {
    const k = (r() - 0.35) * tube * 0.35;
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
    v.multiplyScalar(1 + (r() - 0.4) * 0.16);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * One ringlet: a corkscrew curl hanging from `top`, falling `len` and swinging out by `out`,
 * `turns` times round. Haunted, it is frizzed out of shape.
 */
export function ringlet(top: THREE.Vector3, len: number, out: THREE.Vector3, turns: number, coil: number, thick: number, frizz: number, seed: number): THREE.BufferGeometry {
  const r = seeded(seed);
  const pts: THREE.Vector3[] = [];
  const n = 60;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * turns * Math.PI * 2 + seed;
    const c = coil * (0.6 + 0.4 * t);
    const fz = frizz * (r() - 0.5) * 0.02;
    pts.push(
      new THREE.Vector3(
        top.x + out.x * t * t + Math.cos(a) * c + fz,
        top.y - len * t + Math.sin(a * 0.5) * c * 0.2 + fz,
        top.z + out.z * t + Math.sin(a) * c + fz,
      ),
    );
  }
  return sweep(new THREE.CatmullRomCurve3(pts), (t) => thick * (1 - 0.45 * t), 120, 6);
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
