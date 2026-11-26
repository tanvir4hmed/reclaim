import { useState } from 'react';
import { useTaken } from '../gl/useTaken';
import { FootprintShape } from './Decals';

/**
 * Where each bloody print falls, in the shoe picture's own 0..100 square: [x, y, heading in
 * degrees (0 points right), foot]. The shoes stand in the middle, toes to the front left. The
 * walk starts where the right shoe (the one behind) would step next, just in front of its toe,
 * goes off along the floor in front of the pair, right, left, right, then turns away up past
 * the left shoe's toe. Seven prints, then nothing. Kept clear of the shoes both on the card
 * and in the product view, which frame them a little differently.
 */
const WALK: [number, number, number, 'left' | 'right'][] = [
  [47, 80, 152, 'right'],
  [33, 89, 170, 'left'],
  [19, 87, 192, 'right'],
  [8, 78, 226, 'left'],
  [5.5, 63, 258, 'right'],
  [8, 48, 274, 'left'],
  [6, 34, 264, 'right'],
];
/** About an inch long in the product view (18 of the picture's 100 units). */
const PRINT_SCALE = 0.38;
/** Seconds: the blood wells out from under the shoes first (in their model), the first steps are slow, then it walks. */
const DELAYS = [1.3, 2.4, 3.1, 3.7, 4.3, 4.9, 5.5];

/**
 * Shoes (Requirement 13.3–13.4, revised in round 11). Taken, blood wells out from under the
 * whole of both soles (drawn by the shoes' model, products/shoes, as a pool on their floor),
 * then one slow print, a second, and five more, right and left, about an inch long in the
 * product view; then it stops. It is drawn inside the shoes' own picture, the product view or
 * the card on the shelf, and never anywhere else on the page. If the shoes were already taken
 * when the picture appears (a reload, or the card behind the view), the prints are simply there.
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
