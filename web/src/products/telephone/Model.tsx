import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useCanvasTexture } from '../../gl/canvasTex';
import { M } from '../../gl/materials';
import { useFx } from '../../fx/fxStore';
import { progress, useTaken } from '../../gl/useTaken';

const V3 = THREE.Vector3;

/*
 * A 1930s desk telephone, the kind with a sloped front and a cradle on top: a heavy bakelite
 * body on a base plate, a finger-wheel dial with ten holes over a printed number ring and a
 * finger stop, a forked cradle, a handset with a bowed handle and two cups, and a coiled cord.
 */

/** The body's side profile (z forward, y up), extruded across its width. */
const BODY_PROFILE: [number, number][] = [
  [0.42, -0.29],
  [0.4, -0.18],
  [0.08, 0.13],
  [-0.3, 0.15],
  [-0.4, -0.29],
];
const BODY_W = 0.78;
/** The sloped front the dial sits on: its middle and its outward normal. */
const FACE_N = new V3(0, 0.32, 0.34).normalize();
const DIAL_AT = new V3(0, -0.025, 0.24).addScaledVector(FACE_N, 0.064);
const DIAL_TILT = Math.atan2(FACE_N.z, FACE_N.y);
const DIAL_R = 0.19;
const HOLE_R = 0.029;
const HOLE_RING = 0.135;
/** Where the handset rests across the cradle, and where its cord leaves the body. */
const REST = new V3(0, 0.4, -0.1);
const CORD_FROM = new V3(-0.36, -0.14, 0.0);
/** The cord's end on the handset (mouthpiece end), in the handset's own frame. */
const CORD_TO = new V3(-0.44, -0.1, 0);
/** How the whole telephone is turned to the camera (a 3/4 view). */
const ROOT_ROT: [number, number, number] = [0.28, -0.42, 0];
/** Lifted: held to the ear of someone who is not there (see heldToEar). */
const LIFTED = new V3(0.6, 0.62, 0.2);
const LIFTED_Q = heldToEar();
const LIFT_S = 0.75;
/** The table top the drops fall onto. */
const TABLE_Y = -0.33;

/**
 * The handset's turn when it is held to an ear, the way a person on the telephone holds it.
 * Worked out in view space (camera on +z), then put in the telephone's own turned frame.
 * The head is to the right of the handset and a little toward the camera, so the earpiece cup
 * faces it and the viewer still sees into the cup at about 45°. The handset's axis leans about
 * 30° off vertical: earpiece up at the ear, mouthpiece down and forward at the mouth.
 * In the handset's frame: +x runs mouthpiece → earpiece, −y is the way the cups face (the
 * head), +z is the front of the handle (toward the face's front, and up).
 */
function heldToEar() {
  const up = new V3(0, 1, 0);
  const toHead = new V3(0.72, -0.04, 0.69).normalize();
  const right = toHead.clone().negate(); // the side of the head the handset is on
  const facing = new V3().crossVectors(up, right).normalize(); // the way the face looks
  const lean = 0.52;
  const axis = up.clone().multiplyScalar(Math.cos(lean)).addScaledVector(facing, -Math.sin(lean)).normalize();
  const y = right.clone().addScaledVector(axis, -right.dot(axis)).normalize();
  const z = new V3().crossVectors(axis, y);
  const view = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(axis, y, z));
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(...ROOT_ROT)).invert().multiply(view);
}
/** Which way is down in the lifted handset's frame (blood runs and drops that way). */
const DOWN = new V3(0, -1, 0)
  .applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(...ROOT_ROT)).invert())
  .applyQuaternion(LIFTED_Q.clone().invert());

function bodyGeometry() {
  const s = new THREE.Shape();
  BODY_PROFILE.forEach(([z, y], i) => (i ? s.lineTo(z, y) : s.moveTo(z, y)));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: BODY_W, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 5, curveSegments: 8 });
  // shape x is the depth (z), the extrusion runs across the width (x)
  g.rotateY(-Math.PI / 2);
  g.translate(BODY_W / 2, 0, 0);
  g.computeVertexNormals();
  return g;
}

