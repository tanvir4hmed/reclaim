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
/** Lifted: up and to one side, upright, earpiece on top, turned in to a head that is not there. */
const LIFTED = new V3(0.72, 0.62, 0.18);
const LIFTED_ROT = new THREE.Euler(0.08, -0.55, Math.PI / 2 - 0.1);
const LIFT_S = 0.75;
/** The table top the drops fall onto. */
const TABLE_Y = -0.33;

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

/** The handle: a bowed bar from the mouthpiece to the earpiece. */
function handleGeometry() {
  const c = new THREE.CatmullRomCurve3([new V3(-0.38, -0.05, 0), new V3(-0.2, 0.025, 0), new V3(0, 0.04, 0), new V3(0.2, 0.025, 0), new V3(0.38, -0.05, 0)]);
  return new THREE.TubeGeometry(c, 40, 0.046, 14, false);
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

/** Blood: out of the earpiece, down the handle and off the mouthpiece in drops, into a pool. */
function HandsetBlood({ since }: { since: () => number }) {
  const run = useMemo(() => {
    // in the handset's frame: along the front of the handle from the earpiece to the mouthpiece
    const pts = Array.from({ length: 14 }, (_, i) => {
      const t = i / 13;
      const x = 0.4 - t * 0.82;
      return new V3(x, 0.03 - Math.abs(x) * 0.15 + Math.sin(t * 9) * 0.004, 0.043 + Math.sin(t * 5) * 0.004);
    });
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.011, 6, false);
  }, []);
  useEffect(() => () => run.dispose(), [run]);
  const cap = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const s = since();
    const k = progress(s, 2.2, LIFT_S + 0.25);
    run.setDrawRange(0, Math.floor(60 * k) * 6 * 6);
    if (cap.current) cap.current.scale.setScalar(Math.max(0.01, progress(s, 0.8, LIFT_S)));
  });
  return (
    <group>
      {/* welling over the rim of the earpiece */}
      <mesh ref={cap} position={[0.42, -0.02, 0.06]} scale={0.01}>
        <sphereGeometry args={[0.05, 14, 10]} />
        <meshStandardMaterial color="#4e0406" roughness={0.12} />
      </mesh>
      <mesh geometry={run}>
        <meshStandardMaterial color="#560509" roughness={0.12} metalness={0.05} />
      </mesh>
    </group>
  );
}

/** The drops that fall from the bottom of the lifted handset, and the pool they make. */
function Drips({ since, from }: { since: () => number; from: THREE.Vector3 }) {
  const drops = useRef<(THREE.Mesh | null)[]>([]);
  const pool = useRef<THREE.Mesh>(null);
  const START = LIFT_S + 2.2;
  useFrame(() => {
    const s = since();
    const fall = from.y - TABLE_Y;
    drops.current.forEach((m, i) => {
      if (!m) return;
      if (s === Infinity || s < START) {
        m.visible = s === Infinity && i === 0;
        m.position.copy(from);
        return;
      }
      // one drop at a time, drip, drip: hangs, swells, lets go, falls
      const period = 0.75;
      const t = ((s - START + i * (period / 3)) % period) / period;
      m.visible = true;
      const hang = Math.min(1, t / 0.35);
      const f = Math.max(0, (t - 0.35) / 0.65);
      m.position.set(from.x, from.y - 0.01 * hang - f * f * fall, from.z);
      m.scale.set(0.6 + 0.4 * hang, (0.6 + 0.4 * hang) * (1 + f * 0.8), 0.6 + 0.4 * hang);
    });
    if (pool.current) pool.current.scale.setScalar(Math.max(0.01, progress(s, 5, START + 0.4)));
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
          <sphereGeometry args={[0.016, 10, 8]} />
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
 * receiver is picked up by no one, at the speed a hand would lift it, all the way up and
 * upright, held to an ear that is not there; then blood comes out of the earpiece, runs down
 * the receiver and drips off the bottom of it, drop by drop, onto the table. The dial is not
 * touched by it; someone unseen keeps trying the dial, a little this way, a little that way.
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
  // where the drops fall from: the bottom of the lifted handset (its mouthpiece end)
  const dripFrom = useMemo(() => {
    const m = new THREE.Matrix4().compose(LIFTED, new THREE.Quaternion().setFromEuler(LIFTED_ROT), new V3(1, 1, 1));
    return new V3(-0.48, -0.06, 0).applyMatrix4(m);
  }, []);
  useFrame((st) => {
    const h = handset.current;
    if (!h) return;
    const t = st.clock.elapsedTime;
    if (wheel.current) {
      const tries = taken ? Math.sin(t * 1.7) * 0.22 + Math.sin(t * 4.3 + 1.1) * 0.08 + Math.sin(t * 0.6) * 0.1 : 0;
      wheel.current.rotation.y = tries;
    }
    if (taken) {
      // a hand's speed: up off the cradle first, then over and upright
      const k = progress(since(), LIFT_S);
      const up = Math.min(1, k * 1.5);
      h.position.set(REST.x + (LIFTED.x - REST.x) * k * k, REST.y + (LIFTED.y - REST.y) * up, REST.z + (LIFTED.z - REST.z) * k);
      h.rotation.set(LIFTED_ROT.x * k, LIFTED_ROT.y * k, LIFTED_ROT.z * k + Math.sin(t * 1.1) * 0.012 * k);
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
    <group rotation={[0.28, -0.42, 0]} position-y={0.02} scale={0.92}>
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
      {taken && <Drips since={since} from={dripFrom} />}
      {/* not drawn: the space the lifted receiver reaches, so the product view frames it */}
      <mesh position={[0.3, 0.36, 0]}>
        <boxGeometry args={[1.5, 1.4, 0.9]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
}

/** Outside the component, so the React compiler rules see no mutation of hook values. */
function setCord(m: THREE.Mesh, end: THREE.Vector3) {
  const old = m.geometry;
  m.geometry = cordGeometry(CORD_FROM, end);
  old?.dispose();
}
