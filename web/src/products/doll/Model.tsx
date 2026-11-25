import { Decal } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { seeded } from '../../director/footprints';
import { useCanvasTexture } from '../../gl/canvasTex';
import { M } from '../../gl/materials';
import { progress, useTaken } from '../../gl/useTaken';
import { useHaunted } from '../../store';
import { EYE, EYE_DIRS, HEAD, furBall, furRing, headGeometry, hollyLeaf, laceBand, ringlet, skirtGeometry, sweep } from './shapes';

/*
 * The porcelain doll, rebuilt from Tanvir's two references (round 11): a little girl doll
 * sitting with her legs out, in a red velvet dress with white fur trim, a lace-fronted bodice
 * and two tiers of lace under the hem, a red bow and a gold bell at her throat, a Santa hat
 * with a pom-pom and holly, long caramel ringlets, and a small teddy held in both hands.
 * After the Reveal the same doll has been left too long: faded dusty velvet, torn hat and hem,
 * dirty lace, matted wild hair, grey porcelain cracked across, red eyes in dark sockets, a
 * stitched-up teddy with one eye gone. Every size and position is measured from the reference
 * (see shapes.ts). Taken: her head, tilted, comes slowly upright, her eyes turn onto you, and
 * blood runs from both of them down her face.
 */

/** Seconds into the Take: the head rights itself, the eyes come round, then the blood. */
const TAKE = { straighten: 0.95, look: 0.8, lookFor: 0.7, bleed: 1.4 };
/** Before the take, after the Reveal, her head hangs to one side like this. */
const TILT = { z: 0.24, x: 0.07 };
/** Where her neck pivots. */
const NECK_Y = 0.53;

