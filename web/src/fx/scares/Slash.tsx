import { useState } from 'react';

/** The bear's neck on screen: a third of the way down its biggest visible picture. */
function neckLine(): { y: number } {
  let best: DOMRect | null = null;
  for (const el of document.querySelectorAll<HTMLElement>('[data-object="teddy-bear"]')) {
    const r = el.getBoundingClientRect();
    if (r.width < 80 || r.bottom < 0 || r.top > window.innerHeight) continue;
    if (!best || r.width > best.width) best = r;
  }
  return { y: best ? best.top + best.height * 0.4 : window.innerHeight * 0.45 };
}

/**
 * Teddy: one sword stroke across the window, through the bear's neck. A single bright streak
 * (one flash, well under the three-per-second limit), then a thin red line where it cut that
 * fades. The bear itself comes apart in its model.
 */
export function TeddySlash() {
  const [{ y }] = useState(neckLine);
  const w = window.innerWidth;
  const h = window.innerHeight;
  // Slightly downhill, left to right, like a right-handed swing.
  const d = `M ${-40} ${y - h * 0.07} L ${w + 40} ${y + h * 0.07}`;
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
    </svg>
  );
}
