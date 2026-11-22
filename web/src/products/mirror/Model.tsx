import { useCanvasTexture } from '../../gl/canvasTex';
import { M } from '../../gl/materials';
import { useFx } from '../../fx/fxStore';
import { useHaunted, useStory } from '../../store';

function drawReflection(g: CanvasRenderingContext2D, w: number, h: number, haunted: boolean, head: number, face: number) {
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, haunted ? '#1d2230' : '#f2e2c4');
  bg.addColorStop(1, haunted ? '#0b0d13' : '#c9a982');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  if (!haunted) {
    // A soft, warm room: a lamp glow and a window.
    const glow = g.createRadialGradient(w * 0.7, h * 0.35, 4, w * 0.7, h * 0.35, w * 0.5);
    glow.addColorStop(0, 'rgba(255,220,160,0.9)');
    glow.addColorStop(1, 'rgba(255,220,160,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(120,90,60,0.25)';
    g.fillRect(w * 0.18, h * 0.2, w * 0.25, h * 0.32);
    return;
  }
  // A woman's shadow, back turned, only half there (Req 18.2). Soft edges, long hair,
  // narrow shoulders, a long dress; `head` turns her face a little toward the visitor.
  const cx = w * 0.5 + head * w * 0.02;
  const fog = g.createRadialGradient(cx, h * 0.5, 4, cx, h * 0.55, w * 0.6);
  fog.addColorStop(0, 'rgba(70,80,105,0.35)');
  fog.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fog;
  g.fillRect(0, 0, w, h);
  const strength = 0.55 + face * 0.4;
  g.save();
  g.filter = `blur(${Math.round(7 - face * 5)}px)`;
  g.globalAlpha = strength;
  g.fillStyle = '#050506';
  g.beginPath();
  // dress, flaring to the floor
  g.moveTo(cx - w * 0.1, h * 0.52);
  g.bezierCurveTo(cx - w * 0.16, h * 0.72, cx - w * 0.26, h * 0.9, cx - w * 0.3, h * 1.02);
  g.lineTo(cx + w * 0.3, h * 1.02);
  g.bezierCurveTo(cx + w * 0.26, h * 0.9, cx + w * 0.16, h * 0.72, cx + w * 0.1, h * 0.52);
  // shoulders and neck
  g.bezierCurveTo(cx + w * 0.14, h * 0.46, cx + w * 0.12, h * 0.4, cx + w * 0.05, h * 0.38);
  g.lineTo(cx - w * 0.05, h * 0.38);
  g.bezierCurveTo(cx - w * 0.12, h * 0.4, cx - w * 0.14, h * 0.46, cx - w * 0.1, h * 0.52);
  g.fill();
  // head, tilted a little; long hair falling over the shoulders
  g.beginPath();
  g.ellipse(cx, h * 0.3, w * 0.075, h * 0.07, head * 0.15, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(cx - w * 0.08, h * 0.28);
  g.bezierCurveTo(cx - w * 0.13, h * 0.38, cx - w * 0.1, h * 0.5, cx - w * 0.12, h * 0.6);
  g.lineTo(cx + w * 0.12, h * 0.6);
  g.bezierCurveTo(cx + w * 0.1, h * 0.5, cx + w * 0.13, h * 0.38, cx + w * 0.08, h * 0.28);
  g.fill();
  g.restore();
  if (face > 0) {
    // She has come forward and is looking out: no face, just two pale glints in the dark (Req 18.3).
    g.save();
    g.filter = 'blur(1.2px)';
    g.globalAlpha = Math.min(1, face * 1.1);
    g.fillStyle = '#cfd6e6';
    for (const dx of [-0.028, 0.028]) {
      g.beginPath();
      // a little below the middle of the head, where eyes sit on a face
      g.ellipse(cx + w * dx, h * 0.322, w * 0.011, h * 0.006, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
  // Old silvering: dark speckles and a tarnished rim over everything.
  g.fillStyle = 'rgba(20,18,16,0.35)';
  for (let i = 0; i < 140; i++) g.fillRect((i * 73) % w, (i * 151) % h, 1 + (i % 3), 1);
  const rim = g.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.75);
  rim.addColorStop(0, 'rgba(0,0,0,0)');
  rim.addColorStop(1, 'rgba(10,9,8,0.75)');
  g.fillStyle = rim;
  g.fillRect(0, 0, w, h);
}

/** Gilded hall mirror with a delayed, occupied reflection (Requirement 18). */
export default function Mirror() {
  const haunted = useHaunted();
  const played = useStory((s) => s.story.played.mirror === true);
  const dip = useFx((s) => s.mains < 0.8);
  const rising = useFx((s) => s.flags['mirror-face'] !== undefined);
  const face = played ? (rising ? 0.6 : 1) : 0;
  const tex = useCanvasTexture(256, 352, (g, w, h) => drawReflection(g, w, h, haunted, dip ? 1 : 0, face), [haunted, dip, face]);
  return (
    <group rotation={[0, -0.25, 0]} position-y={0.05}>
      <mesh material={M.gilt()} scale={[0.72, 1, 1]}>
        <torusGeometry args={[0.78, 0.08, 18, 72]} />
      </mesh>
      <mesh scale={[0.72, 1, 1]} position-z={-0.01}>
        <circleGeometry args={[0.76, 64]} />
        <meshPhysicalMaterial map={tex} roughness={0.08} metalness={0.2} clearcoat={1} />
      </mesh>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh key={i} material={M.gilt()} position={[Math.cos(a) * 0.58, Math.sin(a) * 0.82, 0.04]}>
            <sphereGeometry args={[0.05, 12, 10]} />
          </mesh>
        );
      })}
      <mesh material={M.gilt()} position={[0, 0.92, 0.02]} rotation-z={Math.PI / 4}>
        <boxGeometry args={[0.14, 0.14, 0.06]} />
      </mesh>
    </group>
  );
}
