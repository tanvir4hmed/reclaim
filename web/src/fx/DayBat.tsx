import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { reducedMotion, wait } from '../director/runtime';
import { dispatch, useStory } from '../store';
import { BatSvg } from './BatSvg';
import { useFx } from './fxStore';
import { nearbyPerches, perchSpot, type PerchSpot } from './perches';

const BAT_W = 64;

/**
 * The Day bat (Requirements 8, 9): hangs face-away from perches, flies between them, freezes
 * under the pointer, and is the only control that starts the Reveal.
 */
export function DayBat() {
  const phase = useStory((s) => s.story.phase);
  const perch = useFx((s) => s.batPerch);
  const flying = useFx((s) => s.batFlying);
  const hover = useFx((s) => s.batHover);
  const setFx = useFx((s) => s.set);
  const [spot, setSpot] = useState<PerchSpot | null>(null);
  const [hand, setHand] = useState<{ x: number; y: number } | null>(null);
  const tapAt = useRef(0);
  const ref = useRef<HTMLButtonElement>(null);

  // Re-measure the perch on layout changes.
  useEffect(() => {
    const measure = () => setSpot(perchSpot(perch, 0.35));
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(document.body);
    window.addEventListener('resize', measure);
    const t = setInterval(measure, 1500);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
      clearInterval(t);
    };
  }, [perch]);

  // Fly to a new perch every 15–40 s, staying near the visitor (Req 8.3, 8.2).
  useEffect(() => {
    if (phase !== 'day') return;
    let alive = true;
    const loop = async () => {
      await wait(3000);
      while (alive) {
        await wait(15000 + Math.random() * 25000);
        if (!alive) return;
        if (useFx.getState().batHover) continue;
        const options = nearbyPerches().filter((p) => p !== useFx.getState().batPerch);
        const next = options[Math.floor(Math.random() * options.length)];
        if (!next) continue;
        if (reducedMotion()) {
          setFx({ batPerch: next });
          continue;
        }
        setFx({ batFlying: true });
        await wait(1400);
        setFx({ batPerch: next });
        await wait(1100);
        setFx({ batFlying: false });
      }
    };
    void loop();
    return () => {
      alive = false;
    };
  }, [phase, setFx]);

  if (phase !== 'day' || !spot) return null;

  function catchBat() {
    setHand(null);
    setFx({ batHover: false });
    dispatch({ type: 'BAT_CAUGHT' });
  }

  function onPointerDown(e: RPointerEvent<HTMLButtonElement>) {
    if (e.pointerType !== 'touch') return;
    e.preventDefault();
    const now = performance.now();
    // Touch: first tap shows the hand and the signs, a second tap within 4 s catches (Req 9.12).
    // Read the store, not the render closure: a quick second tap can arrive before React re-renders (found by e2e).
    if (useFx.getState().batHover && now - tapAt.current < 4000) {
      catchBat();
    } else {
      tapAt.current = now;
      const r = ref.current?.getBoundingClientRect();
      if (r) setHand({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      setFx({ batHover: true });
      setTimeout(() => {
        if (performance.now() - tapAt.current >= 3990 && useFx.getState().batHover) {
          setFx({ batHover: false });
          setHand(null);
        }
      }, 4000);
    }
  }

  return (
    <>
      <button
        ref={ref}
        type="button"
        className={`day-bat${flying ? ' is-flying' : ''}${hover ? ' is-hovered' : ''}`}
        data-testid="day-bat"
        aria-label="Something on the lights"
        style={{ left: spot.x - BAT_W / 2, top: spot.y }}
        onPointerEnter={(e) => {
          if (e.pointerType === 'touch') return;
          setFx({ batHover: true });
          setHand({ x: e.clientX, y: e.clientY });
        }}
        onPointerMove={(e) => e.pointerType !== 'touch' && setHand({ x: e.clientX, y: e.clientY })}
        onPointerLeave={(e) => {
          if (e.pointerType === 'touch') return;
          setFx({ batHover: false });
          setHand(null);
        }}
        onFocus={() => setFx({ batHover: true })}
        onBlur={() => setFx({ batHover: false })}
        onPointerDown={onPointerDown}
        onClick={(e) => {
          if ((e.nativeEvent as PointerEvent).pointerType === 'touch') return;
          catchBat();
        }}
      >
        <BatSvg pose={flying ? 'fly' : 'hang'} />
      </button>
      {hand && <ReachingHand x={hand.x} y={hand.y} />}
    </>
  );
}

/** The cursor over the bat: an original reaching hand (Requirement 9.2). */
export function ReachingHand({ x, y, closed = false }: { x: number; y: number; closed?: boolean }) {
  return (
    <svg className={`reaching-hand${closed ? ' closed' : ''}`} style={{ left: x - 14, top: y - 6 }} viewBox="0 0 48 60" aria-hidden="true">
      <path
        d="M14 58 C10 46 6 40 6 32 C6 28 10 27 12 30 L15 35 L14 10 C14 6 19 6 19 10 L20 27 L21 6 C21 2 26 2 26 6 L27 27 L29 9 C29 5 34 5 34 9 L33 29 L36 16 C37 12 41 13 41 17 L39 36 C38 46 34 52 32 58 Z"
        fill="#e8d6c4"
        stroke="#3a2a22"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M16 46 C20 48 27 48 31 46" stroke="#3a2a22" strokeOpacity="0.4" strokeWidth="1.2" fill="none" />
    </svg>
  );
}
