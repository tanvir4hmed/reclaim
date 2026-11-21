import gsap from 'gsap';
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { reducedMotion, wait } from '../director/runtime';
import { dispatch, useStory } from '../store';
import { BatSvg } from './BatSvg';
import { useFx } from './fxStore';
import { nearbyPerches, perchSpot, type PerchSpot } from './perches';
import { SkeletonHand } from './SkeletonHand';

/** Rendered size of the Day bat (the SVG keeps its 244:152 aspect). */
export const BAT_W = 112;
const BAT_H = Math.round((BAT_W * 152) / 244);
/** Hanging, wings wrapped: a tall, narrow shape. */
const HANG_W = 78;
const HANG_H = Math.round((HANG_W * 136) / 92);

/**
 * The Day bat (Requirements 8, 9). It hangs face-away from a perch; now and then it turns its
 * head to the screen and its eyes light up. It flies between perches along a curved, bobbing
 * path. Over it the cursor becomes a skeletal pointing hand; a click closes the hand on it.
 */
export function DayBat() {
  const phase = useStory((s) => s.story.phase);
  const perch = useFx((s) => s.batPerch);
  const flying = useFx((s) => s.batFlying);
  const hover = useFx((s) => s.batHover);
  const setFx = useFx((s) => s.set);
  const [spot, setSpot] = useState<PerchSpot | null>(null);
  const [hand, setHand] = useState<{ x: number; y: number } | null>(null);
  const [looking, setLooking] = useState(false);
  const tapAt = useRef(0);
  const ref = useRef<HTMLButtonElement>(null);
  const spotRef = useRef<PerchSpot | null>(null);

  // Re-measure the perch on layout changes (not during a flight: the flight moves the bat itself).
  useEffect(() => {
    const measure = () => {
      if (useFx.getState().batFlying) return;
      const s = perchSpot(perch, 0.35);
      spotRef.current = s;
      setSpot(s);
    };
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

  // Now and then the head turns to the screen and the eyes light up (a horror beat, not a scare).
  useEffect(() => {
    if (phase !== 'day') return;
    let alive = true;
    void (async () => {
      await wait(4000);
      while (alive) {
        await wait(7000 + Math.random() * 9000);
        if (!alive || useFx.getState().batFlying || useFx.getState().batHover) continue;
        setLooking(true);
        await wait(2200 + Math.random() * 1200);
        setLooking(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [phase]);

  // Fly to a new perch every 15–40 s along a smooth arc (Req 8.3), staying near the visitor (Req 8.2).
  useEffect(() => {
    if (phase !== 'day') return;
    let alive = true;
    const loop = async () => {
      await wait(3000);
      while (alive) {
        await wait(15000 + Math.random() * 25000);
        if (!alive || useFx.getState().batHover) continue;
        const options = nearbyPerches().filter((p) => p !== useFx.getState().batPerch);
        const next = options[Math.floor(Math.random() * options.length)];
        const to = next ? perchSpot(next, 0.35) : null;
        const from = spotRef.current;
        const el = ref.current;
        if (!next || !to || !from || !el) continue;
        if (reducedMotion()) {
          setFx({ batPerch: next });
          continue;
        }
        setLooking(false);
        setFx({ batFlying: true });
        await flyAlong(el, from, to);
        if (!alive) return;
        setFx({ batPerch: next, batFlying: false });
      }
    };
    void loop();
    return () => {
      alive = false;
    };
  }, [phase, setFx]);

  if (phase !== 'day' || !spot) return null;

  function catchBat(x: number, y: number) {
    const r = ref.current?.getBoundingClientRect();
    setHand(null);
    setFx({
      batHover: false,
      catchFrom: r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width } : { x, y, w: BAT_W },
      catchHand: { x, y },
    });
    dispatch({ type: 'BAT_CAUGHT' });
  }

  function onPointerDown(e: RPointerEvent<HTMLButtonElement>) {
    if (e.pointerType !== 'touch') return;
    e.preventDefault();
    const now = performance.now();
    // Touch: first tap shows the hand and the signs, a second tap within 4 s catches (Req 9.12).
    // Read the store, not the render closure: a quick second tap can arrive before React re-renders (found by e2e).
    if (useFx.getState().batHover && now - tapAt.current < 4000) {
      catchBat(e.clientX, e.clientY);
    } else {
      tapAt.current = now;
      const r = ref.current?.getBoundingClientRect();
      if (r) setHand({ x: r.left + r.width / 2, y: r.top + r.height * 0.6 });
      setFx({ batHover: true });
      setTimeout(() => {
        if (performance.now() - tapAt.current >= 3990 && useFx.getState().batHover) {
          setFx({ batHover: false });
          setHand(null);
        }
      }, 4000);
    }
  }

  const facing = hover || looking ? 'toward' : 'away';
  const glow = hover || looking;

  return (
    <>
      <button
        ref={ref}
        type="button"
        className={`day-bat${flying ? ' is-flying' : ''}${hover ? ' is-hovered' : ''}${looking ? ' is-looking' : ''}`}
        data-testid="day-bat"
        aria-label="Something on the lights"
        style={flying ? { left: spot.x - BAT_W / 2, top: spot.y - 6, width: BAT_W, height: BAT_H } : { left: spot.x - HANG_W / 2, top: spot.y - 4, width: HANG_W, height: HANG_H }}
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
          const r = ref.current?.getBoundingClientRect();
          // Keyboard "clicks" have no pointer position: grab at the bat's centre.
          const x = e.clientX || (r ? r.left + r.width / 2 : 0);
          const y = e.clientY || (r ? r.top + r.height / 2 : 0);
          catchBat(x, y);
        }}
      >
        <BatSvg pose={flying ? 'fly' : 'hang'} facing={flying ? 'away' : facing} eyes={glow} mouth={hover ? 'snarl' : 'open'} />
      </button>
      {hand && <SkeletonHand x={hand.x} y={hand.y} />}
    </>
  );
}

/**
 * A flight from one perch to another: drop off the perch, beat the wings along a curved path
 * that rises over the page, bob with each wing beat, bank into the turn, and hook back on.
 */
function flyAlong(el: HTMLElement, from: PerchSpot, to: PerchSpot): Promise<void> {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  const lift = Math.min(260, 80 + dist * 0.35);
  const c = { x: from.x + dx / 2 + (Math.random() - 0.5) * dist * 0.4, y: Math.min(from.y, to.y) - lift };
  const st = { t: 0 };
  return new Promise((resolve) => {
    gsap.to(st, {
      t: 1,
      duration: Math.min(3.2, 1.4 + dist / 650),
      ease: 'sine.inOut',
      onUpdate: () => {
        const t = st.t;
        const u = 1 - t;
        // Quadratic Bezier, plus a bob that follows the wing beat.
        const x = u * u * from.x + 2 * u * t * c.x + t * t * to.x;
        const y = u * u * from.y + 2 * u * t * c.y + t * t * to.y + Math.sin(t * Math.PI * 14) * 5 * Math.sin(t * Math.PI);
        const vx = 2 * u * (c.x - from.x) + 2 * t * (to.x - c.x);
        const bank = Math.max(-22, Math.min(22, vx / 30));
        el.style.left = `${x - BAT_W / 2}px`;
        el.style.top = `${y - 6}px`;
        el.style.setProperty('--bank', `${bank}deg`);
      },
      onComplete: () => resolve(),
    });
  });
}
