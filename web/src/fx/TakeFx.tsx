import { useEffect, useState } from 'react';
import { BatSvg } from './BatSvg';
import { useFx } from './fxStore';

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

/**
 * The candle is taken and goes out, and the whole page goes with it: black, except the
 * faintest shape of the candle itself. Then, slowly, the shop comes back.
 */
export function CandleDark() {
  const on = useFx((s) => s.flags['candle-dark'] !== undefined);
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!on) return;
    const id = requestAnimationFrame(() => setSpot(candleSpot()));
    return () => cancelAnimationFrame(id);
  }, [on]);
  if (!on || !spot) return null;
  return (
    <div
      className="candle-dark"
      aria-hidden="true"
      data-testid="candle-dark"
      style={{ background: `radial-gradient(circle at ${spot.x}px ${spot.y}px, rgb(0 0 0 / 0.55) 0, rgb(0 0 0 / 0.9) 70px, #000 150px)` }}
    />
  );
}