/** Her painted face: blush, brows, lashes and lips; haunted, grime, cracks, dark sockets, blood. */
function drawFace(g: CanvasRenderingContext2D, w: number, h: number, haunted: boolean) {
  g.clearRect(0, 0, w, h);
  const u = w / 512;
  const eyes: [number, number][] = [
    [256 - 121, 222],
    [256 + 121, 222],
  ];
  if (!haunted) {
    // rosy cheeks
    for (const s of [-1, 1]) {
      const grd = g.createRadialGradient((256 + s * 168) * u, 330 * u, 0, (256 + s * 168) * u, 330 * u, 70 * u);
      grd.addColorStop(0, 'rgba(236,140,130,0.55)');
      grd.addColorStop(1, 'rgba(236,140,130,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
    }
    // fine brown brows, a little arched
    g.strokeStyle = 'rgba(120,76,44,0.85)';
    g.lineWidth = 5 * u;
    g.lineCap = 'round';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo((256 + s * 70) * u, 150 * u);
      g.quadraticCurveTo((256 + s * 120) * u, 128 * u, (256 + s * 168) * u, 150 * u);
      g.stroke();
    }
    // lower lashes
    g.strokeStyle = 'rgba(70,40,26,0.6)';
    g.lineWidth = 2 * u;
    for (const [x, y] of eyes)
      for (let i = -2; i <= 2; i++) {
        g.beginPath();
        g.moveTo((x + i * 9) * u, (y + 40) * u);
        g.lineTo((x + i * 11) * u, (y + 50) * u);
        g.stroke();
      }
    // a small closed smile: the upper lip's bow, a fuller lower lip, a little shine
    g.fillStyle = '#c75a58';
    g.beginPath();
    g.moveTo(222 * u, 398 * u);
    g.quadraticCurveTo(240 * u, 384 * u, 256 * u, 392 * u);
    g.quadraticCurveTo(272 * u, 384 * u, 290 * u, 398 * u);
    g.quadraticCurveTo(256 * u, 424 * u, 222 * u, 398 * u);
    g.fill();
    g.strokeStyle = 'rgba(120,40,40,0.7)';
    g.lineWidth = 2.2 * u;
    g.beginPath();
    g.moveTo(224 * u, 398 * u);
    g.quadraticCurveTo(256 * u, 408 * u, 288 * u, 398 * u);
    g.stroke();
    g.fillStyle = 'rgba(255,230,225,0.6)';
    g.beginPath();
    g.ellipse(258 * u, 410 * u, 9 * u, 3 * u, 0, 0, Math.PI * 2);
    g.fill();
    return;
  }
  // grime, settled into the porcelain
  const r = seeded(31);
  for (let i = 0; i < 26; i++) {
    const x = r() * w;
    const y = r() * h;
    const grd = g.createRadialGradient(x, y, 0, x, y, (30 + r() * 60) * u);
    grd.addColorStop(0, `rgba(70,58,44,${0.12 + r() * 0.12})`);
    grd.addColorStop(1, 'rgba(70,58,44,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  }
  // dark, hollow sockets round the eyes
  for (const [x, y] of eyes) {
    const grd = g.createRadialGradient(x * u, y * u, 20 * u, x * u, y * u, 78 * u);
    grd.addColorStop(0, 'rgba(20,10,10,0.85)');
    grd.addColorStop(0.55, 'rgba(40,24,22,0.45)');
    grd.addColorStop(1, 'rgba(40,24,22,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  }
  // cracks across the porcelain: from the brow down past the eye, and across the cheek
  g.strokeStyle = 'rgba(28,20,16,0.9)';
  g.lineCap = 'round';
  const crack = (pts: [number, number][], wd: number) => {
    g.lineWidth = wd * u;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x * u, y * u) : g.moveTo(x * u, y * u)));
    g.stroke();
  };
  crack([[300, 40], [318, 96], [306, 150], [330, 190], [322, 260], [352, 312], [344, 380]], 3);
  crack([[318, 96], [362, 120], [400, 112]], 2);
  crack([[322, 260], [282, 290], [262, 340]], 2);
  crack([[150, 60], [170, 120], [150, 170]], 2);
  crack([[110, 300], [160, 330], [176, 392], [214, 430]], 2.4);
  crack([[176, 392], [130, 420]], 1.6);
  // grey, unsmiling lips
  g.fillStyle = 'rgba(110,70,68,0.9)';
  g.beginPath();
  g.ellipse(256 * u, 402 * u, 26 * u, 9 * u, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(40,20,20,0.8)';
  g.lineWidth = 2 * u;
  g.beginPath();
  g.moveTo(232 * u, 402 * u);
  g.lineTo(280 * u, 402 * u);
  g.stroke();
  // old blood already dried under one eye, as on the reference
  g.strokeStyle = 'rgba(110,10,12,0.85)';
  g.lineWidth = 6 * u;
  g.beginPath();
  g.moveTo(eyes[1]![0] * u - 10 * u, eyes[1]![1] * u + 44 * u);
  g.quadraticCurveTo(eyes[1]![0] * u - 4 * u, 320 * u, eyes[1]![0] * u - 18 * u, 420 * u);
  g.stroke();
}

/** The iris of a glass doll's eye: hazel-green by day, a red glow after the Reveal. */
function drawIris(g: CanvasRenderingContext2D, w: number, h: number, haunted: boolean) {
  const c = w / 2;
  g.clearRect(0, 0, w, h);
  const grd = g.createRadialGradient(c, c, w * 0.08, c, c, w * 0.5);
  if (haunted) {
    grd.addColorStop(0, '#ff4a2a');
    grd.addColorStop(0.5, '#c01010');
    grd.addColorStop(1, '#3a0202');
  } else {
    grd.addColorStop(0, '#b6a668');
    grd.addColorStop(0.45, '#7d8a5a');
    grd.addColorStop(0.85, '#4b5a38');
    grd.addColorStop(1, '#1e2414');
  }
  g.fillStyle = grd;
  g.beginPath();
  g.arc(c, c, w * 0.5, 0, Math.PI * 2);
  g.fill();
  // fine streaks out from the pupil
  g.strokeStyle = haunted ? 'rgba(255,120,80,0.35)' : 'rgba(230,220,170,0.35)';
  g.lineWidth = 1;
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    g.beginPath();
    g.moveTo(c + Math.cos(a) * w * 0.14, c + Math.sin(a) * w * 0.14);
    g.lineTo(c + Math.cos(a) * w * 0.44, c + Math.sin(a) * w * 0.44);
    g.stroke();
  }
  // the pupil: after the Reveal a wide black hole in the middle of the red, with a dark rim
  if (haunted) {
    g.fillStyle = 'rgba(20,0,0,0.85)';
    g.beginPath();
    g.arc(c, c, w * 0.25, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#000000';
  g.beginPath();
  g.arc(c, c, w * (haunted ? 0.21 : 0.17), 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.beginPath();
  g.ellipse(c - w * 0.15, c - w * 0.16, w * 0.07, w * 0.05, -0.5, 0, Math.PI * 2);
  g.fill();
}

/** Lace: scalloped edge, rows of little holes and flowers, on a transparent ground. */
function drawLace(g: CanvasRenderingContext2D, w: number, h: number, haunted: boolean) {
  g.clearRect(0, 0, w, h);
  g.fillStyle = haunted ? '#b2a68c' : '#f6efdf';
  const sc = 16;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(w, 0);
  g.lineTo(w, h * 0.7);
  for (let i = sc; i >= 0; i--) {
    const x = (i / sc) * w;
    g.quadraticCurveTo(x + w / sc / 2, h * 1.02, x, h * 0.7);
  }
  g.closePath();
  g.fill();
  g.globalCompositeOperation = 'destination-out';
  const r = seeded(haunted ? 5 : 3);
  for (let i = 0; i < 3 * sc; i++) {
    const x = ((i % sc) + 0.5) * (w / sc);
    const y = h * (0.18 + Math.floor(i / sc) * 0.2);
    g.beginPath();
    g.arc(x, y, h * 0.06, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < sc; i++) {
    const x = (i + 0.5) * (w / sc);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      g.beginPath();
      g.arc(x + Math.cos(a) * h * 0.06, h * 0.82 + Math.sin(a) * h * 0.05, h * 0.03, 0, Math.PI * 2);
      g.fill();
    }
  }
  if (haunted) {
    // torn away in places
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      g.ellipse(r() * w, h * (0.5 + r() * 0.5), w * (0.02 + r() * 0.04), h * 0.4, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalCompositeOperation = 'source-over';
  if (haunted) {
    // dirt in the lace
    for (let i = 0; i < 30; i++) {
      g.fillStyle = `rgba(60,46,34,${0.15 + r() * 0.2})`;
      g.beginPath();
      g.arc(r() * w, r() * h, h * (0.05 + r() * 0.15), 0, Math.PI * 2);
      g.fill();
    }
  }
}

/** One glass eye in its socket; the iris and the glassy cornea turn together to look. */
function Eye({ side, haunted, iris }: { side: number; haunted: boolean; iris: THREE.Texture }) {
  const dir = EYE_DIRS[side < 0 ? 0 : 1]!;
  const centre = useMemo(() => dir.clone().multiplyScalar(HEAD.r * 0.86).setY(dir.y * HEAD.r * 0.86 * 1.07), [dir]);
  return (
    <group position={centre}>
      <group name="eyeball" userData={{ side }}>
        <mesh material={M.enamel()}>
          <sphereGeometry args={[EYE.r, 24, 18]} />
        </mesh>
        <mesh position-z={EYE.r * 0.93}>
          <circleGeometry args={[EYE.r * 0.6, 28]} />
          <meshStandardMaterial map={iris} roughness={0.3} emissive={haunted ? '#ff2a10' : '#000000'} emissiveMap={haunted ? iris : null} emissiveIntensity={haunted ? 0.9 : 0} />
        </mesh>
        {/* the glass over it */}
        <mesh position-z={EYE.r * 0.55}>
          <sphereGeometry args={[EYE.r * 0.62, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.2]} />
          <meshPhysicalMaterial color="#ffffff" transparent opacity={0.18} roughness={0.02} clearcoat={1} depthWrite={false} />
        </mesh>
      </group>
      {/* the upper lid over it, and the dark line of lashes along its edge */}
      {/* (only over the top of the eye: wide open, as on the reference) */}
      <group rotation-x={0.12}>
        <mesh material={M.dollPorcelain()}>
          <sphereGeometry args={[EYE.r * 1.12, 24, 10, 0, Math.PI * 2, 0, 0.72]} />
        </mesh>
        <mesh position-y={EYE.r * 1.12 * Math.cos(0.72)} rotation-x={Math.PI / 2}>
          <torusGeometry args={[EYE.r * 1.12 * Math.sin(0.72), 0.004, 6, 28]} />
          <meshStandardMaterial color="#2a1a12" roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

/** 0→1 over `dur` s after `delay`: a slow, steady seep (no rush in the middle); 1 for Infinity. */
function seep(s: number, dur: number, delay: number): number {
  if (s === Infinity) return 1;
  return Math.min(1, Math.max(0, (s - delay) / dur));
}

/** Blood running slowly from both eyes down her face, over the chin, dripping onto the collar. */
function BloodTears({ since }: { since: () => number }) {
  const runs = useMemo(
    () =>
      EYE_DIRS.flatMap((d, side) =>
        [0, 1].map((j) => {
          const pts: THREE.Vector3[] = [];
          const axis = new THREE.Vector3(1, 0, 0);
          for (let i = 0; i <= 14; i++) {
            const t = i / 14;
            const dd = d.clone().applyAxisAngle(axis, 0.18 + t * (0.95 + j * 0.15));
            dd.x += (side ? -1 : 1) * t * 0.03 * (j ? 1.6 : 1) + Math.sin(t * 7 + side) * 0.008;
            dd.normalize();
            pts.push(dd.multiplyScalar(HEAD.r * 1.012).setY(dd.y * HEAD.r * 1.012 * 1.07));
          }
          // off the chin and down
          const end = pts[pts.length - 1]!;
          pts.push(end.clone().add(new THREE.Vector3(0, -0.03, 0.01)), end.clone().add(new THREE.Vector3(0, -0.075, 0.02)));
          const g = sweep(new THREE.CatmullRomCurve3(pts), (t) => (j ? 0.0045 : 0.0065) * (1 - 0.35 * t) + 0.0015, 60, 6);
          return { g, side, j };
        }),
      ),
    [],
  );
  useEffect(() => () => runs.forEach((r) => r.g.dispose()), [runs]);
  useFrame(() => {
    const s = since();
    runs.forEach(({ g, side, j }) => {
      // slow and uneven, each run starting on its own, the way it seeped into the typewriter's paper
      const k = seep(s, 7 + j * 2, TAKE.bleed + side * 0.4 + j * 0.9);
      g.setDrawRange(0, Math.floor(60 * k) * 6 * 6);
    });
  });
  return (
    <>
      {runs.map(({ g, j }, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color={j ? '#3e0204' : '#5a0508'} roughness={0.18} />
        </mesh>
      ))}
    </>
  );
}

/** Ringlets round her head: [angle round the head (0 = front), drop, swing out, turns]. */
const CURLS: [number, number, number, number][] = [
  [0.95, 0.2, 0.05, 4],
  [1.15, 0.25, 0.06, 4.5],
  [1.35, 0.27, 0.07, 4],
  [1.6, 0.29, 0.06, 5],
  [1.9, 0.3, 0.05, 4.5],
  [2.2, 0.28, 0.04, 4],
  [2.55, 0.24, 0.03, 4],
  [2.9, 0.22, 0.02, 3.5],
];

/** Her hair: a cap over the crown, a fringe of short curls, and long ringlets on both sides. */
function Hair({ haunted }: { haunted: boolean }) {
  const curls = useMemo(() => {
    const out: THREE.BufferGeometry[] = [];
    let seed = 1;
    for (const s of [-1, 1]) {
      for (const [a, drop, swing, turns] of CURLS) {
        const ang = a * s;
        const top = new THREE.Vector3(Math.sin(ang) * HEAD.r * 1.0, 0.03, Math.cos(ang) * HEAD.r * 0.95);
        const out3 = new THREE.Vector3(Math.sin(ang) * swing, 0, Math.cos(ang) * swing * 0.5);
        out.push(ringlet(top, drop * (haunted ? 1.25 : 1), out3, turns, haunted ? 0.026 : 0.02, haunted ? 0.017 : 0.015, haunted ? 1 : 0, seed++));
        if (haunted) {
          // matted: a second, wilder strand off each curl
          out.push(ringlet(top.clone().add(new THREE.Vector3(0, -0.02, 0)), drop * 1.4, out3.clone().multiplyScalar(2.2), turns * 0.5, 0.04, 0.006, 3, seed++));
        }
      }
    }
    // the fringe: short curls across the forehead, under the hat brim
    for (let i = 0; i < 7; i++) {
      const ang = -0.6 + (i / 6) * 1.2;
      const top = new THREE.Vector3(Math.sin(ang) * HEAD.r * 0.9, 0.125, Math.cos(ang) * HEAD.r * 0.86);
      out.push(ringlet(top, 0.05 + (i % 2) * 0.012, new THREE.Vector3(Math.sin(ang) * 0.02, 0, 0.012), 1.3, 0.012, 0.012, haunted ? 1.5 : 0, 40 + i));
    }
    return out;
  }, [haunted]);
  useEffect(() => () => curls.forEach((g) => g.dispose()), [curls]);
  return (
    <group>
      <mesh material={M.dollHair()} position={[0, 0.012, -0.012]} rotation-x={-0.35}>
        <sphereGeometry args={[HEAD.r * 1.05, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
      </mesh>
      {curls.map((g, i) => (
        <mesh key={i} geometry={g} material={M.dollHair()} />
      ))}
    </group>
  );
}

/** The Santa hat: fur brim, a velvet cone bending over to the left, the pom-pom, holly. */
function Hat({ haunted }: { haunted: boolean }) {
  const { cone, brim, pom, leaf } = useMemo(() => {
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.0, 0.0, -0.01),
      new THREE.Vector3(0.0, 0.11, -0.03),
      new THREE.Vector3(-0.06, 0.2, -0.02),
      new THREE.Vector3(-0.19, 0.2, 0.0),
      new THREE.Vector3(-0.27, 0.07, 0.02),
      new THREE.Vector3(-0.29, -0.03, 0.03),
    ]);
    const c = sweep(path, (t) => 0.165 * (1 - t) ** 1.15 + 0.012, 64, 28);
    if (haunted) {
      // torn: the cone sags and its edge is ragged
      const p = c.attributes.position as THREE.BufferAttribute;
      const r = seeded(9);
      for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + (r() - 0.5) * 0.008);
      c.computeVertexNormals();
    }
    return { cone: c, brim: furRing(0.185, 0.034, 3), pom: furBall(0.06, 4), leaf: hollyLeaf() };
  }, [haunted]);
  useEffect(
    () => () => {
      cone.dispose();
      brim.dispose();
      pom.dispose();
      leaf.dispose();
    },
    [cone, brim, pom, leaf],
  );
  return (
    <group position={[0, 0.12, -0.005]} rotation={[-0.32, 0, 0.06]}>
      <mesh geometry={cone} material={M.dollVelvet()} />
      <mesh geometry={brim} material={M.dollFur()} rotation-x={Math.PI / 2} scale={[1, 1, 0.9]} />
      <mesh geometry={pom} material={M.dollFur()} position={[-0.29, -0.06, 0.03]} />
      {/* holly: three leaves and three berries, at the front of the brim */}
      <group position={[-0.08, 0.035, 0.16]} rotation={[0.3, 0, 0]}>
        {[-0.7, 0.2, 1.1].map((a, i) => (
          <mesh key={i} geometry={leaf} rotation-z={a} position={[Math.sin(a) * 0.004, 0, 0.002 * i]}>
            <meshStandardMaterial color={haunted ? '#2f3a26' : '#2f6a2c'} roughness={0.35} />
          </mesh>
        ))}
        {[
          [0.012, 0.004],
          [0.024, -0.006],
          [0.026, 0.012],
        ].map(([x, y], i) => (
          <mesh key={i} position={[x!, y!, 0.012]}>
            <sphereGeometry args={[0.01, 10, 8]} />
            <meshStandardMaterial color={haunted ? '#5a1a16' : '#c8141c'} roughness={0.25} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** The teddy in her arms: tan plush, a red bow; after the Reveal, stitched up, one eye an X. */
function SmallTeddy({ haunted }: { haunted: boolean }) {
  return (
    <group position={[-0.03, 0.37, 0.17]} rotation={[0.1, 0.25, 0.1]}>
      <mesh material={M.plush()} scale={[1, 1.1, 0.85]}>
        <sphereGeometry args={[0.058, 20, 16]} />
      </mesh>
      <mesh material={M.plush()} position={[0, 0.075, 0.01]}>
        <sphereGeometry args={[0.048, 20, 16]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={M.plush()} position={[s * 0.036, 0.112, 0]}>
          <sphereGeometry args={[0.017, 12, 10]} />
        </mesh>
      ))}
      <mesh material={M.plush()} position={[0, 0.064, 0.046]} scale={[1, 0.8, 0.7]}>
        <sphereGeometry args={[0.02, 12, 10]} />
      </mesh>
      <mesh material={M.ink()} position={[0, 0.07, 0.06]}>
        <sphereGeometry args={[0.006, 8, 6]} />
      </mesh>
      {[-1, 1].map((s) =>
        haunted && s > 0 ? (
          // the X stitched where an eye was
          <group key={s} position={[s * 0.018, 0.086, 0.044]}>
            {[0.7, -0.7].map((r) => (
              <mesh key={r} material={M.ink()} rotation-z={r}>
                <boxGeometry args={[0.016, 0.003, 0.003]} />
              </mesh>
            ))}
          </group>
        ) : (
          <mesh key={s} material={M.ink()} position={[s * 0.018, 0.086, 0.043]}>
            <sphereGeometry args={[0.005, 8, 6]} />
          </mesh>
        ),
      )}
      {/* the red bow at its neck */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={M.dollVelvet()} position={[s * 0.022, 0.04, 0.042]} rotation-z={s * 0.5} scale={[1.2, 0.7, 0.5]}>
          <sphereGeometry args={[0.016, 10, 8]} />
        </mesh>
      ))}
      {haunted && (
        // stitches across its belly
        <mesh material={M.ink()} position={[0.01, -0.01, 0.05]} rotation-z={0.4}>
          <boxGeometry args={[0.05, 0.003, 0.003]} />
        </mesh>
      )}
    </group>
  );
}

/** Body: bodice, collar, bow and bell, sleeves with fur cuffs, porcelain hands, skirt, lace, boots. */
function Body({ haunted, lace }: { haunted: boolean; lace: THREE.Texture }) {
  const g = useMemo(() => {
    const bodice = new THREE.LatheGeometry(
      [
        [0.0, 0.33],
        [0.118, 0.335],
        [0.122, 0.4],
        [0.128, 0.46],
        [0.11, 0.51],
        [0.075, 0.545],
        [0.0, 0.55],
      ].map(([r, y]) => new THREE.Vector2(r!, y!)),
      48,
    );
    bodice.scale(1, 1, 0.75);
    const sleeve = (s: number) =>
      sweep(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(s * 0.12, 0.505, -0.01),
          new THREE.Vector3(s * 0.168, 0.45, 0.02),
          new THREE.Vector3(s * 0.165, 0.39, 0.08),
          new THREE.Vector3(s * 0.11, 0.35, 0.15),
        ]),
        (t) => 0.055 - 0.012 * t + 0.008 * Math.sin(t * Math.PI),
        40,
        18,
      );
    return {
      bodice,
      sleeves: [sleeve(-1), sleeve(1)],
      skirt: skirtGeometry(haunted),
      lace1: laceBand(0.165, 0.215, 0.006),
      lace2: laceBand(0.05, 0.105, 0.03),
      collar: furRing(0.085, 0.028, 11),
      cuff: furRing(0.045, 0.02, 12),
    };
  }, [haunted]);
  useEffect(() => () => Object.values(g).flat().forEach((x) => x.dispose()), [g]);
  const laceMat = <meshStandardMaterial map={lace} alphaTest={0.4} side={THREE.DoubleSide} roughness={0.9} />;
  return (
    <group>
      <mesh geometry={g.bodice} material={M.dollVelvet()} />
      {/* the lace front of the bodice */}
      <mesh position={[0, 0.44, 0.088]} rotation-x={-0.12}>
        <planeGeometry args={[0.07, 0.17]} />
        {laceMat}
      </mesh>
      <mesh geometry={g.collar} material={M.dollFur()} position-y={0.535} rotation-x={Math.PI / 2 - 0.25} />
      {/* the red bow and the gold bell at her throat */}
      <group position={[0, 0.515, 0.11]}>
        {[-1, 1].map((s) => (
          <mesh key={s} material={M.dollVelvet()} position={[s * 0.04, 0, 0]} rotation-z={s * 0.35} scale={[1.5, 0.85, 0.55]}>
            <sphereGeometry args={[0.03, 16, 12]} />
          </mesh>
        ))}
        {[-1, 1].map((s) => (
          <mesh key={`t${s}`} material={M.dollVelvet()} position={[s * 0.02, -0.04, 0.0]} rotation-z={s * 0.3}>
            <boxGeometry args={[0.018, 0.05, 0.008]} />
          </mesh>
        ))}
        <mesh material={M.dollVelvet()} scale={[1, 0.9, 0.7]}>
          <sphereGeometry args={[0.016, 12, 10]} />
        </mesh>
        <mesh material={M.brass()} position={[0, -0.03, 0.01]}>
          <sphereGeometry args={[0.017, 16, 12]} />
        </mesh>
      </group>
      {g.sleeves.map((s, i) => (
        <mesh key={i} geometry={s} material={M.dollVelvet()} />
      ))}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={g.cuff} material={M.dollFur()} position={[s * 0.115, 0.352, 0.15]} rotation={[0.9, s * 0.7, 0]} />
          {/* her hand, holding the teddy */}
          <mesh material={M.dollPorcelain()} position={[s * 0.062, 0.336, 0.205]} rotation={[0, 0, s * 0.4]} scale={[1.2, 0.8, 0.7]}>
            <sphereGeometry args={[0.03, 16, 12]} />
          </mesh>
        </group>
      ))}
      <mesh geometry={g.skirt} material={M.dollVelvet()} />
      <mesh geometry={g.lace1}>{laceMat}</mesh>
      <mesh geometry={g.lace2}>{laceMat}</mesh>
      {/* her boots, poking out from under the hem */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.072, 0.045, 0.46]} rotation-y={s * -0.08}>
          <mesh material={M.leather()} rotation-x={Math.PI / 2} scale={[1, 1, 0.8]}>
            <capsuleGeometry args={[0.042, 0.06, 8, 16]} />
          </mesh>
          <mesh material={M.leatherSole()} position={[0, -0.034, 0]}>
            <boxGeometry args={[0.086, 0.012, 0.15]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** The lace repeats round the skirt (outside the component). */
function repeatAround(t: THREE.Texture) {
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(6, 1);
  t.needsUpdate = true;
}

const awayQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.3, -0.42, 0));
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const tmpP = new THREE.Vector3();

/** Turn both eyeballs: by day straight ahead; haunted, off to the corner; taken, onto you (outside the component). */
function aimEyes(head: THREE.Object3D, camera: THREE.Camera, haunted: boolean, k: number) {
  head.updateWorldMatrix(true, true);
  head.traverse((o) => {
    if (o.name !== 'eyeball') return;
    const from = haunted ? awayQ : tmpQ.identity();
    // looking at the camera, in the eye's own frame
    o.getWorldPosition(tmpP);
    tmpV.copy(camera.position);
    tmpM.lookAt(tmpV, tmpP, THREE.Object3D.DEFAULT_UP);
    const atYou = new THREE.Quaternion().setFromRotationMatrix(tmpM);
    const parentQ = new THREE.Quaternion();
    o.parent?.getWorldQuaternion(parentQ);
    atYou.premultiply(parentQ.invert());
    o.quaternion.copy(from).slerp(atYou, k);
  });
}

/**
 * The doll (Requirement 15), rebuilt from the round 11 references, Christmas and haunted.
 * Taken (after the Reveal): her head comes upright from where it hung, her eyes turn onto you,
 * and blood runs out of both of them, slowly, down her face.
 */
export default function Doll() {
  const haunted = useHaunted();
  const { taken, since } = useTaken('doll');
  const head = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const face = useCanvasTexture(512, 512, (g, w, h) => drawFace(g, w, h, haunted), [haunted]);
  const iris = useCanvasTexture(128, 128, (g, w, h) => drawIris(g, w, h, haunted), [haunted]);
  const lace = useCanvasTexture(512, 64, (g, w, h) => drawLace(g, w, h, haunted), [haunted]);
  useEffect(() => repeatAround(lace), [lace]);
  const headGeo = useMemo(() => headGeometry(), []);
  useEffect(() => () => headGeo.dispose(), [headGeo]);
  useFrame((st) => {
    const h = head.current;
    if (!h) return;
    const s = since();
    // haunted, her head hangs to one side; taken, it comes slowly upright, with one small jerk
    const up = taken ? progress(s, TAKE.straighten, 0.15) : 0;
    const jerk = taken && s > 0.15 + TAKE.straighten && s < 0.45 + TAKE.straighten ? Math.sin((s - 0.15 - TAKE.straighten) * 30) * 0.015 : 0;
    const k = haunted ? 1 - up : 0;
    h.rotation.set(TILT.x * k, 0, TILT.z * k + jerk + (haunted && !taken ? Math.sin(st.clock.elapsedTime * 0.3) * 0.004 : 0));
    const look = taken ? progress(s, TAKE.lookFor, TAKE.look) : 0;
    aimEyes(h, camera, haunted, haunted ? look : 0);
  });
  return (
    <group position-y={-0.56} rotation-y={-0.12} scale={1.15}>
      <Body haunted={haunted} lace={lace} />
      <SmallTeddy haunted={haunted} />
      <group ref={head} position-y={NECK_Y}>
        <group position-y={HEAD.y - NECK_Y}>
          {/* the neck */}
          <mesh material={M.dollPorcelain()} position-y={-0.15}>
            <cylinderGeometry args={[0.045, 0.055, 0.08, 20]} />
          </mesh>
          <mesh geometry={headGeo} material={M.dollPorcelain()}>
            <Decal position={[0, 0, HEAD.r * 0.9]} rotation={[0, 0, 0]} scale={[0.3, 0.34, 0.3]}>
              <meshStandardMaterial map={face} transparent polygonOffset polygonOffsetFactor={-10} depthWrite={false} roughness={0.35} />
            </Decal>
          </mesh>
          {[-1, 1].map((s) => (
            <Eye key={s} side={s} haunted={haunted} iris={iris} />
          ))}
          <Hair haunted={haunted} />
          <Hat haunted={haunted} />
          {haunted && taken && <BloodTears since={since} />}
        </group>
      </group>
    </group>
  );
}
