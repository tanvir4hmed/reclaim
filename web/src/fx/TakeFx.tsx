import { useEffect, useRef } from 'react';
import { reducedMotion } from '../director/runtime';
import { useHaunted, useStory } from '../store';
import { BatSvg } from './BatSvg';
import { useFx } from './fxStore';
import { TopLayer, useOpenDialog } from './TopLayer';

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

/**
 * The candle is taken and goes out, and the product view's light was its light: the view goes
 * dim, not black. Everything is still there. The candle's own picture is not dimmed from here:
 * the model darkens it itself and keeps its smoke bright (products/candle). It stays dim while
 * the view is open, and every time the candle's view is opened again after it was taken.
 * In the dark the close button is hard to find, so as the pointer comes near it a little warm
 * light, like a candle's, comes up round it.
 */
export function CandleDark() {
  const on = useFx((s) => s.flags['candle-dark'] !== undefined);
  const played = useStory((s) => s.story.played.candle === true);
  const haunted = useHaunted();
  const out = played && haunted;
  const dialog = useOpenDialog();
  const isCandle = typeof window !== 'undefined' && window.location.pathname.startsWith('/product/candle');
  const show = !!dialog && (on || (out && isCandle));
  const dim = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!show || !dialog) return;
    let raf = 0;
    let px = -1e4;
    let py = -1e4;
    const onMove = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
    };
    const step = () => {
      raf = requestAnimationFrame(step);
      const d = dim.current;
      const canvas = dialog.querySelector('[data-testid="inspection-canvas"]');
      if (d) {
        const W = window.innerWidth;
        const H = window.innerHeight;
        const r = canvas?.getBoundingClientRect();
        // a hole over the candle's own picture
        d.style.clipPath = r ? `path(evenodd, 'M0 0H${W}V${H}H0Z M${r.left} ${r.top}H${r.right}V${r.bottom}H${r.left}Z')` : 'none';
      }
      const g = glow.current;
      const close = dialog.querySelector('.pv-close');
      if (g && close) {
        const b = close.getBoundingClientRect();
        const cx = b.left + b.width / 2;
        const cy = b.top + b.height / 2;
        const k = Math.max(0, 1 - Math.hypot(px - cx, py - cy) / 220);
        g.style.left = `${cx}px`;
        g.style.top = `${cy}px`;
        g.style.opacity = (k * k * (3 - 2 * k)).toFixed(3);
      }
    };
    raf = requestAnimationFrame(step);
    window.addEventListener('pointermove', onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
    };
  }, [show, dialog]);
  if (!show) return null;
  return (
    <TopLayer stick>
      <div ref={dim} className={`candle-dim${reducedMotion() || !on ? ' candle-dim-still' : ''}`} aria-hidden="true" data-testid="candle-dark" />
      <div ref={glow} className="candle-find" aria-hidden="true" />
    </TopLayer>
  );
}