/** The finger wheel: a disc with ten finger holes and an open middle where the number card shows. */
function wheelGeometry() {
  const s = new THREE.Shape();
  s.absarc(0, 0, DIAL_R, 0, Math.PI * 2, false);
  for (let i = 0; i < 10; i++) {
    const a = holeAngle(i);
    const h = new THREE.Path();
    h.absarc(Math.cos(a) * HOLE_RING, Math.sin(a) * HOLE_RING, HOLE_R, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  const mid = new THREE.Path();
  mid.absarc(0, 0, 0.066, 0, Math.PI * 2, true);
  s.holes.push(mid);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 24 });
  // lie flat with its face up (the dial group turns it onto the sloped front)
  g.rotateX(-Math.PI / 2);
  return g;
}

/** The finger holes run round from 1 o'clock to about 7, leaving room for the finger stop. */
function holeAngle(i: number) {
  return Math.PI * 0.36 + (i / 9) * Math.PI * 1.45;
}

/** The handle: a bowed bar from the mouthpiece to the earpiece (its centre line and radius). */
const HANDLE_LINE = new THREE.CatmullRomCurve3([new V3(-0.38, -0.05, 0), new V3(-0.2, 0.025, 0), new V3(0, 0.04, 0), new V3(0.2, 0.025, 0), new V3(0.38, -0.05, 0)]);
const HANDLE_R = 0.046;
function handleGeometry() {
  return new THREE.TubeGeometry(HANDLE_LINE, 40, HANDLE_R, 14, false);
}

/** The handle's curve parameter at a given x along it (x only grows along the handle). */
function handleT(x: number) {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const m = (lo + hi) / 2;
    if (HANDLE_LINE.getPoint(m).x < x) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

/**
 * A point round the handle, in the handset's frame: `x` along it, `deg` round it (0 = the
 * outer side, away from the head; 90 = the front; 180 = the side the cups face, the head),
 * `r` out from its centre line (HANDLE_R is on its surface).
 */
function onHandle(x: number, deg: number, r: number) {
  const t = handleT(x);
  const p = HANDLE_LINE.getPoint(t);
  const tan = HANDLE_LINE.getTangent(t);
  const out = new V3(-tan.y, tan.x, 0).normalize();
  const a = (deg * Math.PI) / 180;
  return p.addScaledVector(out, Math.cos(a) * r).add(new V3(0, 0, Math.sin(a) * r));
}

/** A coiled cord between two points, sagging between them. */
function cordGeometry(a: THREE.Vector3, b: THREE.Vector3) {
  const mid = a.clone().lerp(b, 0.5);
  mid.y = Math.min(a.y, b.y) - 0.12 - a.distanceTo(b) * 0.12;
  const path = new THREE.CatmullRomCurve3([a, a.clone().lerp(mid, 0.5).setY(a.y - 0.08), mid, b.clone().lerp(mid, 0.45), b]);
  const pts: THREE.Vector3[] = [];
  const turns = 34;
  const n = 260;
  const up = new V3(0, 1, 0);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = path.getPointAt(t);
    const tan = path.getTangentAt(t);
    const side = new V3().crossVectors(tan, up);
    if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
    side.normalize();
    const nrm = new V3().crossVectors(side, tan).normalize();
    const a2 = t * turns * Math.PI * 2;
    pts.push(p.addScaledVector(side, Math.cos(a2) * 0.018).addScaledVector(nrm, Math.sin(a2) * 0.018));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, 0.0065, 5, false);
}

