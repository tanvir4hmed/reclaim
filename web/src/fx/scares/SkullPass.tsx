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

/** Seconds after the take when the big skull leaves its spring in the box (MusicBox model). */
export const SKULL_LAUNCH = 0.45;
/** Where it was on screen when it left (set by the model in the product view). */
export const skullLaunch: { at: { x: number; y: number; size: number; when: number } | null } = { at: null };

/**
 * One of the skulls springing in the music box, the big one in the middle, comes off its
 * spring and flies out of the screen at you, from the very spot it left: small, then larger
 * as it comes (like the bat, but it never fills the screen), a judder at its closest, in the
 * middle of the screen, and on past you, gone. Its empty spring stays in the box. No flash.
 */
export function MusicSkullPass() {
  const skull = useRef<SVGGElement>(null);
  const [fallback] = useState(boxSpot);
  useEffect(() => {
    if (reducedMotion()) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const size = Math.min(W, H) * 0.42;
    const t0 = performance.now();
    let from: { x: number; y: number; s0: number } | null = null;
    let raf = 0;
    const step = (now: number) => {
      const t = (now - t0) / 1000 - SKULL_LAUNCH;
      const g = skull.current;
      if (t < 0 || !g) {
        if (g) g.style.opacity = '0';
        raf = requestAnimationFrame(step);
        return;
      }
      if (!from) {
        // the spot it left from in the product view; or, taken from the shelf, the card
        const at = skullLaunch.at && now - skullLaunch.at.when < 1500 ? skullLaunch.at : null;
        from = at ? { x: at.x, y: at.y, s0: at.size * 1.1 } : { x: fallback.x, y: fallback.y, s0: size * 0.12 };
        skullLaunch.at = null;
      }
      // out (0–0.5 s), at its closest in the middle (to 0.85 s), then on past you (to 1.35 s)
      const out = Math.min(1, t / 0.5);
      const e = 1 - (1 - out) ** 3;
      const past = Math.max(0, (t - 0.85) / 0.5);
      const x = from.x + (W / 2 - from.x) * e;
      const y = from.y + (H * 0.45 - from.y) * e - past * H * 0.1;
      const near = 0.8 * size + (t > 0.5 ? Math.min(0.2, (t - 0.5) * 0.6) * size : 0);
      const s = from.s0 + (near - from.s0) * e + past * 0.9 * size;
      const judder = t > 0.5 && t < 0.85 ? Math.sin(t * 80) * 4 : 0;
      g.setAttribute('transform', `translate(${(x + judder).toFixed(1)} ${y.toFixed(1)}) scale(${(s / 100).toFixed(3)})`);
      g.style.opacity = String(Math.max(0, 1 - past * 1.1));
      if (t < 1.4) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [fallback]);
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
      {/* drawn in a 100-unit box centred on the cranium; it has left its spring behind */}
      <g ref={skull} style={{ opacity: 0 }} transform={`translate(${fallback.x} ${fallback.y}) scale(0.01)`}>
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
