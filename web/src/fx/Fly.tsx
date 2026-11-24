import { useEffect, useRef, useState } from 'react';
import { reducedMotion } from '../director/runtime';
import { useHaunted, useStory } from '../store';
import { useFx } from './fxStore';
import { TopLayer } from './TopLayer';

/** Where the cake is on screen now (its card, or the product view if that is open). */
function cakeSpot(): { x: number; y: number } | null {
  let best: DOMRect | null = null;
  for (const el of document.querySelectorAll<HTMLElement>('[data-object="cake"]')) {
    const r = el.getBoundingClientRect();
    if (r.width < 60 || r.bottom < 0 || r.top > window.innerHeight) continue;
    if (!best || r.width > best.width) best = r;
  }
  return best ? { x: best.left + best.width * 0.42, y: best.top + best.height * 0.42 } : null;
}

function perchPoint(sel: string): { x: number; y: number } | null {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width * 0.72, y: r.top + 4 };
}

/**
 * The fly from the cake (Requirement 20.3). When the cake is taken it lifts off the cake and
 * flies to the search bar: a buzzing, looping path, wings a blur, the body turning the way it
 * goes. Then it settles there and moves off briefly when the pointer comes near.
 */
export function Fly() {
  const haunted = useHaunted();
  const played = useStory((s) => s.story.played.cake === true);
  const perch = useFx((s) => s.flyPerch) ?? (played ? '#site-search' : null);
  const takeoff = useFx((s) => s.flags['fly-takeoff'] !== undefined);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dodge, setDodge] = useState(false);
  const [flying, setFlying] = useState(false);
  const ref = useRef<SVGSVGElement>(null);

  // The flight: from the cake to the perch along a wandering curve, at a fly's speed.
  useEffect(() => {
    if (!haunted || !takeoff || !perch || reducedMotion()) return;
    const from = cakeSpot();
    const to = perchPoint(perch);
    const el = ref.current;
    if (!from || !to) return;
    let raf = 0;
    const t0 = performance.now();
    const DUR = 1700;
    const mid = { x: (from.x + to.x) / 2 + (to.y - from.y) * 0.25, y: Math.min(from.y, to.y) - 120 };
    const id = requestAnimationFrame(() => setFlying(true));
    // It always lands, even if a frame is missed or the view it flew over closes.
    const land = window.setTimeout(() => setFlying(false), DUR + 80);
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / DUR);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const u = 1 - e;
      // a quadratic arc, with the small fast loops of a fly on top of it
      const x = u * u * from.x + 2 * u * e * mid.x + e * e * to.x + Math.sin(t * 22) * 14 * (1 - t);
      const y = u * u * from.y + 2 * u * e * mid.y + e * e * to.y + Math.cos(t * 17) * 10 * (1 - t);
      const node = ref.current ?? el;
      if (node) {
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        const dx = 2 * u * (mid.x - from.x) + 2 * e * (to.x - mid.x);
        node.style.setProperty('--fly-turn', `${Math.max(-50, Math.min(50, dx / 20))}deg`);
      }
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(id);
      cancelAnimationFrame(raf);
      window.clearTimeout(land);
      setFlying(false);
    };
  }, [haunted, takeoff, perch]);

  useEffect(() => {
    if (!haunted || !perch) return;
    const place = () => {
      const p = perchPoint(perch);
      if (p) setPos(p);
    };
    place();
    const t = setInterval(place, 500);
    window.addEventListener('scroll', place, { passive: true });
    const onMove = (e: PointerEvent) => {
      const p = perchPoint(perch);
      if (!p) return;
      setDodge(Math.hypot(e.clientX - p.x, e.clientY - p.y) < 70);
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      clearInterval(t);
      window.removeEventListener('scroll', place);
      window.removeEventListener('pointermove', onMove);
    };
  }, [haunted, perch]);

  if (!haunted || !perch || !pos) return null;
  const fly = (
    <svg
      ref={ref}
      className={`fly${dodge ? ' dodge' : ''}${flying ? ' is-flying' : ''}`}
      style={flying ? undefined : { left: pos.x, top: pos.y }}
      viewBox="0 0 26 22"
      aria-hidden="true"
      data-testid="fly"
    >
      {/* legs */}
      <path d="M10 11 l-5 -2 M10 13 l-6 1 M10 15 l-5 4 M16 11 l5 -2 M16 13 l6 1 M16 15 l5 4" stroke="#111" strokeWidth="0.7" fill="none" strokeLinecap="round" />
      {/* wings: smoky, veined, held back over the body */}
      <g className="fly-wings">
        <path className="fly-wing l" d="M12 10 C 6 8, 1 11, 2 15 C 4 17, 9 15, 12 12 Z" />
        <path className="fly-wing r" d="M14 10 C 20 8, 25 11, 24 15 C 22 17, 17 15, 14 12 Z" />
        <path d="M11 11 L4 14 M12 11.5 L6 15.5 M15 11 L22 14 M14 11.5 L20 15.5" stroke="rgb(60 60 60 / 0.5)" strokeWidth="0.35" />
      </g>
      {/* abdomen with dark bands, thorax with stripes, head with big red eyes */}
      <ellipse cx="13" cy="15.5" rx="3.4" ry="4.6" fill="#2b2b28" />
      <path d="M10 14.5 h6 M10 16.6 h6 M10.6 18.6 h4.8" stroke="#0b0b0a" strokeWidth="0.9" />
      <ellipse cx="13" cy="10" rx="3.1" ry="2.8" fill="#3a3a35" />
      <path d="M12 8 v4 M14 8 v4" stroke="#151513" strokeWidth="0.6" />
      <circle cx="13" cy="6.2" r="2.2" fill="#1a1414" />
      <ellipse cx="11.6" cy="5.6" rx="1.4" ry="1.7" fill="#8a1410" />
      <ellipse cx="14.4" cy="5.6" rx="1.4" ry="1.7" fill="#8a1410" />
      <circle cx="11.2" cy="5.1" r="0.35" fill="#e8a090" opacity="0.7" />
      <circle cx="14" cy="5.1" r="0.35" fill="#e8a090" opacity="0.7" />
    </svg>
  );
  // In flight it is drawn above the product view too, so it can be seen leaving the cake.
  return flying ? <TopLayer>{fly}</TopLayer> : fly;
}