/** The printed number ring under the finger wheel: cream card, black numerals, a fine ring. */
function drawNumbers(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = '#efe6cf';
  g.fillRect(0, 0, w, h);
  const c = w / 2;
  const k = w / 2 / DIAL_R;
  g.fillStyle = '#1a1512';
  g.font = `bold ${Math.round(w * 0.07)}px Georgia, serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const labels = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  labels.forEach((t, i) => {
    const a = holeAngle(i);
    // canvas y runs down, the dial's y runs up
    g.fillText(t, c + Math.cos(a) * HOLE_RING * k, c - Math.sin(a) * HOLE_RING * k);
  });
  g.strokeStyle = '#7a1a16';
  g.lineWidth = w * 0.01;
  g.beginPath();
  g.arc(c, c, 0.058 * k, 0, Math.PI * 2);
  g.stroke();
  g.font = `${Math.round(w * 0.04)}px Georgia, serif`;
  g.fillText('EXCHANGE', c, c - w * 0.012);
  g.fillText('1934', c, c + w * 0.04);
}

/** The earpiece's cup in the handset's frame: its face (with the holes) and how wide it is. */
const EAR_FACE = new V3(0.44, -0.127, 0);
const EAR_R = 0.115 * 0.82;

/**
 * The hand that holds the lifted receiver. It is never drawn: it is only where the blood
 * cannot go. A right hand, in the handset's frame (see onHandle for the angles round the
 * handle), gripping the middle of the handle the way you hold a receiver to your ear:
 * - four fingers wrapped round the front, index nearest the earpiece, each a band 0.02 wide
 *   and 0.02 thick that leaves the palm at the outer side (the knuckles), goes over the top
 *   and round the front, and ends with its tip on the side toward the head;
 * - the thumb lying along the back of the handle, pointing at the earpiece;
 * - the palm against the back, its heel on the side toward the head;
 * - the wrist leaving the heel downward and back toward the body.
 */
const HAND = {
  fingers: [
    { x: 0.0525, knuckle: -35, tip: 168 },
    { x: 0.0175, knuckle: -35, tip: 174 },
    { x: -0.0175, knuckle: -35, tip: 172 },
    { x: -0.0525, knuckle: -35, tip: 160 },
  ],
  /** The backs of the fingers, out from the handle's centre line. */
  fingerBack: HANDLE_R + 0.02,
  thumb: { deg: -110, from: -0.01, to: 0.1, r: HANDLE_R + 0.012 },
  /** The palm wraps the back from the knuckles round to its heel, which is where blood gathers. */
  palm: { from: -40, heel: 190, halfWidth: 0.072, edgeR: HANDLE_R + 0.023 },
  wrist: { at: onHandle(-0.005, 197, 0.064), dir: new V3(-0.6, -0.65, -0.35).normalize(), halfWidth: 0.046, halfThick: 0.03 },
};
/** The wrist's cross-section axes: across it (index side +) and through it (palm side +). */
const WRIST_ACROSS = new V3(1, 0, 0).addScaledVector(HAND.wrist.dir, -HAND.wrist.dir.x).normalize();
const WRIST_THROUGH = new V3().crossVectors(HAND.wrist.dir, WRIST_ACROSS).normalize();

/** A point on the wrist's skin: `s` along it from the heel, `deg` round it (0 = index side,
 * 90 = the inside of the wrist, toward the viewer; 180 = little-finger side, the low edge). */
function onWrist(s: number, deg: number, lift = 0.004) {
  const a = (deg * Math.PI) / 180;
  const w = HAND.wrist;
  return w.at
    .clone()
    .addScaledVector(w.dir, s)
    .addScaledVector(WRIST_ACROSS, Math.cos(a) * (w.halfWidth + lift))
    .addScaledVector(WRIST_THROUGH, Math.sin(a) * (w.halfThick + lift));
}

/** Where the blood runs between and beside the fingers: above the index, in the three gaps,
 * below the little finger. Lifted off the handle to the fingers' sides, so the fingers show as
 * bare handle between the lines. */
const LINE_X = HAND.fingers.flatMap((f, i, all) => {
  const next = all[i + 1];
  if (i === 0) return next ? [f.x + 0.015, (f.x + next.x) / 2] : [f.x + 0.015];
  return next ? [(f.x + next.x) / 2] : [f.x - 0.015];
});
const LINE_TIP = LINE_X.map((_, i) => {
  const a = HAND.fingers[i - 1];
  const b = HAND.fingers[i];
  return a && b ? (a.tip + b.tip) / 2 : (a ?? b)!.tip - 2;
});
const EDGE_R = HANDLE_R + 0.01;
const GROOVE_R = HANDLE_R + 0.013;
/** Where each line spills over the finger above it (over the knuckles) from the line before. */
const CROSS_AT = [0, 112, 127, 118, 136];

/** The cup's outer wall, from its face (y −0.125, wide) up to the handle (y −0.035, narrow). */
const CUP_DIR = new V3(-0.84, 0, 0.54).normalize();
function onCup(y: number, r?: number) {
  const rr = r ?? 0.085 + ((-0.035 - y) / 0.09) * 0.03 + 0.005;
  return new V3(EAR_FACE.x + CUP_DIR.x * rr, y, CUP_DIR.z * rr);
}

/** The run from the holes: across the face of the cup, over its rim, down its side and down the
 * front of the handle to the index finger. */
function trunkLine() {
  const face = (r: number) => onCup(-0.131, r);
  return [
    face(0),
    face(0.04),
    face(0.085),
    onCup(-0.13, 0.114),
    onCup(-0.118),
    onCup(-0.095),
    onCup(-0.072),
    onCup(-0.058),
    onHandle(0.33, 100, 0.051),
    onHandle(0.27, 104, 0.051),
    onHandle(0.2, 106, 0.051),
    onHandle(0.14, 104, 0.051),
    onHandle(0.1, 103, 0.051),
    onHandle(0.08, 99, 0.051),
  ];
}

/** One line round the hand: it comes over the finger above it (or, for the first, off the
 * trunk), follows the finger's curve round the front to its tip, and drops onto the palm's heel. */
function fingerLine(i: number, r: number) {
  const x = LINE_X[i]!;
  const lr = i === 0 || i === LINE_X.length - 1 ? EDGE_R : GROOVE_R;
  const pts: THREE.Vector3[] = [];
  let a0 = 103;
  if (i === 0) pts.push(onHandle(0.08, 99, 0.051), onHandle(x, a0, lr));
  else {
    const f = HAND.fingers[i - 1]!.x;
    const prev = LINE_X[i - 1]!;
    const a = CROSS_AT[i]!;
    const over = HAND.fingerBack + r * 0.7;
    pts.push(onHandle(prev, a, i === 1 ? EDGE_R : GROOVE_R), onHandle(f + 0.005, a + 1.5, over), onHandle(f - 0.005, a + 3, over), onHandle(x, a + 5, lr));
    a0 = a + 5;
  }
  const tip = LINE_TIP[i]!;
  const n = Math.max(2, Math.round((tip - a0) / 12));
  for (let k = 1; k <= n; k++) {
    const a = a0 + ((tip - a0) * k) / n;
    // fingers in a fist lean a little toward the little finger, and are not ruled lines
    pts.push(onHandle(x - (0.004 * (a - a0)) / 60 + Math.sin(a * 0.11 + i) * 0.0015, a, lr));
  }
  pts.push(onHandle(x - 0.003, tip + 9, 0.062), onHandle(x - 0.003, HAND.palm.heel, HAND.palm.edgeR));
  return pts;
}

type Run = { pts: THREE.Vector3[]; r: number; at: number; dur: number };
/** The ends of the gathering line along the palm's heel. */
const HEEL_TOP = onHandle(0.064, HAND.palm.heel, HAND.palm.edgeR);
const HEEL_LOW = onHandle(-0.07, HAND.palm.heel, HAND.palm.edgeR);
/** The low point of the wrist where it drips from, and the drop under it. */
const WRIST_END = onWrist(0.215, 190);
const CAP_AT = WRIST_END.clone().addScaledVector(DOWN, 0.006);
const DRIP_LOCAL = onWrist(0.215, 195).addScaledVector(DOWN, 0.014);
const DRIP_AT = DRIP_LOCAL.clone().applyMatrix4(new THREE.Matrix4().compose(LIFTED, LIFTED_Q, new V3(1, 1, 1)));
/** Seconds after the Take: when each run starts and how long it takes to reach its end. */
const T0 = LIFT_S + 0.4;
const DRIPS_AT = LIFT_S + 5.35;
const RUNS: Run[] = [
  { pts: trunkLine(), r: 0.011, at: T0, dur: 1.6 },
  ...[0.009, 0.008, 0.0075, 0.008, 0.0075].map((r, i) => ({ pts: fingerLine(i, r), r, at: T0 + 1.6 + i * 0.32, dur: 0.9 })),
  // gathering along the heel of the palm
  {
    pts: [HEEL_TOP, onHandle(0.03, HAND.palm.heel + 1, HAND.palm.edgeR), onHandle(0, HAND.palm.heel + 1.5, HAND.palm.edgeR), onHandle(-0.035, HAND.palm.heel + 1, HAND.palm.edgeR), HEEL_LOW],
    r: 0.009,
    at: T0 + 2.5,
    dur: 1.5,
  },
  // down the inside of the wrist, curling under it to the low edge
  { pts: [HEEL_TOP, onWrist(0.035, 35), onWrist(0.085, 48), onWrist(0.135, 62), onWrist(0.175, 100), onWrist(0.205, 150), onWrist(0.214, 182)], r: 0.008, at: T0 + 2.55, dur: 2.2 },
  // down the little-finger edge of the wrist to where it drips
  { pts: [HEEL_LOW, onWrist(0.03, 182), onWrist(0.08, 180), onWrist(0.14, 182), onWrist(0.2, 186), WRIST_END], r: 0.009, at: T0 + 3.95, dur: 0.9 },
];
const RUN_LINES = RUNS.map((r) => new THREE.CatmullRomCurve3(r.pts));

/** 0→1 at a steady pace (blood runs at its own speed, it does not ease in); 1 for Infinity. */
function along(s: number, dur: number, delay: number) {
  if (s === Infinity) return 1;
  return Math.min(1, Math.max(0, (s - delay) / dur));
}

/** Shows each run up to where the blood has got to, with a bead at its front while it runs. */
function showRuns(s: number, geos: THREE.TubeGeometry[], beads: (THREE.Mesh | null)[]) {
  RUNS.forEach((run, i) => {
    const g = geos[i];
    if (!g) return;
    const k = along(s, run.dur, run.at);
    const { tubularSegments, radialSegments } = g.parameters;
    g.setDrawRange(0, Math.floor(tubularSegments * k) * radialSegments * 6);
    const b = beads[i];
    if (!b) return;
    b.visible = k > 0 && k < 1;
    if (b.visible) RUN_LINES[i]!.getPointAt(k, b.position);
  });
}

/**
 * Blood: out of the earpiece holes, and down over a hand that is not there. It wells out of the
 * holes and spreads over the face of the cup, runs over the rim, down the side of the cup and
 * down the front of the handle until it meets the index finger. From there it cannot touch the
 * handle: it runs along the fingers' edges and over their knuckles, round their curve to the
 * fingertips, so the four fingers show as bare black handle between thin red lines. It gathers
 * along the heel of the palm, runs down the wrist in the air, and drips off the wrist's low edge.
 */
function HandsetBlood({ since }: { since: () => number }) {
  const geos = useMemo(() => RUN_LINES.map((c, i) => new THREE.TubeGeometry(c, Math.max(24, Math.round(c.getLength() * 420)), RUNS[i]!.r, 6, false)), []);
  const blood = useMemo(() => new THREE.MeshStandardMaterial({ color: '#560509', roughness: 0.12, metalness: 0.05 }), []);
  useEffect(
    () => () => {
      geos.forEach((g) => g.dispose());
      blood.dispose();
    },
    [geos, blood],
  );
  const film = useRef<THREE.Mesh>(null);
  const cap = useRef<THREE.Mesh>(null);
  const beads = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const s = since();
    // it comes out of the holes as soon as it is held to the ear, and spreads over the face
    if (film.current) film.current.scale.setScalar(Math.max(0.01, progress(s, 1.4, LIFT_S + 0.1)));
    showRuns(s, geos, beads.current);
    if (cap.current) cap.current.scale.setScalar(Math.max(0.01, progress(s, 0.5, DRIPS_AT - 0.45)));
  });
  return (
    <group>
      {/* the wet face of the cup, over the holes */}
      <mesh ref={film} position={[EAR_FACE.x, EAR_FACE.y - 0.002, EAR_FACE.z]} rotation-x={Math.PI / 2} scale={0.01}>
        <circleGeometry args={[EAR_R * 0.95, 28]} />
        <meshStandardMaterial color="#4e0406" roughness={0.1} side={THREE.DoubleSide} />
      </mesh>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} material={blood} />
      ))}
      {RUNS.map((run, i) => (
        <mesh
          key={i}
          ref={(m) => {
            beads.current[i] = m;
          }}
          material={blood}
          visible={false}
        >
          <sphereGeometry args={[run.r * 1.35, 8, 6]} />
        </mesh>
      ))}
      {/* gathering on the low edge of the wrist, where it drips from */}
      <mesh ref={cap} position={CAP_AT} scale={0.01}>
        <sphereGeometry args={[0.011, 12, 10]} />
        <meshStandardMaterial color="#4e0406" roughness={0.12} />
      </mesh>
    </group>
  );
}

/** The drops that fall from the wrist under the lifted handset, and the pool they make. */
function Drips({ since, from, start }: { since: () => number; from: THREE.Vector3; start: number }) {
  const drops = useRef<(THREE.Mesh | null)[]>([]);
  const pool = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const s = since();
    const fall = from.y - TABLE_Y;
    drops.current.forEach((m, i) => {
      if (!m) return;
      if (s === Infinity || s < start) {
        m.visible = s === Infinity && i === 0;
        m.position.copy(from);
        return;
      }
      // one drop at a time, drip, drip: hangs, swells, lets go, falls
      const period = 0.75;
      const t = ((s - start + i * (period / 3)) % period) / period;
      m.visible = true;
      const hang = Math.min(1, t / 0.35);
      const f = Math.max(0, (t - 0.35) / 0.65);
      m.position.set(from.x, from.y - 0.01 * hang - f * f * fall, from.z);
      m.scale.set(0.6 + 0.4 * hang, (0.6 + 0.4 * hang) * (1 + f * 0.8), 0.6 + 0.4 * hang);
    });
    if (pool.current) pool.current.scale.setScalar(Math.max(0.01, progress(s, 5, start + 0.4)));
  });
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(m) => {
            drops.current[i] = m;
          }}
          visible={false}
        >
          <sphereGeometry args={[0.012, 10, 8]} />
          <meshStandardMaterial color="#5a0507" roughness={0.12} />
        </mesh>
      ))}
      <mesh ref={pool} position={[from.x, TABLE_Y + 0.003, from.z]} rotation-x={-Math.PI / 2} scale={0.01}>
        <circleGeometry args={[0.16, 28]} />
        <meshLambertMaterial color="#3a0306" />
      </mesh>
    </group>
  );
}

/**
 * The telephone (Requirement 21): the handset rattles in its cradle while it rings. Taken, the
 * receiver is picked up by no one, at the speed a hand would lift it, and held the way a person
 * on the telephone holds it: earpiece at an ear that is not there, mouthpiece at a mouth, the
 * handset leaning, breathing with them. Then blood comes out of the earpiece holes and runs down
 * the receiver over the hand that holds it: round fingers that are not there, along a palm and
 * down a wrist in the air, and drips off the wrist, drop by drop, onto the table. Nothing is
 * drawn of the hand; you see it only by where the blood goes. Someone unseen keeps trying the
 * dial, a little this way, a little that way.
 */
export default function Telephone({ open = false }: { open?: boolean }) {
  const handset = useRef<THREE.Group>(null);
  const wheel = useRef<THREE.Group>(null);
  const cord = useRef<THREE.Mesh>(null);
  const lastEnd = useRef(new V3(1e9, 0, 0));
  const ringing = useFx((s) => s.cartRinging) || open;
  const { taken, since } = useTaken('telephone');
  const body = useMemo(() => bodyGeometry(), []);
  const wheelGeo = useMemo(() => wheelGeometry(), []);
  const handle = useMemo(() => handleGeometry(), []);
  const numbers = useCanvasTexture(256, 256, drawNumbers, []);
  useEffect(
    () => () => {
      body.dispose();
      wheelGeo.dispose();
      handle.dispose();
    },
    [body, wheelGeo, handle],
  );
  useFrame((st) => {
    const h = handset.current;
    if (!h) return;
    const t = st.clock.elapsedTime;
    if (wheel.current) {
      const tries = taken ? Math.sin(t * 1.7) * 0.22 + Math.sin(t * 4.3 + 1.1) * 0.08 + Math.sin(t * 0.6) * 0.1 : 0;
      wheel.current.rotation.y = tries;
    }
    if (taken) {
      holdHandset(h, progress(since(), LIFT_S), t);
    } else {
      // ring pattern: two short rattles, then a pause
      const on = ringing && t % 3 < 1.4 && Math.floor(t * 18) % 2 === 0;
      h.position.set(REST.x, REST.y + (on ? 0.022 : 0), REST.z);
      h.rotation.set(0, 0, on ? 0.03 : 0);
      if (ringing) st.invalidate();
    }
    // the cord follows the handset (rebuilt only while it moves)
    h.updateMatrix();
    const end = CORD_TO.clone().applyMatrix4(h.matrix);
    // (not for the ringing rattle: too small to see, and the coil is costly to rebuild)
    const first = lastEnd.current.x === 1e9;
    if (cord.current && (first || taken) && end.distanceToSquared(lastEnd.current) > 1e-6) {
      lastEnd.current.copy(end);
      setCord(cord.current, end);
    }
  });
  return (
    <group rotation={ROOT_ROT} position-y={0.02} scale={0.92}>
      {/* the base plate, felt underneath */}
      <mesh material={M.bakelite()} position-y={-0.315}>
        <boxGeometry args={[0.96, 0.04, 0.98]} />
      </mesh>
      <mesh geometry={body} material={M.bakelite()} />
      {/* the dial on the sloped front */}
      <group position={DIAL_AT} rotation-x={DIAL_TILT}>
        {/* the printed number ring, seen through the finger holes */}
        <mesh position-y={0.001} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[DIAL_R * 1.03, 48]} />
          <meshStandardMaterial map={numbers} roughness={0.5} />
        </mesh>
        <group ref={wheel} position-y={0.004}>
          <mesh geometry={wheelGeo} material={M.silver()} />
        </group>
        {/* the finger stop: a steel hook in the gap past the 0 */}
        <mesh material={M.silver()} position={[Math.cos(-0.12) * 0.172, 0.03, Math.sin(0.12) * 0.172]} rotation-y={-0.12}>
          <boxGeometry args={[0.016, 0.014, 0.06]} />
        </mesh>
      </group>
      {/* the cradle: two forked prongs and the switch between them */}
      {[-0.29, 0.29].map((x) => (
        <group key={x} position={[x, 0.17, REST.z]}>
          <mesh material={M.bakelite()} position-y={0.08}>
            <cylinderGeometry args={[0.03, 0.045, 0.16, 16]} />
          </mesh>
          {[-0.045, 0.045].map((z) => (
            <mesh key={z} material={M.bakelite()} position={[0, 0.18, z]}>
              <cylinderGeometry args={[0.014, 0.022, 0.07, 10]} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh material={M.silver()} position={[0, 0.2, REST.z]}>
        <cylinderGeometry args={[0.022, 0.022, 0.05, 12]} />
      </mesh>
      {/* the handset */}
      <group ref={handset} position={REST}>
        <mesh geometry={handle} material={M.bakelite()} />
        {/* the earpiece (+x) and the mouthpiece (−x), cups facing down at rest */}
        {[
          [0.44, 0.115, 0.085],
          [-0.44, 0.1, 0.078],
        ].map(([x, rTop, rBottom]) => (
          <group key={x} position={[x!, -0.08, 0]}>
            <mesh material={M.bakelite()}>
              <cylinderGeometry args={[rBottom!, rTop!, 0.09, 28]} />
            </mesh>
            <mesh material={M.ink()} position-y={-0.047} rotation-x={Math.PI / 2}>
              <circleGeometry args={[rTop! * 0.82, 24]} />
            </mesh>
            {Array.from({ length: 7 }, (_, i) => {
              const a = (i / 7) * Math.PI * 2;
              const r = i === 0 ? 0 : rTop! * 0.4;
              return (
                <mesh key={i} position={[Math.cos(a) * r, -0.049, Math.sin(a) * r]} rotation-x={Math.PI / 2}>
                  <circleGeometry args={[0.009, 8]} />
                  <meshBasicMaterial color="#000" side={THREE.DoubleSide} />
                </mesh>
              );
            })}
          </group>
        ))}
        {taken && <HandsetBlood since={since} />}
      </group>
      <mesh ref={cord} material={M.bakelite()} />
      {taken && <Drips since={since} from={DRIP_AT} start={DRIPS_AT} />}
      {/* not drawn: the space the lifted receiver, the wrist streams and the drops reach, so the
          product view frames it */}
      <mesh position={[0.45, 0.38, 0.15]}>
        <boxGeometry args={[1.0, 1.44, 1.0]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
}

const HOLD_Q = new THREE.Quaternion();
const BREATH_Q = new THREE.Quaternion();
const BREATH_AXIS = new V3(0, 0, 1);
/**
 * Lifting and holding the receiver: up off the cradle first at a hand's speed, turning to the
 * ear on the way (k is 0→1 over the lift), then held there with the faint rise and lean of
 * someone breathing, about one breath every four seconds.
 */
function holdHandset(h: THREE.Group, k: number, t: number) {
  const up = Math.min(1, k * 1.7);
  const breath = Math.sin(t * 1.5) * k;
  h.position.set(REST.x + (LIFTED.x - REST.x) * k * k, REST.y + (LIFTED.y - REST.y) * up + breath * 0.004, REST.z + (LIFTED.z - REST.z) * k);
  HOLD_Q.identity().slerp(LIFTED_Q, Math.pow(k, 1.4));
  h.quaternion.copy(HOLD_Q).multiply(BREATH_Q.setFromAxisAngle(BREATH_AXIS, breath * 0.012));
}

/** Outside the component, so the React compiler rules see no mutation of hook values. */
function setCord(m: THREE.Mesh, end: THREE.Vector3) {
  const old = m.geometry;
  m.geometry = cordGeometry(CORD_FROM, end);
  old?.dispose();
}
