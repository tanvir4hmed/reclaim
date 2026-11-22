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

/**
 * The witch: the shop's last resident, as she appears in the letter's photo and in the middle of
 * the family portrait. Tall and too thin, black hair hanging over a grey face, black eyes, a mouth
 * open too wide. `cx` is her centre, `base` the bottom edge, `tall` her height in pixels.
 */
export function drawWitch(g: CanvasRenderingContext2D, cx: number, base: number, tall: number) {
  const u = tall / 100;
  const top = base - tall;
  g.save();
  // gown, narrow shoulders, arms hanging to the knees
  g.fillStyle = '#0b0909';
  g.beginPath();
  g.moveTo(cx - 9 * u, top + 26 * u);
  g.quadraticCurveTo(cx - 13 * u, top + 60 * u, cx - 18 * u, base);
  g.lineTo(cx + 18 * u, base);
  g.quadraticCurveTo(cx + 13 * u, top + 60 * u, cx + 9 * u, top + 26 * u);
  g.closePath();
  g.fill();
  g.strokeStyle = '#8f887c';
  g.lineWidth = 1.4 * u;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + s * 13 * u, top + 70 * u);
    g.lineTo(cx + s * 13.5 * u, top + 76 * u);
    g.stroke();
  }
  // face
  const fx = cx;
  const fy = top + 14 * u;
  const face = g.createRadialGradient(fx, fy - 2 * u, 1, fx, fy, 9 * u);
  face.addColorStop(0, '#d6d0c4');
  face.addColorStop(1, '#5c574e');
  g.fillStyle = face;
  g.beginPath();
  g.ellipse(fx, fy, 6.5 * u, 9 * u, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#030202';
  g.beginPath();
  g.ellipse(fx - 2.6 * u, fy - 1.5 * u, 1.6 * u, 2.2 * u, 0, 0, Math.PI * 2);
  g.ellipse(fx + 2.6 * u, fy - 1.5 * u, 1.6 * u, 2.2 * u, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(fx, fy + 5 * u, 1.5 * u, 3 * u, 0, 0, Math.PI * 2);
  g.fill();
  // hair: a black curtain from the crown, over the shoulders and down the chest
  g.fillStyle = '#030202';
  g.beginPath();
  g.moveTo(fx, top + 3 * u);
  g.bezierCurveTo(fx - 10 * u, top + 3 * u, fx - 9 * u, top + 30 * u, fx - 11 * u, top + 52 * u);
  g.lineTo(fx - 6 * u, top + 50 * u);
  g.bezierCurveTo(fx - 6 * u, top + 30 * u, fx - 5 * u, top + 12 * u, fx - 2 * u, top + 7 * u);
  g.bezierCurveTo(fx, top + 6 * u, fx, top + 6 * u, fx + 2 * u, top + 7 * u);
  g.bezierCurveTo(fx + 5 * u, top + 12 * u, fx + 6 * u, top + 30 * u, fx + 6 * u, top + 50 * u);
  g.lineTo(fx + 11 * u, top + 52 * u);
  g.bezierCurveTo(fx + 9 * u, top + 30 * u, fx + 10 * u, top + 3 * u, fx, top + 3 * u);
  g.fill();
  g.strokeStyle = 'rgba(3,2,2,0.9)';
  g.lineWidth = 0.8 * u;
  for (const dx of [-1.2, 0.6, 1.6]) {
    g.beginPath();
    g.moveTo(fx + dx * u, top + 6 * u);
    g.quadraticCurveTo(fx + dx * 2 * u, top + 16 * u, fx + dx * 1.5 * u, top + 26 * u);
    g.stroke();
  }
  g.restore();
}

/** The family group used by the photo frame, the hero photo and the mirror (Req 19). */
export function drawGroup(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: { haunted: boolean; middleGone: boolean; spread: number; lean: number; edgeGap: boolean; witch?: boolean },
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
  // Taken: the empty place in the middle is not empty any more.
  if (opts.witch) drawWitch(g, w / 2, h, h * 0.92);
  if (opts.haunted) {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 60; i++) g.fillRect((i * 97) % w, (i * 53) % h, 2, 1);
  }
}
