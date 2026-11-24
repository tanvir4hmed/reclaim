import * as THREE from 'three';

/** A coil spring along a helix, standing up from y = 0 to y = `len`. */
export function springGeometry(turns: number, r: number, len: number, wire = r * 0.12): THREE.TubeGeometry {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= turns * 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, (i / (turns * 16)) * len, Math.sin(a) * r));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 16, wire, 6, false);
}

/** A skull on a spring keeps bobbing: a hard boing as it pops out, then a slow uneasy bounce for good. */
export function boing(t: number, phase = 0): number {
  if (t === Infinity) t = performance.now() / 1000 + phase;
  return Math.sin(t * 7 + phase) * (0.12 + 0.6 * Math.exp(-t * 1.4));
}
