import { useCanvasTexture } from '../../gl/canvasTex';
import { M } from '../../gl/materials';
import { useHaunted, useStory } from '../../store';

/** Wooden advent calendar: 24 doors; after the Reveal door 25 stands ajar (Requirement 39). */
export function AdventCalendar() {
  const haunted = useHaunted();
  const doors = Array.from({ length: 24 }, (_, i) => [(i % 6) - 2.5, Math.floor(i / 6) - 1.5] as const);
  return (
    <group rotation={[-0.1, -0.3, 0]}>
      <mesh material={M.woodLight()}>
        <boxGeometry args={[1.5, 1.1, 0.1]} />
      </mesh>
      <mesh material={M.woodLight()} position={[0, 0.72, 0]} rotation-z={Math.PI / 4}>
        <boxGeometry args={[0.75, 0.75, 0.1]} />
      </mesh>
      {doors.map(([x, y], i) => (
        <mesh key={i} material={i % 3 ? M.giftPaper() : M.green()} position={[x * 0.22, -y * 0.22, 0.06]}>
          <boxGeometry args={[0.18, 0.18, 0.03]} />
        </mesh>
      ))}
      <group position={[0, 0.7, 0.06]} rotation-y={haunted ? -0.9 : 0}>
        <mesh material={M.gilt()} position-x={0.1}>
          <boxGeometry args={[0.2, 0.2, 0.03]} />
        </mesh>
      </group>
      {haunted && (
        <mesh material={M.glow()} position={[0, 0.7, 0.04]}>
          <planeGeometry args={[0.18, 0.18]} />
        </mesh>
      )}
    </group>
  );
}

/** Wind-up tin soldier. */
export function TinSoldier() {
  const haunted = useHaunted();
  return (
    <group position-y={-0.05} rotation={[0, -0.3, haunted ? 0.25 : 0]}>
      <mesh material={M.tinBlue()} position={[-0.08, -0.4, 0]}>
        <cylinderGeometry args={[0.065, 0.06, 0.45, 18]} />
      </mesh>
      <mesh material={M.tinBlue()} position={[0.08, -0.4, 0]}>
        <cylinderGeometry args={[0.065, 0.06, 0.45, 18]} />
      </mesh>
      <mesh material={M.tin()} position-y={0.02}>
        <cylinderGeometry args={[0.17, 0.16, 0.45, 24]} />
      </mesh>
      <mesh material={M.gilt()} position-y={-0.18}>
        <cylinderGeometry args={[0.172, 0.172, 0.05, 24]} />
      </mesh>
      <mesh material={M.porcelain()} position-y={0.36}>
        <sphereGeometry args={[0.13, 24, 18]} />
      </mesh>
      <mesh material={M.bakelite()} position-y={0.58}>
        <cylinderGeometry args={[0.12, 0.13, 0.3, 24]} />
      </mesh>
      <mesh material={M.silver()} position={[0.25, 0.05, 0.05]} rotation-z={0.05}>
        <boxGeometry args={[0.04, 0.8, 0.04]} />
      </mesh>
      <mesh material={M.brass()} position={[0, 0.02, -0.2]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.08, 0.015, 8, 20]} />
      </mesh>
    </group>
  );
}

/** Walnut valve radio with a glowing dial. */
export function ValveRadio() {
  const haunted = useHaunted();
  return (
    <group rotation={[0.1, -0.4, 0]} position-y={-0.1}>
      <mesh material={M.wood()}>
        <boxGeometry args={[1.4, 0.9, 0.55]} />
      </mesh>
      <mesh material={M.wood()} position-y={0.45} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.7, 0.7, 0.55, 40, 1, false, -Math.PI / 2, Math.PI]} />
      </mesh>
      <mesh material={M.knit()} position={[-0.25, 0.2, 0.28]}>
        <circleGeometry args={[0.36, 40]} />
      </mesh>
      <mesh material={M.glow()} position={[0.4, 0.15, 0.28]}>
        <planeGeometry args={[0.34, 0.18]} />
      </mesh>
      <mesh material={M.wax()} position={[0.4 + (haunted ? 0.08 : -0.06), 0.15, 0.285]}>
        <planeGeometry args={[0.012, 0.16]} />
      </mesh>
      {[-0.1, 0.25, 0.55].map((x) => (
        <mesh key={x} material={M.brass()} position={[x, -0.28, 0.3]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.07, 0.07, 0.07, 24]} />
        </mesh>
      ))}
    </group>
  );
}

