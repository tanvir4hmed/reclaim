import { useEffect, useState } from 'react';
import { useHaunted, useStory } from '../store';
import { useFx } from './fxStore';

/**
 * The fly from the cake (Requirement 20.3). After the cake is carted it settles on a part of
 * the shop UI and moves off briefly when the pointer comes near.
 */
export function Fly() {
  const haunted = useHaunted();
  const played = useStory((s) => s.story.played.cake === true);
  const perch = useFx((s) => s.flyPerch) ?? (played ? '#site-search' : null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dodge, setDodge] = useState(false);

  useEffect(() => {
    if (!haunted || !perch) return;
    const place = () => {
      const el = document.querySelector(perch);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPos({ x: r.left + r.width * 0.72, y: r.top + 4 });
    };
    place();
    const t = setInterval(place, 500);
    window.addEventListener('scroll', place, { passive: true });
    const onMove = (e: PointerEvent) => {
      const el = document.querySelector(perch);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const near = Math.hypot(e.clientX - (r.left + r.width * 0.72), e.clientY - r.top) < 70;
      setDodge(near);
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      clearInterval(t);
      window.removeEventListener('scroll', place);
      window.removeEventListener('pointermove', onMove);
    };
  }, [haunted, perch]);

  if (!haunted || !perch || !pos) return null;
  return (
    <svg
      className={`fly${dodge ? ' dodge' : ''}`}
      style={{ left: pos.x, top: pos.y }}
      viewBox="0 0 20 14"
      aria-hidden="true"
      data-testid="fly"
    >
      <ellipse className="fly-wing l" cx="7" cy="4" rx="5" ry="2.6" />
      <ellipse className="fly-wing r" cx="13" cy="4" rx="5" ry="2.6" />
      <ellipse cx="10" cy="8" rx="3.2" ry="4.4" fill="#141414" />
      <circle cx="10" cy="3.6" r="2.2" fill="#2a1010" />
    </svg>
  );
}
