export interface Point {
  x: number;
  y: number;
}

export interface Print extends Point {
  /** Heading in radians (0 = pointing right). */
  angle: number;
  foot: 'left' | 'right';
}

/**
 * Footprints from a card to the cart icon (Requirement 13.3): a smoothed random walk that turns
 * now left, now right, prints placed one stride apart, alternating feet, ending at the cart.
 * Pure: randomness comes from `rand` so the path can be tested.
 */
export function footprintPath(from: Point, to: Point, rand: () => number, stride = 34, gait = 9): Print[] {
  const total = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(4, Math.round((total * 1.25) / stride));
  // Waypoints wander off the straight line, then the walk is pulled home toward the cart.
  const pts: Point[] = [];
  let heading = Math.atan2(to.y - from.y, to.x - from.x) + (rand() - 0.5) * 1.6;
  let p = { ...from };
  for (let i = 0; i < steps; i++) {
    const left = steps - i;
    const want = Math.atan2(to.y - p.y, to.x - p.x);
    const pull = 1 / Math.max(1, left - 1);
    let d = want - heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    heading += d * Math.min(1, 0.25 + pull) + (rand() - 0.5) * 0.9 * (left > 3 ? 1 : 0);
    const len = Math.min(stride, Math.hypot(to.x - p.x, to.y - p.y) / Math.max(1, left - 1 || 1));
    p = { x: p.x + Math.cos(heading) * len, y: p.y + Math.sin(heading) * len };
    pts.push(p);
  }
  pts[pts.length - 1] = { ...to };
  return pts.map((q, i) => {
    const prev = i === 0 ? from : (pts[i - 1] as Point);
    const angle = Math.atan2(q.y - prev.y, q.x - prev.x);
    const foot = i % 2 === 0 ? 'left' : 'right';
    const side = foot === 'left' ? -1 : 1;
    const off = i === pts.length - 1 ? 0 : gait;
    return {
      x: q.x + Math.cos(angle + Math.PI / 2) * side * off,
      y: q.y + Math.sin(angle + Math.PI / 2) * side * off,
      angle,
      foot,
    };
  });
}

/** Mulberry32: tiny seeded generator for repeatable effects. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
