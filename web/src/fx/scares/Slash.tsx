import { useState } from 'react';

/** The bear's throat on screen: measured on its picture (card or product view), biggest first. */
function throat(): { x: number; y: number } {
  let best: DOMRect | null = null;
  for (const el of document.querySelectorAll<HTMLElement>('[data-object="teddy-bear"]')) {
    const r = el.getBoundingClientRect();
    if (r.width < 80 || r.bottom < 0 || r.top > window.innerHeight) continue;
    if (!best || r.width > best.width) best = r;
  }
  return best ? { x: best.left + best.width * 0.49, y: best.top + best.height * 0.36 } : { x: window.innerWidth / 2, y: window.innerHeight * 0.45 };
}

/** Blood thrown onto the glass by the stroke: where each drop hits and how big it is. */
const SPATTER = Array.from({ length: 22 }, (_, i) => {
  const a = -0.5 + ((i * 0.618) % 1) * 1.4;
  const d = 18 + ((i * 47) % 140);
  return { dx: Math.cos(a) * d, dy: Math.sin(a) * d * 0.7 - 10, r: 2 + ((i * 13) % 9), run: i % 4 === 0 ? 14 + ((i * 7) % 30) : 0 };
});

/**
 * Teddy: one sword stroke across the window, straight through the bear's throat. A single
 * bright streak (one flash, well under the three-per-second limit), a thin red line where it
 * cut, and blood thrown across the glass along the stroke, a few drops running. The bear
 * itself comes apart in its model.
 */
export function TeddySlash() {
  const [{ x, y }] = useState(throat);
  const w = window.innerWidth;
  const h = window.innerHeight;
  // Slightly downhill, left to right, like a right-handed swing, through the throat.
  const slope = (h * 0.14) / (w + 80);
  const d = `M ${-40} ${y - slope * (x + 40)} L ${w + 40} ${y + slope * (w + 40 - x)}`;
  return (
    <svg className="ts-slash" viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
      <defs>
        <linearGradient id="ts-blade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.7" stopColor="#f4f1ea" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff" />
        </linearGradient>
      </defs>
      <path className="ts-slash-cut" d={d} pathLength={1} />
      <path className="ts-slash-blade" d={d} pathLength={1} stroke="url(#ts-blade)" />
      <g className="ts-spatter">
        {SPATTER.map((s, i) => (
          <g key={i} transform={`translate(${(x + s.dx).toFixed(1)} ${(y + s.dy + slope * s.dx).toFixed(1)})`} style={{ animationDelay: `${0.2 + i * 0.008}s` }}>
            <circle r={s.r} />
            {s.run > 0 && <rect className="ts-run" x={-s.r * 0.35} y={0} width={s.r * 0.7} height={s.run} rx={s.r * 0.35} />}
          </g>
        ))}
      </g>
    </svg>
  );
}