/** Instant camera; after the Reveal a print hangs out of it. */
export function InstantCamera() {
  const haunted = useHaunted();
  return (
    <group rotation={[0.15, -0.45, 0]} position-y={-0.05}>
      <mesh material={M.enamel()}>
        <boxGeometry args={[1.3, 0.85, 0.6]} />
      </mesh>
      <mesh material={M.bakelite()} position={[0, -0.25, 0]}>
        <boxGeometry args={[1.32, 0.36, 0.62]} />
      </mesh>
      <mesh material={M.bakelite()} position={[0, 0.02, 0.33]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.26, 0.28, 0.12, 40]} />
      </mesh>
      <mesh material={M.glass()} position={[0, 0.02, 0.4]}>
        <circleGeometry args={[0.18, 32]} />
      </mesh>
      <mesh material={M.ink()} position={[0, 0.02, 0.395]}>
        <circleGeometry args={[0.12, 32]} />
      </mesh>
      <mesh material={M.glow()} position={[0.42, 0.28, 0.305]}>
        <planeGeometry args={[0.28, 0.12]} />
      </mesh>
      {haunted && (
        <mesh material={M.paperDark()} position={[0, -0.6, 0.2]} rotation-x={-0.2}>
          <boxGeometry args={[0.6, 0.62, 0.01]} />
        </mesh>
      )}
    </group>
  );
}

/** Wrapped gift with a gold ribbon and a "To: Dad" tag; the sender burns away. */
export function UnopenedGift() {
  const haunted = useHaunted();
  const tag = useCanvasTexture(
    256,
    128,
    (g, w, h) => {
      g.fillStyle = haunted ? '#a48c66' : '#f6eedc';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#3a2a1c';
      g.font = 'italic 34px "Fraunces Variable", Georgia, serif';
      g.fillText('To: Dad', 20, 50);
      if (!haunted) g.fillText('From: Ellie', 20, 100);
      else {
        g.fillStyle = '#140d09';
        g.beginPath();
        g.ellipse(w * 0.55, h * 0.78, 120, 30, -0.1, 0, Math.PI * 2);
        g.fill();
      }
    },
    [haunted],
  );
  return (
    <group rotation={[0.35, -0.6, 0]} position-y={-0.15}>
      <mesh material={M.giftPaper()}>
        <boxGeometry args={[0.95, 0.75, 0.95]} />
      </mesh>
      <mesh material={M.ribbon()}>
        <boxGeometry args={[0.97, 0.77, 0.14]} />
      </mesh>
      <mesh material={M.ribbon()}>
        <boxGeometry args={[0.14, 0.77, 0.97]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={M.ribbon()} position={[s * 0.15, 0.45, 0]} rotation={[Math.PI / 2, 0, s * 0.5]} scale={[1, 0.6, 1]}>
          <torusGeometry args={[0.13, 0.04, 10, 24]} />
        </mesh>
      ))}
      <mesh position={[0.3, 0.1, 0.49]} rotation-z={-0.2}>
        <planeGeometry args={[0.42, 0.21]} />
        <meshStandardMaterial map={tag} roughness={0.9} />
      </mesh>
    </group>
  );
}

function Mitten({ x, r }: { x: number; r: number }) {
  return (
    <group position={[x, -0.05, 0]} rotation-z={r}>
      <mesh material={M.knit()} scale={[1, 1.15, 0.45]}>
        <capsuleGeometry args={[0.24, 0.32, 10, 20]} />
      </mesh>
      <mesh material={M.knit()} position={[x < 0 ? 0.24 : -0.24, 0.02, 0]} rotation-z={x < 0 ? -0.6 : 0.6} scale={[1, 1, 0.45]}>
        <capsuleGeometry args={[0.08, 0.16, 8, 12]} />
      </mesh>
      <mesh material={M.clothWhite()} position-y={-0.42} rotation-x={Math.PI / 2} scale={[1, 0.45, 1]}>
        <torusGeometry args={[0.24, 0.06, 10, 28]} />
      </mesh>
    </group>
  );
}

/** A pair of knitted mittens on a string; after the Reveal only one is left. */
export function Mittens() {
  const haunted = useHaunted();
  const found = useStory((s) => s.story.marks.some((m) => m.kind === 'mitten'));
  return (
    <group rotation={[0.4, -0.2, 0]} scale={0.95}>
      <Mitten x={-0.34} r={0.15} />
      {(!haunted || found) && <Mitten x={0.34} r={-0.15} />}
    </group>
  );
}
