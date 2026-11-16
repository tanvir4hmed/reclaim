import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

/** Outside the hook so the React compiler rules see no mutation of a hook value. */
function markDirty(t: THREE.Texture) {
  t.needsUpdate = true;
}

/**
 * A texture painted in code with the 2D canvas API (labels, photos, reflections, paper).
 * `draw` runs again whenever `deps` change; the texture is shared by the meshes using it.
 */
export function useCanvasTexture(
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
  deps: readonly unknown[],
): THREE.CanvasTexture {
  const invalidate = useThree((s) => s.invalidate);
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [w, h]);
  useEffect(() => {
    const c = tex.image as HTMLCanvasElement;
    const g = c.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, w, h);
    draw(g, w, h);
    markDirty(tex);
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tex, invalidate, ...deps]);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

/** The family group used by the photo frame, the hero photo and the mirror (Req 19). */
export function drawGroup(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: { haunted: boolean; middleGone: boolean; spread: number; lean: number; edgeGap: boolean },
) {
  g.fillStyle = opts.haunted ? '#2b2721' : '#efe2c9';
  g.fillRect(0, 0, w, h);
  const grad = g.createRadialGradient(w / 2, h * 0.3, 10, w / 2, h / 2, w * 0.7);
  grad.addColorStop(0, opts.haunted ? 'rgba(120,110,90,0.25)' : 'rgba(255,240,210,0.6)');
  grad.addColorStop(1, 'rgba(0,0,0,0.25)');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  const people = 5;
  for (let i = 0; i < people; i++) {
    if (opts.middleGone && i === 2) continue;
    if (opts.edgeGap && i === 4) continue;
    const side = i < 2 ? -1 : i > 2 ? 1 : 0;
    const x = w * (0.14 + i * 0.18) + side * opts.spread * w * 0.05 - side * opts.lean * w * 0.02;
    const tall = i === 2 ? 1 : i % 2 ? 0.84 : 0.93;
    const top = h * (1 - 0.82 * tall);
    g.save();
    g.translate(x, h);
    g.rotate(-side * opts.lean * 0.08);
    g.translate(-x, -h);
    g.fillStyle = opts.haunted ? '#4f483e' : i % 2 ? '#9b1b24' : '#3c5a3a';
    g.beginPath();
    g.moveTo(x - w * 0.075, h);
    g.quadraticCurveTo(x - w * 0.085, top + h * 0.2, x, top + h * 0.16);
    g.quadraticCurveTo(x + w * 0.085, top + h * 0.2, x + w * 0.075, h);
    g.fill();
    g.fillStyle = opts.haunted ? '#6b6356' : '#c08a6a';
    g.beginPath();
    g.arc(x, top + h * 0.09, w * 0.045, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  if (opts.haunted) {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 60; i++) g.fillRect((i * 97) % w, (i * 53) % h, 2, 1);
  }
}
