import * as THREE from 'three';

/*
 * The size of a product's main body, so every product can be shown at the same size, in the
 * same place, on its card and in its product view. Invisible bounds boxes (meshes whose material
 * is not drawn: the room a Take grows into) and parts marked `userData.extra` (a watch chain, the
 * smoke) do not count, unless `withReserved` asks for the boxes too (after a Take).
 */

const part = new THREE.Box3();

function isExtra(o: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p && p !== root; p = p.parent) if (p.userData.extra === true) return true;
  return false;
}

function drawn(m: THREE.Mesh): boolean {
  const mat = m.material;
  return Array.isArray(mat) ? mat.some((x) => x.visible) : mat.visible;
}

/** The world-space bounds of what counts as the object under `root`. */
export function bodyBounds(root: THREE.Object3D, out: THREE.Box3, withReserved = false): THREE.Box3 {
  out.makeEmpty();
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    if (!o.visible) return;
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    if (!withReserved && !drawn(m)) return;
    if (isExtra(m, root)) return;
    // hidden by an ancestor?
    for (let p: THREE.Object3D | null = m.parent; p && p !== root.parent; p = p.parent) if (!p.visible) return;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const b = m.geometry.boundingBox;
    if (!b || b.isEmpty()) return;
    part.copy(b).applyMatrix4(m.matrixWorld);
    out.union(part);
  });
  return out;
}
