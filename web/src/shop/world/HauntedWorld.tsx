import { useEffect, useMemo, useRef } from 'react';
import { seeded } from './noise';
import { paintCity } from './paintCity';
import { paintGround } from './paintGround';
import { paintSky } from './paintSky';

/**
 * The haunted hero's world (after the Reveal): the shop's street after the war. A red moon in
 * smoke, burning gothic ruins and a broken Ferris wheel, scorched snow and rubble, dead trees.
 * Painted once per size on a canvas in code (no image files); fire glow, drifting smoke and
 * rising embers are light CSS layers on top. The 3D still life stands in front of it.
 */
export function HauntedWorld() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    let raf = 0;
    const paint = () => {
      const box = c.getBoundingClientRect();
      const w = Math.max(320, Math.round(box.width));
      const h = Math.max(200, Math.round(box.height));
      if (c.width === w && c.height === h) return;
      c.width = w;
      c.height = h;
      const g = c.getContext('2d', { willReadFrequently: true });
      if (!g) return;
      const wide = w / h > 1.6;
      const horizon = h * (wide ? 0.72 : 0.78);
      paintSky(g, w, h, { x: w * (wide ? 0.74 : 0.7), y: h * 0.24, r: Math.min(w, h) * (wide ? 0.14 : 0.1) });
      paintCity(g, w, h, horizon);
      paintGround(g, w, h, horizon);
    };
    const queue = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(paint);
    };
    queue();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(queue) : null;
    ro?.observe(c);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, []);
  const embers = useMemo(() => {
    const r = seeded(31);
    return Array.from({ length: 26 }, () => ({
      left: 30 + r() * 70,
      delay: -r() * 9,
      dur: 5 + r() * 6,
      drift: (r() - 0.5) * 80,
      size: 1.5 + r() * 2.5,
    }));
  }, []);
  return (
    <div className="haunted-world" aria-hidden="true" data-testid="haunted-world">
      <canvas ref={canvas} className="world-paint" />
      <div className="world-fire world-fire-a" />
      <div className="world-fire world-fire-b" />
      <div className="world-smoke" />
      <div className="world-embers">
        {embers.map((e, i) => (
          <span
            key={i}
            style={{ left: `${e.left}%`, width: e.size, height: e.size, animationDelay: `${e.delay}s`, animationDuration: `${e.dur}s`, ['--drift' as string]: `${e.drift}px` }}
          />
        ))}
      </div>
      <Sign />
      <div className="world-scrim" />
    </div>
  );
}

/** A charred wooden sign stuck in the snow: XMAS struck out, HALLOWEEN in red. */
function Sign() {
  return (
    <svg className="world-sign" viewBox="0 0 240 150">
      <defs>
        <linearGradient id="rc-plank" x1="0" x2="1">
          <stop offset="0" stopColor="#2a1b14" />
          <stop offset="0.5" stopColor="#4a3326" />
          <stop offset="1" stopColor="#24160f" />
        </linearGradient>
        <filter id="rc-wood-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.4" numOctaves="3" seed="4" result="n" />
          <feColorMatrix in="n" type="saturate" values="0" result="m" />
          <feBlend in="SourceGraphic" in2="m" mode="multiply" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
      </defs>
      <rect x="54" y="80" width="12" height="70" fill="#1a100b" transform="rotate(-6 60 115)" />
      <rect x="172" y="80" width="12" height="70" fill="#1a100b" transform="rotate(4 178 115)" />
      <g transform="rotate(-7 120 60)" filter="url(#rc-wood-grain)">
        <path d="M14 22 L226 14 L230 98 L18 106 Z" fill="url(#rc-plank)" stroke="#120a06" strokeWidth="3" />
        <path d="M14 60 L228 54" stroke="#120a06" strokeWidth="2" />
        {/* burned corner */}
        <path d="M200 14 L226 14 L230 44 Q214 38 206 26 Z" fill="#0a0503" />
      </g>
      <g transform="rotate(-7 120 60)" fontFamily="'Fraunces', Georgia, serif" fontWeight="700">
        <text x="40" y="52" fontSize="30" fill="#c9c2b4" opacity="0.8">XMAS</text>
        <path d="M34 42 L136 36" stroke="#9b1b24" strokeWidth="4" />
        <text x="30" y="90" fontSize="21" fill="#c41e24">→ HALLOWEEN</text>
        <path d="M60 94 l1 8 M120 92 l0 10 M168 90 l1 7" stroke="#8a1018" strokeWidth="2" strokeLinecap="round" />
      </g>
      {/* snow piled on top */}
      <path d="M16 22 Q60 12 110 18 T226 12 L226 18 Q150 22 16 28 Z" fill="#cfc8c0" opacity="0.75" transform="rotate(-7 120 60)" />
    </svg>
  );
}
