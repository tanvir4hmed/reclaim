import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { seeded } from '../../director/footprints';
import { drawWitchPhoto, useCanvasTexture } from '../../gl/canvasTex';
import { M } from '../../gl/materials';
import { progress, useTaken } from '../../gl/useTaken';
import { useHaunted, useStory } from '../../store';
import { drawBloodWords, drawParchment, drawSealTop, drawSmear, drawSpatter } from './paper';

/*
 * The unsent letter (Requirement 16), rebuilt from Tanvir's two references (round 11). A wide
 * antique envelope seen from its back: the far panel, the near pocket whose top edge is a V
 * from the two top corners down to the middle, the triangular flap folded over that V with
 * its point in a cracked dark-red wax seal. The letter is a separate sheet between the far
 * panel and the pocket, so it is hidden by the pocket and the closed flap, and can only come
 * out through the top. Taken: the seal cracks and breaks in two, the flap swings back on its
 * fold and stays standing open behind, and then the letter slides up out of the envelope until
 * most of it shows: her old photograph pinned across its top half, and under it, written in
 * blood, REMEMBER ME?
 */

const W = 1.8;
const H = 0.96;
const TOP = H / 2;
/**
 * The flap's point (and the seal), and the bottom of the pocket's V a little higher, so the
 * closed flap covers the V everywhere along its two edges and nothing inside shows.
 */
const TIP_Y = 0.0;
const V_Y = 0.08;
const SEAL_R = 0.12;
const LW = 1.37;
/** The sheet fits inside the envelope with room to spare, so nothing of it shows until it rises. */
const LH = 0.86;
/** How far the letter rises: about six sevenths of it out above the envelope's top edge. */
const RISE = TOP - LH / 2 + LH * 0.86;
const T = { shake: 0.0, split: 0.26, open: 0.38, openFor: 0.6, rise: 0.95, riseFor: 0.95 };
/** The photograph on the letter, as fractions of the sheet: centre x, top, width, height. */
const PHOTO = { cx: 0.5, top: 0.05, w: 0.5, h: 0.52 };
/** The message's face: a horror display font, but every letter clear (Creepster, OFL). */
const MESSAGE_FONT = 'Creepster';
const MESSAGE = 'REMEMBER ME?';

/** Flat paper part from an outline, with UVs laid across the given bounds (so a canvas maps onto it). */
function paperGeometry(pts: [number, number][], bx: number, by: number, bw: number, bh: number): THREE.BufferGeometry {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ShapeGeometry(s);
  const p = g.attributes.position as THREE.BufferAttribute;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = (p.getX(i) - bx) / bw;
    uv[i * 2 + 1] = (p.getY(i) - by) / bh;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Points along a to b, worn: tiny wobbles and the odd nick out of the edge. */
function worn(a: [number, number], b: [number, number], r: () => number, step = 0.03, depth = 0.005): [number, number][] {
  const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
  const nx = -(b[1] - a[1]);
  const ny = b[0] - a[0];
  const l = Math.hypot(nx, ny) || 1;
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const k = i === 0 ? 0 : (r() - 0.5) * depth + (r() < 0.08 ? -depth * 2 : 0);
    out.push([a[0] + (b[0] - a[0]) * t + (nx / l) * k, a[1] + (b[1] - a[1]) * t + (ny / l) * k]);
  }
  return out;
}

/** One half of the seal: a half disc of wax split along a jagged line, its raised rim half. */
function sealHalf(upper: boolean, split: [number, number][]): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const line = upper ? split : [...split].reverse();
  line.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  if (upper) s.absarc(0, 0, SEAL_R, 0, Math.PI, false);
  else s.absarc(0, 0, SEAL_R, Math.PI, Math.PI * 2, false);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 24 });
  const p = g.attributes.position as THREE.BufferAttribute;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = (p.getX(i) + SEAL_R) / (2 * SEAL_R);
    uv[i * 2 + 1] = (p.getY(i) + SEAL_R) / (2 * SEAL_R);
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

