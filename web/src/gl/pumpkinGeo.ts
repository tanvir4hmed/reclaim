import * as THREE from 'three';

/** Body height: the pumpkin is an ellipsoid pushed in along eight grooves. */
export const RY = 0.78;

/** Ribbed, squashed pumpkin body. */
export function pumpkinGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 96, 64);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x);
    const ribs = 1 - 0.07 * Math.pow(Math.abs(Math.cos(a * 4)), 0.6);
    const lumpy = 1 + 0.015 * Math.sin(a * 13 + v.y * 5);
    const dip = 1 - 0.18 * Math.pow(Math.abs(v.y), 6);
    v.x *= ribs * lumpy * dip;
    v.z *= ribs * lumpy * dip;
    v.y *= RY;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function tri(a: [number, number], b: [number, number], c: [number, number]): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(...a);
  s.lineTo(...b);
  s.lineTo(...c);
  s.closePath();
  return s;
}

/** Carved face (two eyes, nose, a jagged grin), wrapped onto the front of the body. */
export function faceGeometry(lift: number): THREE.BufferGeometry {
  const mouth = new THREE.Shape();
  mouth.moveTo(-0.46, -0.2);
  mouth.quadraticCurveTo(0, -0.34, 0.46, -0.2);
  const teeth: [number, number][] = [[0.36, -0.36], [0.26, -0.3], [0.2, -0.44], [0.08, -0.38], [-0.02, -0.5], [-0.12, -0.38], [-0.22, -0.46], [-0.3, -0.32], [-0.4, -0.36]];
  for (const t of teeth) mouth.lineTo(...t);
  mouth.closePath();
  const shapes = [tri([-0.41, -0.02], [-0.07, -0.02], [-0.18, 0.2]), tri([0.07, -0.02], [0.41, -0.02], [0.18, 0.2]), tri([-0.06, -0.14], [0.06, -0.14], [0, -0.04]), mouth];
  const g = new THREE.ShapeGeometry(shapes, 8);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i) + lift;
    // Sit just outside the ribs' outer radius (1.0), so no bulge of the rind covers the carving.
    const zz = 1 - x ** 2 - (y / RY) ** 2;
    p.setXYZ(i, x, y, Math.sqrt(Math.max(0, zz)) + 0.015);
  }
  g.computeVertexNormals();
  return g;
}
