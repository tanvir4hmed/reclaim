import * as THREE from 'three';

/*
 * The size of a product's main body, so every product can be shown at the same size, in the
 * same place, on its card and in its product view. Invisible meshes (the room a Take grows into)
 * and parts marked `userData.extra` (a watch chain, the smoke) do not count. In the product view
 * (`withFrame`) an invisible box marked `userData.frame` does count, from the start: the view is
 * framed once for the object and its Take together, so it never has to zoom when the Take plays.
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
export function bodyBounds(root: THREE.Object3D, out: THREE.Box3, withFrame = false): THREE.Box3 {
  out.makeEmpty();
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry || !m.visible) return;
    const framing = withFrame && m.userData.frame === true;
    if (!drawn(m) && !framing) return;
    if (!framing && isExtra(m, root)) return;
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
