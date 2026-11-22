import gsap from 'gsap';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { LUNGE_MS } from '../director/sequences';
import { useHaunted, useStory } from '../store';
import { BatSvg } from './BatSvg';
import { BAT_W } from './DayBat';
import { SkeletonHand } from './SkeletonHand';
import { useFx } from './fxStore';

/** Darkness between the DOM and the canvas: covers the UI, not flames and eyes (design z 2). */
export function Darkness() {
  const mains = useFx((s) => s.mains);
  const haunted = useHaunted();
  const base = haunted ? 0.08 : 0;
  return <div className="darkness" aria-hidden="true" style={{ opacity: Math.min(0.97, base + (1 - mains) * 0.92) }} />;
}

/**
 * The catch (Req 9.6–9.9). The bony fist closes where the visitor clicked; the bat's head jerks
 * round with glowing eyes and an open, fanged mouth; then it flies straight at the screen,
 * starting at its own size and growing smoothly, wings beating, until it blots out everything.
 */
export function CatchLunge() {
  const step = useFx((s) => s.catchStep);
  const from = useFx((s) => s.catchFrom);
  const hand = useFx((s) => s.catchHand);
  const batRef = useRef<HTMLDivElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = batRef.current;
    if (!el || step !== 'lunge') return;
    const w = from?.w ?? BAT_W;
    const x0 = from?.x ?? window.innerWidth / 2;
    const y0 = from?.y ?? window.innerHeight / 2;
    // Lay the bat out at its FINAL size (wings well past both screen edges) and shrink it
    // down to start from. The browser then draws the SVG and its fur at full resolution;
    // scaling a small element up instead is what made the close-up blurry.
    const final = Math.max(window.innerWidth * 1.9, window.innerHeight * 3);
    el.style.width = `${final}px`;
    // Centre it in GSAP (CSS `translate` is dropped once GSAP owns the transform).
    el.style.translate = 'none';
    // The face sits 24 of 244 viewBox units above the bat's centre: end with the face mid-screen.
    const faceDrop = (final * 24) / 244;
    const tl = gsap.timeline();
    tl.fromTo(
      el,
      { x: x0, y: y0, xPercent: -50, yPercent: -50, scale: w / final, rotate: 0 },
      {
        x: window.innerWidth / 2,
        y: window.innerHeight * 0.5 + faceDrop,
        xPercent: -50,
        yPercent: -50,
        scale: 1,
        rotate: 0,
        duration: LUNGE_MS / 1000,
        // Slow at first, then rushing at the glass: a creature flying closer, not a pop.
        ease: 'power3.in',
        onUpdate() {
          // A gentle wobble from the wing beats while it approaches.
          const p = this.progress();
          gsap.set(el, { rotate: Math.sin(p * Math.PI * 9) * 6 * (1 - p) });
        },
      },
    );
    if (shadeRef.current) tl.fromTo(shadeRef.current, { opacity: 0 }, { opacity: 1, duration: LUNGE_MS / 1000, ease: 'power4.in' }, 0);
    return () => {
      tl.kill();
    };
  }, [step, from]);

  if (step === 'none') return null;
  const pose = step === 'grab' ? 'hang' : 'fly';
  const placed = from && (step === 'grab' || step === 'turn');
  return (
    <div className={`lunge lunge-${step}`} aria-hidden="true" data-testid="lunge">
      <div ref={shadeRef} className="lunge-shade" />
      <div
        ref={batRef}
        className="lunge-bat"
        style={
          placed
            ? { transform: `translate(${from.x}px, ${from.y}px)`, width: from.w }
            : step === 'lunge'
              ? {}
              : { width: from?.w ?? BAT_W }
        }
      >
        <BatSvg pose={pose} facing={step === 'grab' ? 'away' : 'toward'} eyes={step !== 'grab'} mouth={step === 'grab' ? 'closed' : 'snarl'} />
      </div>
      {hand && (step === 'grab' || step === 'turn') && <SkeletonHand x={hand.x} y={hand.y} closed />}
      {step === 'dark' && <DarkEvents />}
    </div>
  );
}

/** In the dark: faint eyes open and close, breath fogs the glass, fingers trail (Req 9.8). */
export function DarkEvents() {
  const eyes = useMemo(
    () => Array.from({ length: 9 }, (_, i) => ({ x: 8 + ((i * 37) % 84), y: 12 + ((i * 53) % 70), d: (i % 5) * 0.35 })),
    [],
  );
  return (
    <div className="dark-events">
      {eyes.map((e, i) => (
        <span key={i} className="dark-eyes" style={{ left: `${e.x}%`, top: `${e.y}%`, animationDelay: `${e.d}s` }} />
      ))}
      <span className="breath-fog" />
      <svg className="finger-trails" viewBox="0 0 100 100" preserveAspectRatio="none">
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={`M${30 + i * 6} 20 C ${32 + i * 6} 40, ${28 + i * 6} 60, ${34 + i * 7} 92`} />
        ))}
      </svg>
    </div>
  );
}

/** The single tremor and the quiet after Accept (Req 22.7–22.8). */
export function Accepted() {
  const shown = useFx((s) => s.acceptedShown);
  const phase = useStory((s) => s.story.phase);
  if (!shown || phase !== 'accepted') return null;
  return (
    <div className="accepted" role="alert" data-testid="accepted">
      <p>Your order has been accepted.</p>
    </div>
  );
}
