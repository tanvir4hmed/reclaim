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
 * Her, as the photograph shows her: a white face, black sockets with no eyes in them, the mouth
 * stretched open in a scream, two dark streaks down from the eyes; long straight black hair
 * from the crown down past the bottom of the picture like a hood, hiding the rest of her, and
 * the edges of a pale sleeve at each side. `cx` her middle, `top` the crown, `fh` face height.
 */
function drawGhostFigure(g: CanvasRenderingContext2D, cx: number, top: number, fh: number, bottom: number) {
  const u = fh / 10;
  const fy = top + 7.2 * u;
  g.save();
  // the pale sleeves, just showing at the sides of the hair, low down
  g.fillStyle = '#bdb9b0';
  for (const sd of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + sd * 8.6 * u, top + 22 * u);
    g.quadraticCurveTo(cx + sd * 10.4 * u, (top + bottom) / 2 + 10 * u, cx + sd * 11.2 * u, bottom);
    g.lineTo(cx + sd * 9.4 * u, bottom);
    g.quadraticCurveTo(cx + sd * 8.8 * u, (top + bottom) / 2 + 10 * u, cx + sd * 7.6 * u, top + 24 * u);
    g.closePath();
    g.fill();
  }
  // the hair: a hood of black from the crown, straight down past the frame
  const hair = g.createLinearGradient(cx - 10 * u, 0, cx + 10 * u, 0);
  hair.addColorStop(0, '#0b0b0b');
  hair.addColorStop(0.5, '#030303');
  hair.addColorStop(1, '#0b0b0b');
  g.fillStyle = hair;
  g.beginPath();
  g.moveTo(cx, top);
  g.bezierCurveTo(cx - 6 * u, top, cx - 8.4 * u, top + 4 * u, cx - 8.4 * u, top + 12 * u);
  g.bezierCurveTo(cx - 8.6 * u, top + 26 * u, cx - 9.6 * u, bottom - 8 * u, cx - 10 * u, bottom + 2);
  g.lineTo(cx + 10 * u, bottom + 2);
  g.bezierCurveTo(cx + 9.6 * u, bottom - 8 * u, cx + 8.6 * u, top + 26 * u, cx + 8.4 * u, top + 12 * u);
  g.bezierCurveTo(cx + 8.4 * u, top + 4 * u, cx + 6 * u, top, cx, top);
  g.fill();
  // a sheen down the hair, and loose strands
  g.strokeStyle = 'rgba(120,120,116,0.16)';
  g.lineWidth = Math.max(1, 0.25 * u);
  for (let i = 0; i < 14; i++) {
    const x = cx + (i - 6.5) * 1.2 * u;
    g.beginPath();
    g.moveTo(x * 0.98 + cx * 0.02, top + 3 * u);
    g.quadraticCurveTo(x + ((i % 3) - 1) * 0.6 * u, top + 30 * u, x * 1.04 - cx * 0.04, bottom);
    g.stroke();
  }
  // the face, framed by the hair: long, white, a little grey at the edges
  const face = g.createRadialGradient(cx, fy - 1.5 * u, 0.5 * u, cx, fy, 5.6 * u);
  face.addColorStop(0, '#f4f2ec');
  face.addColorStop(0.65, '#d9d5cc');
  face.addColorStop(1, '#8e8a82');
  g.fillStyle = face;
  g.beginPath();
  g.ellipse(cx, fy, 3.9 * u, 5.4 * u, 0, 0, Math.PI * 2);
  g.fill();
  // the hair falls over the edges of the face
  g.fillStyle = '#050505';
  for (const sd of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + sd * 1.2 * u, top + 1.2 * u);
    g.quadraticCurveTo(cx + sd * 3.6 * u, top + 3.4 * u, cx + sd * 3.6 * u, fy + 1 * u);
    g.quadraticCurveTo(cx + sd * 3.4 * u, fy + 4.5 * u, cx + sd * 3 * u, fy + 6.2 * u);
    g.lineTo(cx + sd * 5 * u, fy + 7 * u);
    g.lineTo(cx + sd * 5.2 * u, top + 2 * u);
    g.closePath();
    g.fill();
  }
  // the eye sockets: black, no eyes in them, soft at the edges
  for (const sd of [-1, 1]) {
    const ex = cx + sd * 1.45 * u;
    const ey = fy - 1.6 * u;
    const sock = g.createRadialGradient(ex, ey, 0.2 * u, ex, ey, 1.6 * u);
    sock.addColorStop(0, '#000000');
    sock.addColorStop(0.6, '#0b0909');
    sock.addColorStop(1, 'rgba(40,36,34,0)');
    g.fillStyle = sock;
    g.beginPath();
    g.ellipse(ex, ey, 1.35 * u, 1.05 * u, sd * 0.2, 0, Math.PI * 2);
    g.fill();
    // dark streaks running down from them
    g.strokeStyle = 'rgba(20,16,15,0.75)';
    g.lineWidth = Math.max(1, 0.22 * u);
    for (const k of [-0.3, 0.25]) {
      g.beginPath();
      g.moveTo(ex + k * u, ey + 0.8 * u);
      g.quadraticCurveTo(ex + k * 1.4 * u, ey + 2.6 * u, ex + k * 1.1 * u, ey + 4.4 * u);
      g.stroke();
    }
  }
  // the nose, a shadow, and the mouth wide open in a scream
  g.fillStyle = 'rgba(60,56,52,0.7)';
  g.beginPath();
  g.ellipse(cx, fy + 0.6 * u, 0.35 * u, 0.6 * u, 0, 0, Math.PI * 2);
  g.fill();
  const mouth = g.createRadialGradient(cx, fy + 2.9 * u, 0.2 * u, cx, fy + 3 * u, 1.6 * u);
  mouth.addColorStop(0, '#000');
  mouth.addColorStop(0.75, '#090606');
  mouth.addColorStop(1, '#3a3330');
  g.fillStyle = mouth;
  g.beginPath();
  g.ellipse(cx, fy + 3.1 * u, 0.95 * u, 1.55 * u, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/**
 * Her photograph, the one the letter holds and the camera prints: an old black-and-white snap
 * in a yellowed border. A bare grey room lit from the right, a door in its frame behind her,
 * and her standing in the middle of it, the white face and the scream, black hair to the floor.
 * Grain, a crease, and a vignette.
 */
export function drawWitchPhoto(g: CanvasRenderingContext2D, w: number, h: number, border = 0.06) {
  g.fillStyle = '#e6dcc4';
  g.fillRect(0, 0, w, h);
  // the border yellowed and grubby toward the edges
  const edge = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.6);
  edge.addColorStop(0, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(120,86,40,0.45)');
  g.fillStyle = edge;
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
  // the room: a wall lighter to the right, the floor darker
  const wall = g.createLinearGradient(x0, 0, x0 + iw, 0);
  wall.addColorStop(0, '#2c2c2a');
  wall.addColorStop(0.55, '#4a4a47');
  wall.addColorStop(1, '#6a6a66');
  g.fillStyle = wall;
  g.fillRect(x0, y0, iw, ih);
  const floor = g.createLinearGradient(0, y0 + ih * 0.8, 0, y0 + ih);
  floor.addColorStop(0, 'rgba(20,20,19,0.6)');
  floor.addColorStop(1, 'rgba(10,10,9,0.9)');
  g.fillStyle = floor;
  g.fillRect(x0, y0 + ih * 0.8, iw, ih * 0.2);
  // the door behind her, to the right: a frame and a paler panel
  const dx = x0 + iw * 0.6;
  const dw = iw * 0.24;
  const dy = y0 + ih * 0.12;
  const dh = ih * 0.7;
  g.fillStyle = '#7a7a75';
  g.fillRect(dx - iw * 0.012, dy - ih * 0.02, dw + iw * 0.024, dh + ih * 0.02);
  const panel = g.createLinearGradient(dx, dy, dx + dw, dy + dh);
  panel.addColorStop(0, '#8c8c86');
  panel.addColorStop(1, '#6c6c67');
  g.fillStyle = panel;
  g.fillRect(dx, dy, dw, dh);
  g.strokeStyle = 'rgba(40,40,38,0.5)';
  g.lineWidth = Math.max(1, iw * 0.004);
  g.strokeRect(dx + dw * 0.1, dy + dh * 0.06, dw * 0.8, dh * 0.38);
  g.strokeRect(dx + dw * 0.1, dy + dh * 0.5, dw * 0.8, dh * 0.44);
  // something low in the corner (a bed's end), barely there
  g.fillStyle = 'rgba(30,30,28,0.55)';
  g.fillRect(x0 + iw * 0.8, y0 + ih * 0.78, iw * 0.22, ih * 0.14);
  // her, in the middle of the room
  const cx = x0 + iw * 0.4;
  const top = y0 + ih * 0.1;
  const fh = ih * 0.2;
  g.globalAlpha = 0.18;
  drawGhostFigure(g, cx + iw * 0.01, top, fh, y0 + ih);
  g.globalAlpha = 1;
  drawGhostFigure(g, cx, top, fh, y0 + ih);
  // grain and a vignette
  const img = g.getImageData(x0, y0, iw, ih);
  let seed = 977;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const n = (seed / 4294967296 - 0.5) * 30;
    img.data[i] = Math.max(0, Math.min(255, img.data[i]! + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1]! + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2]! + n));
  }
  g.putImageData(img, x0, y0);
  const vg = g.createRadialGradient(x0 + iw * 0.45, y0 + ih * 0.45, ih * 0.3, x0 + iw / 2, y0 + ih / 2, Math.hypot(iw, ih) * 0.6);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.65)');
  g.fillStyle = vg;
  g.fillRect(x0, y0, iw, ih);
  g.restore();
  // a crease across the top right corner, a stain on the border
  g.strokeStyle = 'rgba(255,255,255,0.4)';
  g.lineWidth = Math.max(1, w * 0.003);
  g.beginPath();
  g.moveTo(w * 0.78, 0);
  g.lineTo(w * 0.98, h * 0.2);
  g.stroke();
  g.fillStyle = 'rgba(140,100,50,0.25)';
  g.beginPath();
  g.ellipse(w * 0.84, h * 0.94, w * 0.12, h * 0.03, 0.3, 0, Math.PI * 2);
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