export default function Letter() {
  const haunted = useHaunted();
  const played = useStory((s) => s.story.played.letter === true);
  const { taken, since } = useTaken('letter');
  const to = haunted && played ? 'The next person who opens this' : 'Margaret Hale';

  // the address side, facing away (seen when it is turned round)
  const address = useCanvasTexture(
    512,
    272,
    (g, w, h) => {
      drawParchment(g, w, h, 'body', haunted, 5);
      g.font = 'italic 34px "Fraunces Variable", Georgia, serif';
      g.fillStyle = '#3a2a1c';
      g.textAlign = 'center';
      g.fillText('To:', w / 2, h * 0.5);
      g.font = `italic ${to.length > 20 ? 26 : 38}px "Fraunces Variable", Georgia, serif`;
      g.fillText(to, w / 2, h * 0.68);
    },
    [haunted, to],
  );
  const pocketTex = useCanvasTexture(
    1024,
    546,
    (g, w, h) => {
      drawParchment(g, w, h, 'body', haunted, 11);
      if (!haunted) return;
      // blood, as on the reference: spatter at the top right and down the right side, a few
      // dots at the left, a smear on the bottom left corner
      drawSpatter(g, w, h, 3, [
        [0.87, 0.23, 9],
        [0.83, 0.27, 3],
        [0.9, 0.6, 4],
        [0.093, 0.52, 3],
        [0.15, 0.62, 2],
      ]);
      drawSmear(g, 6, h - 18, 90, -0.35, 4);
      drawSmear(g, w - 10, h * 0.62, 70, Math.PI / 2 + 0.2, 6);
    },
    [haunted],
  );
  const insideTex = useCanvasTexture(
    512,
    272,
    (g, w, h) => {
      drawParchment(g, w, h, 'body', haunted, 21);
      g.fillStyle = 'rgba(40,24,10,0.35)';
      g.fillRect(0, 0, w, h);
    },
    [haunted],
  );
  const flapTex = useCanvasTexture(
    1024,
    262,
    (g, w, h) => {
      drawParchment(g, w, h, 'flap', haunted, 31);
      if (!haunted) return;
      // reddish stains along both edges of the flap, near the corners and by the seal
      drawSmear(g, w * 0.17, h * 0.3, 80, 0.45, 8);
      drawSmear(g, w * 0.74, h * 0.18, 90, -0.45, 9);
      drawSmear(g, w * 0.44, h * 0.78, 60, 0.5, 10);
    },
    [haunted],
  );
  const sealTex = useCanvasTexture(128, 128, (g, w, h) => drawSealTop(g, w, h, haunted), [haunted]);
  // the message is drawn once its font has loaded, or it would be drawn in a fallback face
  const [fontReady, setFontReady] = useState(false);
  useEffect(() => {
    let alive = true;
    const fonts = document.fonts as FontFaceSet | undefined;
    if (!fonts) return;
    void fonts.load(`120px ${MESSAGE_FONT}`).then(() => alive && setFontReady(true), () => alive && setFontReady(true));
    return () => {
      alive = false;
    };
  }, []);
  const letterTex = useCanvasTexture(
    1024,
    Math.round((1024 * LH) / LW),
    (g, w, h) => {
      drawParchment(g, w, h, 'letter', true, 41);
      // the photograph, big, across the top half, pinned at its top left, a shadow under it
      const pw = w * PHOTO.w;
      const ph = h * PHOTO.h;
      g.save();
      g.translate(w * PHOTO.cx, h * PHOTO.top + ph / 2);
      g.rotate(-0.03);
      g.fillStyle = 'rgba(30,18,8,0.4)';
      g.filter = 'blur(6px)';
      g.fillRect(-pw / 2 + 6, -ph / 2 + 8, pw, ph);
      g.filter = 'none';
      const photo = document.createElement('canvas');
      photo.width = Math.round(pw);
      photo.height = Math.round(ph);
      const pg = photo.getContext('2d');
      if (pg) {
        drawWitchPhoto(pg, photo.width, photo.height, 0.05);
        g.drawImage(photo, -pw / 2, -ph / 2);
      }
      g.restore();
      // a little blood spattered across the top right, as on the reference
      drawSpatter(g, w, h, 7, [
        [0.86, 0.1, 6],
        [0.9, 0.2, 3],
        [0.12, 0.5, 3],
      ]);
      // the one line, in blood, across the sheet under the photograph, clear of every edge
      drawBloodWords(g, MESSAGE, w * 0.07, h * 0.8, 128, w * 0.86, 51, MESSAGE_FONT);
    },
    [fontReady],
  );

  const parts = useMemo(() => {
    const r = seeded(17);
    // the far panel, whole
    const back = paperGeometry([[-W / 2, -TOP], [W / 2, -TOP], [W / 2, TOP], [-W / 2, TOP]], -W / 2, -TOP, W, H);
    // the near pocket: the V at the top, the rest whole
    const pocket = paperGeometry(
      [
        ...worn([-W / 2, TOP], [0, V_Y], r),
        ...worn([0, V_Y], [W / 2, TOP], r),
        [W / 2, TOP],
        [W / 2, -TOP],
        [-W / 2, -TOP],
      ],
      -W / 2,
      -TOP,
      W,
      H,
    );
    // the flap, from its fold at the top edge down to its point (in the hinge's frame)
    const depth = TOP - TIP_Y;
    // (no repeated corner points: a doubled vertex left a sliver out of the triangulation)
    const flap = paperGeometry([[-W / 2, 0], ...worn([W / 2, 0], [0, -depth], r), ...worn([0, -depth], [-W / 2, 0], r)], -W / 2, -depth, W, depth);
    // the letter: a big sheet with torn, uneven edges
    const lr = seeded(29);
    const letter = paperGeometry(
      [
        ...worn([-LW / 2, -LH / 2], [LW / 2, -LH / 2], lr, 0.03, 0.012),
        ...worn([LW / 2, -LH / 2], [LW / 2, LH / 2], lr, 0.03, 0.014),
        ...worn([LW / 2, LH / 2], [-LW / 2, LH / 2], lr, 0.025, 0.018),
        ...worn([-LW / 2, LH / 2], [-LW / 2, -LH / 2], lr, 0.03, 0.014),
      ],
      -LW / 2,
      -LH / 2,
      LW,
      LH,
    );
    // the seal splits along a jagged line across it
    const sr = seeded(19);
    const split: [number, number][] = Array.from({ length: 9 }, (_, i) => [-SEAL_R + (i / 8) * 2 * SEAL_R, i === 0 || i === 8 ? 0 : (sr() - 0.5) * 0.03]);
    return { back, pocket, flap, letter, sealUp: sealHalf(true, split), sealDown: sealHalf(false, split) };
  }, []);
  useEffect(() => () => Object.values(parts).forEach((g) => g.dispose()), [parts]);

  const sheet = useRef<THREE.Group>(null);
  const lid = useRef<THREE.Group>(null);
  const lower = useRef<THREE.Group>(null);
  const upper = useRef<THREE.Group>(null);
  useFrame(() => {
    const s = taken ? since() : -1;
    const done = s === Infinity;
    // the seal shudders, cracks, and breaks: the upper half stays on the flap's point, the
    // lower half stays on the pocket, knocked a little askew
    const shake = !done && s > T.shake && s < T.split ? Math.sin(s * 80) * 0.006 * (1 - s / T.split) : 0;
    const broke = taken ? progress(s, 0.18, T.split) : 0;
    if (lower.current) {
      lower.current.position.set(shake + broke * 0.01, TIP_Y - broke * 0.018, 0.004);
      lower.current.rotation.z = -broke * 0.12;
    }
    if (upper.current) upper.current.position.set(shake, -(TOP - TIP_Y) + broke * 0.012, 0.004);
    // the flap swings back on its fold and stays standing open behind the letter
    const open = taken ? progress(s, T.openFor, T.open) : 0;
    if (lid.current) lid.current.rotation.x = open * 2.84;
    // only then does the letter slide up out of the envelope
    const rise = taken ? progress(s, T.riseFor, T.rise) : 0;
    if (sheet.current) {
      sheet.current.position.y = rise * RISE;
      sheet.current.rotation.z = Math.sin(rise * Math.PI) * 0.015;
    }
  });

  const paper = (map: THREE.Texture, side: THREE.Side = THREE.FrontSide) => <meshStandardMaterial map={map} roughness={0.92} side={side} />;
  return (
    <group rotation={[-0.3, 0.12, -0.05]} position-y={-0.3}>
      {/* the address side, facing away */}
      <mesh position-z={-0.016} rotation-y={Math.PI}>
        <planeGeometry args={[W, H]} />
        {paper(address)}
      </mesh>
      {/* the far panel's inside, seen through the V once the flap is open */}
      <mesh geometry={parts.back} position-z={-0.012}>
        {paper(insideTex)}
      </mesh>
      {/* the letter, between the far panel and the pocket */}
      <group ref={sheet} position={[0, 0, -0.006]}>
        <mesh geometry={parts.letter}>{paper(letterTex, THREE.DoubleSide)}</mesh>
        {/* the brass pin through the photograph's top left corner */}
        <mesh material={M.brass()} position={[-LW / 2 + LW * (PHOTO.cx - PHOTO.w / 2 + 0.04), LH / 2 - LH * (PHOTO.top + 0.04), 0.012]}>
          <sphereGeometry args={[0.017, 16, 12]} />
        </mesh>
      </group>
      {/* the near pocket, with its V */}
      <mesh geometry={parts.pocket}>{paper(pocketTex)}</mesh>
      {/* the half of the seal that stays on the pocket, with a drip of wax under it */}
      <group ref={lower} position={[0, TIP_Y, 0.004]}>
        <mesh geometry={parts.sealDown}>
          <meshStandardMaterial map={sealTex} roughness={0.35} />
        </mesh>
        {[
          [-0.1, -0.08, 0.035],
          [-0.07, -0.11, 0.024],
        ].map(([x, y, r], i) => (
          <mesh key={i} material={M.wax()} position={[x!, y!, 0.006]} scale={[1, 1.3, 0.35]}>
            <sphereGeometry args={[r!, 14, 10]} />
          </mesh>
        ))}
      </group>
      {/* the flap, hinged at the top edge; closed it lies over the V, open it stands behind */}
      <group ref={lid} position={[0, TOP, -0.004]}>
        <mesh geometry={parts.flap} position-z={0.009}>
          {paper(flapTex, THREE.DoubleSide)}
        </mesh>
        <group ref={upper} position={[0, -(TOP - TIP_Y), 0.004]}>
          <mesh geometry={parts.sealUp} position-z={0.006}>
            <meshStandardMaterial map={sealTex} roughness={0.35} />
          </mesh>
        </group>
      </group>
      {/* not drawn: the room the letter rises into, so the product view frames it */}
      <mesh position={[0, (RISE + LH / 2 - TOP) / 2, 0]}>
        <boxGeometry args={[W, H + RISE + LH / 2 - TOP, 0.2]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
}
