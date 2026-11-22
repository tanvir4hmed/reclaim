import { useEffect, useRef, useState } from 'react';
import { reducedMotion } from '../director/runtime';
import { BatSvg } from './BatSvg';
import { useFx } from './fxStore';
import { Rake } from './Overlays';
import { TopLayer } from './TopLayer';

/** The bat that was shut in the gift: out of the card, at you, and away over the page. */
export function FreedBat() {
  const bat = useFx((s) => s.freeBat);
  if (!bat) return null;
  return (
    <div key={bat.id} className="freed-bat" style={{ left: bat.x, top: bat.y }} aria-hidden="true" data-testid="freed-bat">
      <BatSvg pose="fly" facing="toward" eyes mouth="snarl" />
    </div>
  );
}

/** Where the candle is on screen right now (its card, or the product view if that is open). */
function candleSpot(): { x: number; y: number } {
  let best: DOMRect | null = null;
  for (const el of document.querySelectorAll<HTMLElement>('[data-object="candle"]')) {
    const r = el.getBoundingClientRect();
    if (r.width < 80 || r.bottom < 0 || r.top > window.innerHeight) continue;
    if (!best || r.width > best.width) best = r;
  }
  return best ? { x: best.left + best.width / 2, y: best.top + best.height * 0.45 } : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

/** Where the claws land, as fractions of the screen (the same raking hand as the bat's). */
const CANDLE_RAKES = [
  { x: 18, y: 10, rot: -20, s: 0.4, at: 0.7 },
  { x: 66, y: 22, rot: 16, s: 0.46, at: 1.5 },
  { x: 38, y: 52, rot: -32, s: 0.36, at: 2.4 },
];

/**
 * The candle is taken and goes out, and everything goes with it: the window is black. Claws
 * thud into the glass out of the dark, one, then another. The only light left is the candle's
 * own flame, and it is in your hand now: it follows the pointer and lights a little circle of
 * the window around it, enough to find the way out. Taken in the product view, the dark lasts
 * until that view is closed; taken from the shop, until the flag ends. Then the light returns.
 */
export function CandleDark() {
  // `candle-dark` while it is out (the director keeps it until the product view closes, if it
  // was taken there); `candle-back` for the moment the light returns.
  const on = useFx((s) => s.flags['candle-dark'] !== undefined);
  const back = useFx((s) => s.flags['candle-back'] !== undefined);
  const shown = on || back;
  const ref = useRef<HTMLDivElement>(null);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);

  // It starts where the candle was; from then on the flame is the pointer.
  useEffect(() => {
    if (!on) return;
    const id = requestAnimationFrame(() => setStart(candleSpot()));
    const root = document.documentElement;
    root.classList.add('candle-cursor');
    const move = (e: PointerEvent) => {
      ref.current?.style.setProperty('--cx', `${e.clientX}px`);
      ref.current?.style.setProperty('--cy', `${e.clientY}px`);
    };
    window.addEventListener('pointermove', move, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(id);
      root.classList.remove('candle-cursor');
      window.removeEventListener('pointermove', move, { capture: true });
    };
  }, [on]);

  if (!shown || !start) return null;
  const still = reducedMotion();
  return (
    <TopLayer>
      <div
        ref={ref}
        className={`candle-dark${on ? '' : ' candle-dark-out'}${still ? ' candle-dark-still' : ''}`}
        aria-hidden="true"
        data-testid="candle-dark"
        style={{ ['--cx' as string]: `${start.x}px`, ['--cy' as string]: `${start.y}px` }}
      >
        <svg className="candle-claws" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
          {CANDLE_RAKES.map((r, i) => (
            <g key={i} className="candle-rake" style={{ animationDelay: still ? '0s' : `${r.at}s` }}>
              <Rake x={r.x} y={r.y} rot={r.rot} s={r.s} />
            </g>
          ))}
        </svg>
        <div className="candle-light" />
        <svg className="candle-flame" viewBox="-12 -34 24 40" data-testid="candle-flame">
          <defs>
            <radialGradient id="cf-core" cx="50%" cy="70%" r="60%">
              <stop offset="0" stopColor="#fff6d8" />
              <stop offset="0.45" stopColor="#ffc35a" />
              <stop offset="1" stopColor="#d2521a" stopOpacity="0.1" />
            </radialGradient>
          </defs>
          <ellipse cx="0" cy="-10" rx="11" ry="16" fill="rgb(255 150 60 / 0.18)" />
          <path className="candle-flame-body" d="M0 -30 C 5 -20, 8 -12, 7 -5 C 6 1, 3 4, 0 4 C -3 4, -6 1, -7 -5 C -8 -12, -4 -18, 0 -30 Z" fill="url(#cf-core)" />
          <path d="M0 -14 C 2 -9, 3 -5, 2 -2 C 1 0, -1 0, -2 -2 C -3 -5, -2 -9, 0 -14 Z" fill="#5a7bd8" opacity="0.5" />
          <rect x="-0.7" y="0" width="1.4" height="5" fill="#1a1210" />
        </svg>
      </div>
    </TopLayer>
  );
}
