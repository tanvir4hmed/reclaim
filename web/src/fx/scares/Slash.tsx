import { useEffect, useState } from 'react';

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The bear's throat on screen, and the picture it is in. In the product view the bear's model
 * keeps this up to date (it projects the point where its neck is cut); on the shelf it is
 * estimated on the card.
 */
export const teddyThroat: { at: { x: number; y: number; rect: Rect; when: number } | null } = { at: null };

/** When the stroke went up on screen (performance.now()); its blade crosses in 0.12–0.26 s after. */
export const teddySlash: { at: number | null } = { at: null };
/** Seconds after the stroke appears that the bear comes apart: once the blade is all the way through. */
export const SLASH_THROUGH = 0.32;

function throat(): { x: number; y: number; rect: Rect } {
  const t = teddyThroat.at;
  if (t && document.querySelector('dialog[open]') && performance.now() - t.when < 1000) return t;
  let best: DOMRect | null = null;
  for (const el of document.querySelectorAll<HTMLElement>('[data-object="teddy-bear"]')) {
    const r = el.getBoundingClientRect();
    if (r.width < 80 || r.bottom < 0 || r.top > window.innerHeight) continue;
    if (!best || r.width > best.width) best = r;
  }
  const rect = best ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
  return { x: rect.left + rect.width * 0.49, y: rect.top + rect.height * 0.36, rect };
}

/** Blood thrown onto the glass by the stroke: where each drop hits and how big it is. */
const SPATTER = Array.from({ length: 22 }, (_, i) => {
  const a = -0.5 + ((i * 0.618) % 1) * 1.4;
  const d = 12 + ((i * 47) % 110);
  return { dx: Math.cos(a) * d, dy: Math.sin(a) * d * 0.7 - 8, r: 2 + ((i * 13) % 8), run: i % 4 === 0 ? 12 + ((i * 7) % 26) : 0 };
});

/**
 * Teddy: one sword stroke across the bear's picture, straight through its throat. A single
 * bright streak (one flash, well under the three-per-second limit), a thin red line where it
 * cut, and blood thrown across the glass along the stroke, a few drops running. All of it stays
 * inside the bear's picture. The bear itself comes apart in its model.
 */
export function TeddySlash() {
  const [{ x, y, rect }] = useState(throat);
  // the bear waits for this: it is only cut once the blade has been seen going through
  useEffect(() => {
    teddySlash.at = performance.now();
  }, []);
  const w = window.innerWidth;
  const h = window.innerHeight;
  // slightly downhill, left to right, like a right-handed swing, through the throat
  const slope = 0.12;
  const x0 = rect.left - 10;
  const x1 = rect.left + rect.width + 10;
  const d = `M ${x0} ${y - slope * (x - x0)} L ${x1} ${y + slope * (x1 - x)}`;
  return (
    <svg className="ts-slash" viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
      <defs>
        <linearGradient id="ts-blade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.7" stopColor="#f4f1ea" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff" />
        </linearGradient>
        <clipPath id="ts-slash-clip">
          <rect x={rect.left} y={rect.top} width={rect.width} height={rect.height} rx="14" />
        </clipPath>
      </defs>
      <g clipPath="url(#ts-slash-clip)">
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
      </g>
    </svg>
  );
}
