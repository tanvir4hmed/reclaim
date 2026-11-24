import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useCanvasTexture } from '../../gl/canvasTex';
import { M } from '../../gl/materials';
import { useTaken } from '../../gl/useTaken';
import { useHaunted, useStory } from '../../store';

const R = 0.62; // sponge radius
const COAT = 0.645; // outside of the frosting
const BOTTOM = -0.38;
const TOP = 0.18; // top of the sponge
const FROST_TOP = 0.26;
/** The slice that is taken: a clean wedge out of the front, facing you. */
const GAP = 0.95;

/** The inside of the cake as seen on a clean cut: sponge, cream and jam in layers, the frosting at the rim. */
function drawLayers(g: CanvasRenderingContext2D, w: number, h: number, haunted: boolean) {
  const sponge = haunted ? '#8d7a55' : '#ecc98c';
  const cream = haunted ? '#b9b292' : '#fbf3e4';
  const jam = haunted ? '#3e0507' : '#a3121e';
  // From the top: frosting, sponge, cream, jam, sponge, cream, jam, sponge.
  const bands: [number, string][] = [
    [0.13, cream],
    [0.2, sponge],
    [0.06, cream],
    [0.045, jam],
    [0.22, sponge],
    [0.06, cream],
    [0.045, jam],
    [0.24, sponge],
  ];
  let y = 0;
  for (const [t, c] of bands) {
    g.fillStyle = c;
    g.fillRect(0, y * h, w, t * h + 1);
    y += t;
  }
  // the crumb of the sponge: tiny air holes, darker near the bottom where it baked
  for (let i = 0; i < 900; i++) {
    const x = (i * 137.3) % w;
    const yy = (i * 61.7) % h;
    g.fillStyle = haunted ? 'rgba(30,22,10,0.35)' : 'rgba(150,100,40,0.25)';
    g.fillRect(x, yy, 1.5, 1.2);
  }
  const base = g.createLinearGradient(0, h * 0.7, 0, h);
  base.addColorStop(0, 'rgba(120,70,20,0)');
  base.addColorStop(1, haunted ? 'rgba(20,12,6,0.55)' : 'rgba(150,90,30,0.35)');
  g.fillStyle = base;
  g.fillRect(0, h * 0.7, w, h * 0.3);
  // the frosting down the outside edge of the slice
  g.fillStyle = cream;
  g.fillRect(w * 0.955, 0, w * 0.045, h);
  if (haunted) {
    // Inside it has gone wrong: grey mould in the crumb, the jam black and wet, seeping down.
    for (let i = 0; i < 26; i++) {
      g.fillStyle = 'rgba(70,90,60,0.5)';
      g.beginPath();
      g.arc((i * 97) % w, h * (0.2 + ((i * 0.137) % 0.7)), 3 + (i % 4) * 2, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(40,2,4,0.85)';
    for (let i = 0; i < 9; i++) {
      const x = w * 0.08 + i * w * 0.1;
      g.fillRect(x, h * 0.43, 3, 14 + ((i * 29) % 40));
      g.fillRect(x + 6, h * 0.74, 2.5, 10 + ((i * 17) % 30));
    }
  }
}

/** A cut face of the cake at angle `th` (from the front), from the centre out to the frosting. */
function CutFace({ th, map }: { th: number; map: THREE.Texture }) {
  const h = FROST_TOP - BOTTOM;
  return (
    <mesh position={[Math.sin(th) * (COAT / 2), (FROST_TOP + BOTTOM) / 2, Math.cos(th) * (COAT / 2)]} rotation-y={th - Math.PI / 2}>
      <planeGeometry args={[COAT, h]} />
      <meshStandardMaterial map={map} roughness={0.85} side={THREE.DoubleSide} />
    </mesh>
  );
}

/**
 * A Christmas cake: sponge coated in white frosting that drips over the edge, a ring of piped
 * rosettes, berries and holly. After the Reveal it is collapsed and rotted with a bite and a fly.
 * Taken: one clean wedge is gone from the front (something had it in a single bite), and the
 * smooth cut sides show the layers inside, and what has happened to them.
 */
export default function Cake() {
  const haunted = useHaunted();
  const flyGone = useStory((s) => s.story.played.cake === true);
  const wing = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const flyHere = haunted && !flyGone;
  // The fly flicks its wings now and then; redraw only while it is here.
  useEffect(() => {
    if (!flyHere) return;
    const t = setInterval(() => invalidate(), 90);
    return () => clearInterval(t);
  }, [flyHere, invalidate]);
  const bite = useMemo(() => {
    // Jagged, wide arc of teeth marks: too many points and too far apart for a person.
    const s = new THREE.Shape();
    s.moveTo(-0.42, 0.12);
    for (let i = 0; i <= 9; i++) {
      const a = Math.PI * (i / 9);
      const r = i % 2 ? 0.33 : 0.42;
      s.lineTo(-Math.cos(a) * r, 0.12 - Math.sin(a) * r * 0.9);
    }
    s.lineTo(0.42, 0.12);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: false });
  }, []);
  const layers = useCanvasTexture(256, 256, (g, w, h) => drawLayers(g, w, h, haunted), [haunted]);
  const { taken, since } = useTaken('cake');
  /** Angle from the front of the cake (x = sin, z = cos). */
  const inGap = (th: number) => taken && Math.abs(Math.atan2(Math.sin(th), Math.cos(th))) < GAP / 2 + 0.08;
  const rosettes = useMemo(() => Array.from({ length: 16 }, (_, i) => (i / 16) * Math.PI * 2 + 0.2), []);
  const drips = useMemo(() => Array.from({ length: 22 }, (_, i) => ({ th: (i / 22) * Math.PI * 2 + 0.1, len: 0.06 + ((i * 37) % 11) / 70 })), []);
  const arc = (r: number, h: number, seg = 64) =>
    taken ? <cylinderGeometry args={[r, r, h, seg, 1, false, GAP / 2, Math.PI * 2 - GAP]} /> : <cylinderGeometry args={[r, r, h, seg]} />;
  const jolt = useRef<THREE.Group>(null);
  useFrame(() => {
    const s = since();
    if (!jolt.current) return;
    // the snatch: the whole cake jerks toward whatever took the slice
    const k = taken && s < 0.5 ? Math.sin((s / 0.5) * Math.PI) : 0;
    jolt.current.position.z = k * 0.06;
    jolt.current.rotation.x = k * 0.1;
  });
  useFrame((st) => {
    if (wing.current) {
      wing.current.rotation.z = Math.sin(st.clock.elapsedTime * 40) * (Math.floor(st.clock.elapsedTime) % 3 === 0 ? 0.6 : 0);
    }
  });
  const sag = haunted ? 0.72 : 1;
  const leaf = haunted ? '#26301f' : '#2f6a3a';
  return (
    <group position-y={-0.15} rotation={[0.15, 0.4, haunted ? 0.07 : 0]}>
      <mesh material={M.porcelain()} position-y={-0.42}>
        <cylinderGeometry args={[0.95, 0.9, 0.06, 48]} />
      </mesh>
      <group ref={jolt} scale={[1, sag, 1]}>
        {/* sponge (seen only where it is cut) inside a coat of frosting */}
        <mesh material={M.sponge()} position-y={(TOP + BOTTOM) / 2}>
          {arc(R, TOP - BOTTOM)}
        </mesh>
        <mesh material={M.cream()} position-y={(TOP + BOTTOM) / 2 + 0.01}>
          {arc(COAT, TOP - BOTTOM + 0.02)}
        </mesh>
        <mesh material={M.cream()} position-y={(TOP + FROST_TOP) / 2 + 0.005}>
          {arc(COAT + 0.01, FROST_TOP - TOP)}
        </mesh>
        {/* a soft rounded lip where the top frosting turns over the edge */}
        <mesh material={M.cream()} position-y={FROST_TOP - 0.01} rotation-x={Math.PI / 2}>
          <torusGeometry args={[COAT - 0.005, 0.028, 10, 64, taken ? Math.PI * 2 - GAP : Math.PI * 2]} />
        </mesh>
        {/* frosting dripping down the sides */}
        {drips.map(({ th, len }, i) =>
          inGap(th) ? null : (
            <mesh key={i} material={M.cream()} position={[Math.sin(th) * (COAT + 0.012), FROST_TOP - 0.03 - len / 2, Math.cos(th) * (COAT + 0.012)]}>
              <capsuleGeometry args={[0.024, len, 4, 8]} />
            </mesh>
          ),
        )}
        {taken && (
          <>
            <CutFace th={GAP / 2} map={layers} />
            <CutFace th={-GAP / 2} map={layers} />
          </>
        )}
        {/* piped rosettes round the top, berries inside them, holly in the middle */}
        {rosettes.map((th, i) =>
          inGap(th) ? null : (
            <mesh key={i} material={M.cream()} position={[Math.sin(th) * 0.53, FROST_TOP + 0.04, Math.cos(th) * 0.53]} scale={[1, 0.8, 1]}>
              <sphereGeometry args={[0.065, 16, 12]} />
            </mesh>
          ),
        )}
        {rosettes
          .filter((_, i) => i % 2 === 0)
          .map((th, i) =>
            inGap(th) ? null : (
              <mesh key={`b${i}`} material={M.berry()} position={[Math.sin(th) * 0.33, FROST_TOP + 0.05, Math.cos(th) * 0.33]}>
                <sphereGeometry args={[0.065, 18, 14]} />
              </mesh>
            ),
          )}
        {[0, 1, 2].map((i) => (
          <mesh key={`l${i}`} position={[Math.sin(i * 2.1 + 2.6) * 0.07, FROST_TOP + 0.05, Math.cos(i * 2.1 + 2.6) * 0.07 - 0.1]} rotation={[-Math.PI / 2 + 0.25, 0, i * 2.1]} scale={[0.07, 0.16, 0.02]}>
            <sphereGeometry args={[1, 12, 8]} />
            <meshStandardMaterial color={leaf} roughness={0.45} />
          </mesh>
        ))}
        {[-0.03, 0.03, 0].map((x, i) => (
          <mesh key={`h${i}`} material={M.berry()} position={[x, FROST_TOP + 0.08, -0.1 + (i === 2 ? 0.04 : 0)]}>
            <sphereGeometry args={[0.03, 12, 10]} />
          </mesh>
        ))}
      </group>
      {haunted && !taken && <mesh material={M.ink()} geometry={bite} position={[0.3, 0.05, 0.42]} rotation={[0, -0.6, 0]} scale={0.6} />}
      {haunted && !flyGone && (
        // A housefly: striped abdomen, thorax, big red eyes, veined wings held back.
        <group position={[-0.2, 0.22, 0.3]} rotation-y={0.6} scale={0.045}>
          <mesh position-z={-0.9} scale={[0.75, 0.6, 1.2]}>
            <sphereGeometry args={[1, 12, 10]} />
            <meshStandardMaterial color="#1c1e1c" roughness={0.35} metalness={0.3} />
          </mesh>
          <mesh scale={[0.7, 0.65, 0.75]}>
            <sphereGeometry args={[1, 12, 10]} />
            <meshStandardMaterial color="#2a2a26" roughness={0.6} />
          </mesh>
          {[-0.45, 0.45].map((x) => (
            <mesh key={x} position={[x, 0.15, 0.85]} scale={[0.45, 0.55, 0.45]}>
              <sphereGeometry args={[1, 10, 8]} />
              <meshStandardMaterial color="#7a1410" roughness={0.3} />
            </mesh>
          ))}
          <group ref={wing}>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * 0.7, 0.55, -0.7]} rotation={[-0.2, s * 0.35, s * 0.25]}>
                <planeGeometry args={[1.1, 1.9]} />
                <meshBasicMaterial color="#c8d0d8" transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} />
              </mesh>
            ))}
          </group>
        </group>
      )}
    </group>
  );
}
