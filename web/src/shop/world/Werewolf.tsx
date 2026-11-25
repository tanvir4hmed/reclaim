import { useEffect, useRef } from 'react';
import { wait } from '../../director/runtime';
import { seeded } from './noise';
import { useStill } from './useStill';

const HOWL_MS = 2600;

/** The broken bell tower it stands on: one of the near ruins, its top against the moon. */
function Tower() {
  return (
    <g>
      <path
        d="M14 520L18 330L20 236L22 160L27 154L30 161L36 150L42 152L48 144L53 140L80 139L83 133L89 136L95 127L99 132L101 236L104 330L108 520Z"
        fill="#0b0606"
      />
      {/* a beam that held the bell, snapped */}
      <path d="M99 170L124 160L125 163L100 174Z" fill="#0b0606" />
      {/* the belfry window and one lower down, red sky through them */}
      <path d="M50 262L50 222Q60 202 70 222L70 262Z" fill="#781812" fillOpacity="0.5" />
      <path d="M60 210L60 262" stroke="#0b0606" strokeWidth="2.4" />
      <path d="M36 382L36 360Q42 350 48 360L48 382Z" fill="#781812" fillOpacity="0.4" />
      <path d="M40 382L44 372L48 382Z" fill="#0b0606" />
    </g>
  );
}

/**
 * Far off, on a broken bell tower against the bottom of the red moon, a werewolf watches the
 * street. Now and then, 14 to 22 seconds apart and never on a beat, it lifts its head and howls
 * for a few seconds, then lowers it again.
 *
 * Laid over the moon painted by HauntedWorld (74% across, 24% down, radius 14% of the height):
 * in this viewBox the moon's centre is (40, 0) and its radius 140. Decorative (aria-hidden);
 * under reduced motion it holds the howl, and no timers run.
 */
export function Werewolf() {
  const ref = useRef<SVGSVGElement>(null);
  const still = useStill();
  useEffect(() => {
    const el = ref.current;
    if (!el || still) return;
    const ctrl = new AbortController();
    const s = ctrl.signal;
    const r = seeded(613);
    void (async () => {
      // The first one comes sooner, so a visitor who stays a little while hears it.
      await wait(6000 + r() * 3000, s);
      while (!s.aborted) {
        el.dataset.howl = 'on';
        await wait(HOWL_MS, s);
        delete el.dataset.howl;
        // 14 to 22 seconds from the start of one howl to the next.
        await wait(14000 + r() * 8000 - HOWL_MS, s);
      }
    })();
    return () => {
      ctrl.abort();
      delete el.dataset.howl;
    };
  }, [still]);
  return (
    <svg ref={ref} className="world-wolf" viewBox="0 0 160 520" aria-hidden="true" focusable="false" data-still={still}>
      <defs>
        {/* moonlight round the edge of the silhouette only */}
        <filter id="rc-wolf-rim" x="-30%" y="-30%" width="160%" height="160%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="1.1" result="fat" />
          <feFlood floodColor="#ff6a4f" floodOpacity="0.55" />
          <feComposite in2="fat" operator="in" />
          <feGaussianBlur stdDeviation="0.7" result="rim" />
          <feMerge>
            <feMergeNode in="rim" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <Tower />
      <g transform="translate(66 140) scale(0.9)" filter="url(#rc-wolf-rim)" fill="#060304">
        {/* far hind leg, then the tail, then the near hind leg */}
        <path
          transform="translate(7 -1)"
          d="M22-58C28-46 20-35 8-31L15-16C15-10 12-5 12-1L9 0L6-1.5L4 0.5L1-1L-2 0.8L-4-0.6L-1-3C2-4 4-6 4-12L-5-29C-8-38-2-52 8-60Z"
        />
        <path d="M24-55C33-52 40-42 40-28C40-20 37-12 39-4L36-7L35.5-2L33-8L31-4C30-14 31-28 27-38C25-44 21-48 18-50Z" />
        <path d="M22-58C28-46 20-35 8-31L15-16C15-10 12-5 12-1L9 0L6-1.5L4 0.5L1-1L-2 0.8L-4-0.6L-1-3C2-4 4-6 4-12L-5-29C-8-38-2-52 8-60Z" />
        {/* the body turns about the hips: the chest rises when it howls */}
        <g className="wolf-body">
          <path
            transform="translate(6 -2)"
            d="M-4-95C-11-88-15-80-17-70L-20-55C-21-52-23-49-25-46L-28-38L-24.5-43L-24-36L-21.5-43L-19.5-37L-18.5-44L-16-40L-16.5-48L-13-68C-10-77-3-86 3-91Z"
          />
          <path d="M27-55C29-68 22-86 6-98C1-101-6-103-11-101C-18-96-21-86-18-76C-15-68-8-61 0-56C6-50 16-48 27-55Z" />
          {/* the ruff, and shaggy fur on the chest and back */}
          <path d="M-21-86L-26-91L-20-93L-25-100L-17-99L-19-107L-11-103L-10-111L-4-104L0-109L2-101L9-102L5-96L12-94L4-91Z" />
          <path d="M-18-80L-23-78L-18-75L-22-71L-16-70ZM18-84L24-84L20-88L25-91L17-92Z" />
          <path d="M-4-95C-11-88-15-80-17-70L-20-55C-21-52-23-49-25-46L-28-38L-24.5-43L-24-36L-21.5-43L-19.5-37L-18.5-44L-16-40L-16.5-48L-13-68C-10-77-3-86 3-91Z" />
          {/* the head turns about the neck; the jaw drops about its hinge */}
          <g className="wolf-head">
            <path d="M-9-109L-3-124L-1.5-107Z" />
            <path d="M-15-110L-11-127L-6-111Z" />
            <path d="M-3-103C-3-111-10-116-19-114C-23-113-26-111-29-109L-40-106.5C-41.5-106-42-104.5-41-103.5L-38.5-101.8L-24-100.4L-15-98.2C-9-97-4-99-3-103Z" />
            <path d="M-14-98L-16-94L-12-96L-11-92L-8-96Z" />
            <path d="M-36.5-101.9L-35.6-99.6L-34.7-101.7Z" />
            <g className="wolf-jaw">
              <path d="M-15.5-99L-37-101.2L-36.4-99.6L-26-97.2C-20-96-16-96-14-97.5Z" />
              <path d="M-34.2-100.2L-33.3-102.3L-32.4-100.1Z" />
            </g>
            <circle cx="-24.5" cy="-107" r="0.9" fill="#ffb070" opacity="0.6" />
          </g>
        </g>
      </g>
    </svg>
  );
}
