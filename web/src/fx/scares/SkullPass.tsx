import { useEffect, useRef, useState } from 'react';
import { reducedMotion } from '../../director/runtime';

/** Where the music box is on screen now (its card, or the product view if that is open). */
function boxSpot(): { x: number; y: number } {
  let best: DOMRect | null = null;
  for (const el of document.querySelectorAll<HTMLElement>('[data-object="music-box"]')) {
    const r = el.getBoundingClientRect();
    if (r.width < 60 || r.bottom < 0 || r.top > window.innerHeight) continue;
    if (!best || r.width > best.width) best = r;
  }
  return best ? { x: best.left + best.width / 2, y: best.top + best.height * 0.45 } : { x: window.innerWidth / 2, y: window.innerHeight * 0.7 };
}

/** A zig-zag coil from a to b (the spring the skull is on). */
function coil(ax: number, ay: number, bx: number, by: number, turns: number, w: number): string {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  let d = `M${ax.toFixed(1)} ${ay.toFixed(1)}`;
  for (let i = 1; i <= turns * 2; i++) {
    const t = i / (turns * 2);
    const s = i % 2 ? 1 : -1;
    d += ` L${(ax + dx * t + nx * w * s).toFixed(1)} ${(ay + dy * t + ny * w * s).toFixed(1)}`;
  }
  return `${d} L${bx.toFixed(1)} ${by.toFixed(1)}`;
}

/**
 * The music box's biggest skull, on its spring, shoots out of the box and through the middle of
 * the screen at you: small, then larger as it comes (like the bat, but it never fills the
 * screen), a judder at the closest point, and on past you, gone. No flash.
 */
export function MusicSkullPass() {
  const [from] = useState(boxSpot);
  const skull = useRef<SVGGElement>(null);
  const spring = useRef<SVGPathElement>(null);
  useEffect(() => {
    if (reducedMotion()) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const size = Math.min(W, H) * 0.42;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = (now - t0) / 1000;
      // out (0–0.55 s), at its closest in the middle (to 0.9 s), then on past you (to 1.4 s)
      const out = Math.min(1, t / 0.55);
      const e = 1 - (1 - out) ** 3;
      const past = Math.max(0, (t - 0.9) / 0.5);
      const x = from.x + (W / 2 - from.x) * e;
      const y = from.y + (H * 0.45 - from.y) * e - past * H * 0.1;
      const s = (0.12 + 0.68 * e + (t > 0.55 ? Math.min(0.2, (t - 0.55) * 0.6) : 0) + past * 0.9) * size;
      const judder = t > 0.55 && t < 0.9 ? Math.sin(t * 80) * 4 : 0;
      const g = skull.current;
      if (g) {
        g.setAttribute('transform', `translate(${(x + judder).toFixed(1)} ${y.toFixed(1)}) scale(${(s / 100).toFixed(3)})`);
        g.style.opacity = String(Math.max(0, 1 - past * 1.1));
      }
      const p = spring.current;
      if (p) {
        p.setAttribute('d', coil(from.x, from.y, x + judder, y + s * 0.42, 9, Math.max(4, s * 0.09)));
        p.style.opacity = String(Math.max(0, 1 - past * 1.6));
        p.style.strokeWidth = String(Math.max(1.5, s * 0.018));
      }
      if (t < 1.45) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [from]);
  if (reducedMotion()) return null;
  return (
    <svg className="ts-skull-pass" viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`}>
      <defs>
        <radialGradient id="ts-bone" cx="45%" cy="35%" r="70%">
          <stop offset="0" stopColor="#e9dfc6" />
          <stop offset="0.6" stopColor="#bba981" />
          <stop offset="1" stopColor="#6e5c3c" />
        </radialGradient>
      </defs>
      <path ref={spring} className="ts-skull-spring" d="" />
      {/* drawn in a 100-unit box centred on the cranium */}
      <g ref={skull} transform={`translate(${from.x} ${from.y}) scale(0.01)`}>
        <path
          fill="url(#ts-bone)"
          stroke="#2a1e12"
          strokeWidth="1.2"
          d="M0 -48 C 30 -48 44 -26 42 -2 C 41 12 34 18 30 24 C 28 30 26 38 18 41 L -18 41 C -26 38 -28 30 -30 24 C -34 18 -41 12 -42 -2 C -44 -26 -30 -48 0 -48 Z"
        />
        {/* cracks, a broken-out hole, stains */}
        <path d="M6 -47 L10 -36 L4 -28 L9 -18 M-22 -40 L-16 -30 L-20 -24" stroke="#2a1a0e" strokeWidth="1.3" fill="none" />
        <path d="M26 -30 C 32 -28 33 -20 28 -17 C 24 -19 23 -26 26 -30 Z" fill="#0a0604" />
        <ellipse cx="-12" cy="-26" rx="9" ry="5" fill="#6e5530" opacity="0.35" />
        {/* deep sockets, the nose hole, cheekbones */}
        <path d="M-27 -4 C -27 -16 -8 -18 -6 -6 C -5 4 -12 9 -19 8 C -25 7 -27 2 -27 -4 Z" fill="#050302" />
        <path d="M27 -4 C 27 -16 8 -18 6 -6 C 5 4 12 9 19 8 C 25 7 27 2 27 -4 Z" fill="#050302" />
        <circle cx="-16" cy="-3" r="2.2" fill="#ff6a22" opacity="0.85" />
        <circle cx="16" cy="-3" r="2.2" fill="#ff6a22" opacity="0.85" />
        <path d="M0 8 L -5 19 C -3 21 3 21 5 19 Z" fill="#050302" />
        {/* the teeth, some gone */}
        <path d="M-17 28 L17 28 L16 40 L-16 40 Z" fill="#1a110a" />
        <path d="M-15 28 h5 v8 h-5 Z M-8 28 h5 v9 h-5 Z M5 28 h5 v9 h-5 Z M11 28 h4 v7 h-4 Z" fill="#d9cba6" stroke="#3a2c1a" strokeWidth="0.6" />
        <path d="M-14 42 h5 v6 h-5 Z M-6 42 h5 v7 h-5 Z M3 42 h5 v7 h-5 Z" fill="#c8b890" stroke="#3a2c1a" strokeWidth="0.6" />
      </g>
    </svg>
  );
}
