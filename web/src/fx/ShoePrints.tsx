import { useState } from 'react';
import { useTaken } from '../gl/useTaken';
import { FootprintShape } from './Decals';

/**
 * Where each bloody print falls, in the shoe picture's own 0..100 square: [x, y, heading in
 * degrees (0 points right), foot]. The walk starts right under the boots and goes off along
 * the floor in front of them, left, right, left, then turns away. Seven prints, then nothing.
 */
const WALK: [number, number, number, 'left' | 'right'][] = [
  [78, 85, 196, 'left'],
  [63, 92, 184, 'right'],
  [48, 86, 180, 'left'],
  [33, 92, 184, 'right'],
  [19, 85, 204, 'left'],
  [11, 72, 246, 'right'],
  [17, 58, 268, 'left'],
];
/** About an inch long in the product view (18 of the picture's 100 units). */
const PRINT_SCALE = 0.38;
/** Seconds: the blood seeps out from under the boots first, the first steps are slow, then it walks. */
const DELAYS = [1.3, 2.4, 3.1, 3.7, 4.3, 4.9, 5.5];

/**
 * Shoes (Requirement 13.3–13.4, revised in round 11). Taken, blood seeps out from under the
 * boots, then one slow print, a second, and five more, left and right, about an inch long in
 * the product view; then it stops. It is drawn inside the shoes' own picture, the product view
 * or the card on the shelf, and never anywhere else on the page. If the shoes were already
 * taken when the picture appears (a reload, or the card behind the view), the prints are
 * simply there.
 */
export function ShoePrints() {
  const { taken } = useTaken('shoes');
  const [still] = useState(taken);
  if (!taken) return null;
  return (
    <svg
      className={`shoe-prints${still ? ' is-still' : ''}`}
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      data-testid="shoe-prints"
    >
      {/* what has run out from under the boots */}
      <path className="shoe-pool" d="M60 79 C 63 76.6, 70 76.2, 76 77 C 80 77.6, 82 79.4, 79 81 C 75 82.6, 69 81.8, 66 82.4 C 62 83, 58 81.6, 60 79 Z" />
      {WALK.map(([x, y, a, foot], i) => (
        <g
          key={i}
          className="shoe-print"
          style={{ animationDelay: `${DELAYS[i]}s` }}
          transform={`translate(${x} ${y}) rotate(${a}) scale(${PRINT_SCALE})`}
        >
          <FootprintShape foot={foot} />
        </g>
      ))}
    </svg>
  );
}
