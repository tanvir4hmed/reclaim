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
 * The witch: the shop's last resident, as she appears in the letter's photo, the camera's print
 * and in the middle of the family portrait. Tall and too thin, a faint pallor round her; black
 * hair hanging in strands over a long grey face, black hollow eyes with a pin of light in each,
 * a mouth open too wide; a long dark gown going to wisps at the hem; long pale arms hanging to
 * the knees, the fingers too long. `cx` is her centre, `base` the bottom edge, `tall` her height.
 */
export function drawWitch(g: CanvasRenderingContext2D, cx: number, base: number, tall: number) {
  const u = tall / 100;
  const top = base - tall;
  g.save();
  // a faint pallor in the air round her, so she shows in a dark print
  const halo = g.createRadialGradient(cx, top + 30 * u, 2 * u, cx, top + 40 * u, 48 * u);
  halo.addColorStop(0, 'rgba(200,196,186,0.22)');
  halo.addColorStop(1, 'rgba(200,196,186,0)');
  g.fillStyle = halo;
  g.fillRect(cx - 50 * u, top - 10 * u, 100 * u, tall + 10 * u);
  // the gown: narrow shoulders, long and straight, going to wisps at the hem
  const gown = g.createLinearGradient(0, top + 24 * u, 0, base);
  gown.addColorStop(0, 'rgba(14,12,12,1)');
  gown.addColorStop(0.8, 'rgba(10,9,9,0.95)');
  gown.addColorStop(1, 'rgba(10,9,9,0)');
  g.fillStyle = gown;
  g.beginPath();
  g.moveTo(cx - 8 * u, top + 25 * u);
  g.quadraticCurveTo(cx - 12 * u, top + 60 * u, cx - 17 * u, base - 4 * u);
  for (let i = 0; i <= 8; i++) {
    const x = cx - 17 * u + (i / 8) * 34 * u;
    g.lineTo(x, base - (i % 2 ? 0 : 5 * u) - ((i * 37) % 4) * u);
  }
  g.quadraticCurveTo(cx + 12 * u, top + 60 * u, cx + 8 * u, top + 25 * u);
  g.closePath();
  g.fill();
  // folds in it, faintly lighter
  g.strokeStyle = 'rgba(70,66,62,0.35)';
  g.lineWidth = 0.6 * u;
  for (const dx of [-7, -2.5, 3, 8]) {
    g.beginPath();
    g.moveTo(cx + dx * 0.5 * u, top + 32 * u);
    g.quadraticCurveTo(cx + dx * 0.9 * u, top + 62 * u, cx + dx * 1.3 * u, base - 8 * u);
    g.stroke();
  }
  // the neck, thin and grey
  g.fillStyle = '#8f897e';
  g.fillRect(cx - 1.6 * u, top + 19 * u, 3.2 * u, 7 * u);
  // arms hanging long at her sides, down past the hips, and the long fingers
  for (const sd of [-1, 1]) {
    const sx = cx + sd * 8.5 * u;
    const ex = cx + sd * 12.5 * u;
    const ey = top + 68 * u;
    const arm = g.createLinearGradient(0, top + 27 * u, 0, ey);
    arm.addColorStop(0, '#6f695f');
    arm.addColorStop(1, '#b8b2a6');
    g.strokeStyle = arm;
    g.lineCap = 'round';
    g.lineWidth = 2.4 * u;
    g.beginPath();
    g.moveTo(sx, top + 28 * u);
    g.quadraticCurveTo(sx + sd * 3 * u, top + 48 * u, ex, ey);
    g.stroke();
    g.strokeStyle = '#c4beb2';
    g.lineWidth = 0.7 * u;
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.moveTo(ex + (k - 1.5) * 0.9 * u, ey);
      g.quadraticCurveTo(ex + (k - 1.5) * 1.1 * u + sd * 0.4 * u, ey + 5 * u, ex + (k - 1.5) * 1.2 * u, ey + (8 + (k % 2) * 1.5) * u);
      g.stroke();
    }
  }
  // the face: long, grey-white, shadowed under the brow and in the cheeks
  const fx = cx;
  const fy = top + 13 * u;
  const face = g.createRadialGradient(fx, fy - 3 * u, 1, fx, fy, 10 * u);
  face.addColorStop(0, '#e0dbd0');
  face.addColorStop(0.7, '#a39d91');
  face.addColorStop(1, '#4e4a43');
  g.fillStyle = face;
  g.beginPath();
  g.ellipse(fx, fy, 6 * u, 9.5 * u, 0, 0, Math.PI * 2);
  g.fill();
  // hollow eyes, a pin of light deep in each
  g.fillStyle = '#030202';
  for (const sd of [-1, 1]) {
    g.beginPath();
    g.ellipse(fx + sd * 2.5 * u, fy - 2 * u, 1.8 * u, 2.4 * u, sd * 0.15, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = 'rgba(235,230,215,0.9)';
  for (const sd of [-1, 1]) {
    g.beginPath();
    g.arc(fx + sd * 2.4 * u, fy - 1.6 * u, 0.32 * u, 0, Math.PI * 2);
    g.fill();
  }
  // the nose, two dark slits, and the mouth hanging open, far too long
  g.fillStyle = '#1a1614';
  g.fillRect(fx - 0.7 * u, fy + 1.6 * u, 0.5 * u, 1.2 * u);
  g.fillRect(fx + 0.2 * u, fy + 1.6 * u, 0.5 * u, 1.2 * u);
  g.fillStyle = '#030202';
  g.beginPath();
  g.ellipse(fx, fy + 6 * u, 1.6 * u, 3.4 * u, 0, 0, Math.PI * 2);
  g.fill();
  // hair: a black curtain from the crown, parted over the face, down past the chest
  g.fillStyle = '#030202';
  g.beginPath();
  g.moveTo(fx, top + 2.5 * u);
  g.bezierCurveTo(fx - 10 * u, top + 2.5 * u, fx - 9.5 * u, top + 30 * u, fx - 11.5 * u, top + 54 * u);
  g.lineTo(fx - 6 * u, top + 51 * u);
  g.bezierCurveTo(fx - 6 * u, top + 30 * u, fx - 5 * u, top + 12 * u, fx - 2.5 * u, top + 6.5 * u);
  g.bezierCurveTo(fx - 0.5 * u, top + 5.5 * u, fx + 0.5 * u, top + 5.5 * u, fx + 2.5 * u, top + 6.5 * u);
  g.bezierCurveTo(fx + 5 * u, top + 12 * u, fx + 6 * u, top + 30 * u, fx + 6 * u, top + 51 * u);
  g.lineTo(fx + 11.5 * u, top + 54 * u);
  g.bezierCurveTo(fx + 9.5 * u, top + 30 * u, fx + 10 * u, top + 2.5 * u, fx, top + 2.5 * u);
  g.fill();
  // loose strands: some across the face, some hanging below the rest
  g.strokeStyle = 'rgba(3,2,2,0.9)';
  g.lineWidth = 0.55 * u;
  for (const [x0, x1, len] of [
    [-1.6, -2.4, 24],
    [0.4, 1.2, 20],
    [1.8, 2.8, 28],
    [-3.4, -4.2, 30],
    [3.6, 4.6, 26],
  ] as const) {
    g.beginPath();
    g.moveTo(fx + x0 * u, top + 5 * u);
    g.quadraticCurveTo(fx + ((x0 + x1) / 2) * u + 0.8 * u, top + 14 * u, fx + x1 * u, top + len * u);
    g.stroke();
  }
  for (let i = 0; i < 9; i++) {
    const x = fx + (i < 5 ? -1 : 1) * (6.5 + (i % 5) * 1.1) * u;
    g.beginPath();
    g.moveTo(x, top + 48 * u);
    g.lineTo(x + ((i % 3) - 1) * 0.8 * u, top + (56 + ((i * 7) % 6)) * u);
    g.stroke();
  }
  g.restore();
}

/**
 * Her photograph, the one the letter holds and the camera prints: an old black-and-white snap
 * in a yellowed white border. A dim room, a doorway faintly lit behind, and her standing in
 * front of it, too close, a little blurred as if she moved. Grain and a vignette.
 */
export function drawWitchPhoto(g: CanvasRenderingContext2D, w: number, h: number, border = 0.06) {
  g.fillStyle = '#ebe3d0';
  g.fillRect(0, 0, w, h);
  const b = Math.round(Math.min(w, h) * border);
  const x0 = b;
  const y0 = b;
  const iw = w - 2 * b;
  const ih = h - 2 * b;
  g.save();
  g.beginPath();
  g.rect(x0, y0, iw, ih);
  g.clip();
  const room = g.createLinearGradient(0, y0, 0, y0 + ih);
  room.addColorStop(0, '#34302a');
  room.addColorStop(0.72, '#24211d');
  room.addColorStop(1, '#141210');
  g.fillStyle = room;
  g.fillRect(x0, y0, iw, ih);
  // the floor line and the doorway behind her, faintly lit
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(x0, y0 + ih * 0.78, iw, ih * 0.22);
  const door = g.createLinearGradient(0, y0 + ih * 0.12, 0, y0 + ih * 0.78);
  door.addColorStop(0, '#5a564e');
  door.addColorStop(1, '#3c3933');
  g.fillStyle = door;
  g.fillRect(x0 + iw * 0.62, y0 + ih * 0.12, iw * 0.2, ih * 0.66);
  g.strokeStyle = 'rgba(160,154,140,0.25)';
  g.lineWidth = Math.max(1, iw * 0.006);
  g.strokeRect(x0 + iw * 0.6, y0 + ih * 0.1, iw * 0.24, ih * 0.68);
  // her: a faint double where she moved, then her
  // close to the lens, so she fills the print from the waist up
  const tall = ih * 1.55;
  const foot = y0 + ih * 1.6;
  g.globalAlpha = 0.25;
  drawWitch(g, x0 + iw * 0.47 + iw * 0.014, foot, tall);
  g.globalAlpha = 1;
  drawWitch(g, x0 + iw * 0.47, foot, tall);
  // grain and a vignette
  const img = g.getImageData(x0, y0, iw, ih);
  let seed = 977;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const n = (seed / 4294967296 - 0.5) * 34;
    img.data[i] = Math.max(0, Math.min(255, img.data[i]! + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1]! + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2]! + n));
  }
  g.putImageData(img, x0, y0);
  const vg = g.createRadialGradient(x0 + iw / 2, y0 + ih * 0.45, ih * 0.25, x0 + iw / 2, y0 + ih / 2, ih * 0.85);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.7)');
  g.fillStyle = vg;
  g.fillRect(x0, y0, iw, ih);
  g.restore();
  // a crease across a corner, a stain on the border
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(w * 0.74, 0);
  g.lineTo(w, h * 0.28);
  g.stroke();
  g.fillStyle = 'rgba(140,100,50,0.25)';
  g.beginPath();
  g.ellipse(w * 0.84, h * 0.92, w * 0.12, h * 0.04, 0.3, 0, Math.PI * 2);
  g.fill();
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
