import * as THREE from 'three';

/*
 * The size of a product's main body, so every product can be shown at the same size, in the
 * same place, on its card and in its product view. Invisible meshes (the room a Take grows into)
 * and parts marked `userData.extra` (a watch chain, the smoke) do not count. In the product view
 * (`withFrame`) an invisible box marked `userData.frame` does count, from the start: the view is
 * framed once for the object and its Take together, so it never has to zoom when the Take plays.
 */

const part = new THREE.Box3();
const toLocal = new THREE.Matrix4();
const m4 = new THREE.Matrix4();

function isExtra(o: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p && p !== root; p = p.parent) if (p.userData.extra === true) return true;
  return false;
}

function drawn(m: THREE.Mesh): boolean {
  const mat = m.material;
  return Array.isArray(mat) ? mat.some((x) => x.visible) : mat.visible;
}

/** The bounds of what counts as the object under `root`, in `root`'s own space. */
export function bodyBounds(root: THREE.Object3D, out: THREE.Box3, withFrame = false): THREE.Box3 {
  out.makeEmpty();
  root.updateWorldMatrix(true, true);
  toLocal.copy(root.matrixWorld).invert();
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
    part.copy(b).applyMatrix4(m4.multiplyMatrices(toLocal, m.matrixWorld));
    out.union(part);
  });
  return out;
}

/*
 * The measure is taken while the product is still whole and remembered (on this device), so that
 * after its Take (a head rolled off, a pool of blood, a lifted receiver) it is shown at exactly the
 * size it had: on the card, and every time its product view is opened again.
 */
const KEY = 'reclaim:fit';
type Saved = Record<string, [number, number, number, number, number, number]>;
let saved: Saved | null = null;

function load(): Saved {
  if (saved) return saved;
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    saved = v && typeof v === 'object' ? (v as Saved) : {};
  } catch {
    saved = {};
  }
  return saved;
}

/** The remembered bounds for `key`, if any. */
export function recalled(key: string, out: THREE.Box3): boolean {
  const v = load()[key];
  if (!v || v.length !== 6 || !v.every(Number.isFinite)) return false;
  out.min.set(v[0], v[1], v[2]);
  out.max.set(v[3], v[4], v[5]);
  return true;
}

/** Remember the bounds for `key` (measured while the product was whole). */
export function remember(key: string, b: THREE.Box3): void {
  if (b.isEmpty()) return;
  const all = load();
  all[key] = [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z];
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage blocked: remembered for this page only */
  }
}

/**
 * The bounds to fit to: measured now while the product is whole (and remembered), or, once it
 * has been taken, the ones remembered from before, so its size never changes after the Take.
 */
export function fitBounds(root: THREE.Object3D, out: THREE.Box3, key: string, taken: boolean, withFrame = false): THREE.Box3 {
  if (taken && recalled(key, out)) return out;
  bodyBounds(root, out, withFrame);
  if (!taken) remember(key, out);
  return out;
}
