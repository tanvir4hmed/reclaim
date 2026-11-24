import gsap from 'gsap';
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { reducedMotion, wait } from '../director/runtime';
import { dispatch, useStory } from '../store';
import { BatSvg, FLY_H, FLY_NEAR, FLY_W, flyBox, hangBox } from './BatSvg';
import { useFx } from './fxStore';
import { nearbyPerches, perchSpot, type PerchSpot } from './perches';
import { SkeletonHand } from './SkeletonHand';

/**
 * Flying, the Day bat takes off and lands at the scale it hangs at (FLY_W: wings spread it is
 * wider, its body smaller). In between it swells to FLY_NEAR times that, as it swoops close
 * past the screen, and shrinks back to land. It is laid out at the swollen size and scaled
 * down (`--fs`), so it is never blown up from a small raster.
 */
export const BAT_W = FLY_W;
const BIG_W = FLY_W * FLY_NEAR;
const BIG_H = FLY_H * FLY_NEAR;
/** From the perch line down to the middle of the hanging bat's body (the flight's centre line). */
const BODY_DROP = flyBox(0, 0).top + FLY_H / 2;

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
  const pointer = useRef<{ x: number; y: number } | null>(null);

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

  // Now and then it wakes: the eyes open, burning red, and the head turns to find the pointer
  // and follows it; then the eyes close and the head hangs straight again.
  useEffect(() => {
    if (phase !== 'day') return;
    let alive = true;
    void (async () => {
      await wait(3000);
      while (alive) {
        await wait(3000 + Math.random() * 4000);
        if (!alive || useFx.getState().batFlying || useFx.getState().batHover) continue;
        setLooking(true);
        await wait(1800 + Math.random() * 1200);
        setLooking(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [phase]);

  // Awake (looking, or reached for) the head follows the pointer; asleep it hangs straight.
  const awake = looking || hover;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!awake) {
      el.style.setProperty('--lx', '0');
      el.style.setProperty('--ly', '0');
      return;
    }
    const aim = (px: number, py: number) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.8;
      const lx = Math.max(-1, Math.min(1, (px - cx) / 260));
      const ly = Math.max(-1, Math.min(1, (py - cy) / 260));
      el.style.setProperty('--lx', lx.toFixed(3));
      el.style.setProperty('--ly', ly.toFixed(3));
    };
    const last = pointer.current;
    if (last) aim(last.x, last.y);
    const onMove = (e: PointerEvent) => aim(e.clientX, e.clientY);
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [awake, spot]);

  // Remember where the pointer is even while asleep, so the first look goes straight to it.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  // Fly to a new perch every 15–40 s along a smooth arc (Req 8.3), staying near the visitor (Req 8.2).
  useEffect(() => {
    if (phase !== 'day') return;
    let alive = true;
    const loop = async () => {
      await wait(3000);
      while (alive) {
        // It flies often: a restless thing, every 8–18 s.
        await wait(8000 + Math.random() * 10000);
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

  const facing = awake ? 'toward' : 'away';
  const glow = awake;

  return (
    <>
      <button
        ref={ref}
        type="button"
        className={`day-bat${flying ? ' is-flying' : ''}${hover ? ' is-hovered' : ''}${looking ? ' is-looking' : ''}`}
        data-testid="day-bat"
        aria-label="Something on the lights"
        style={flying ? flyBox(spot.x, spot.y, FLY_NEAR) : hangBox(spot.x, spot.y)}
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
        {/* Hanging: reached for, it opens its eyes and its mouth a little; otherwise lips shut over the fangs. */}
        <BatSvg pose={flying ? 'fly' : 'hang'} facing={flying ? 'toward' : facing} eyes={flying || glow} mouth={flying ? 'snarl' : hover ? 'open' : 'closed'} />
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
        // Perch to perch along the body's centre line.
        el.style.left = `${x - BIG_W / 2}px`;
        el.style.top = `${y + BODY_DROP - BIG_H / 2}px`;
        el.style.setProperty('--bank', `${bank}deg`);
        // Its own size at take-off and landing; nearer, so larger, in the middle of the swoop.
        el.style.setProperty('--fs', ((1 + (FLY_NEAR - 1) * Math.sin(t * Math.PI)) / FLY_NEAR).toFixed(4));
      },
      onComplete: () => resolve(),
    });
  });
}
