import gsap from 'gsap';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { LUNGE_MS } from '../director/sequences';
import { useHaunted, useStory } from '../store';
import { BatSvg, FLY_FACE_Y, FLY_MOUTH_Y, FLY_W } from './BatSvg';
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
  const mawRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = batRef.current;
    const maw = mawRef.current;
    if (!el || step !== 'lunge') return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const x0 = from?.x ?? vw / 2;
    const y0 = from?.y ?? vh / 2;
    // Lay the bat out at its FINAL size (wings well past both screen edges) and shrink it
    // down to start from. The browser then draws the SVG and its fur at full resolution;
    // scaling a small element up instead is what made the close-up blurry.
    const final = Math.max(vw * 1.9, vh * 3);
    el.style.width = `${final}px`;
    // Centre it in GSAP (CSS `translate` is dropped once GSAP owns the transform).
    el.style.translate = 'none';
    const unit = final / 244;
    // At scale 1, the face sits this far above the bat's centre, and the open mouth this far.
    const faceOff = -FLY_FACE_Y * unit;
    const mouthOff = -FLY_MOUTH_Y * unit;
    // Where it looks at you from: centred, eyes just above the middle of the screen.
    const faceX = vw / 2;
    const faceY = vh * 0.435;
    const approach = (LUNGE_MS / 1000) * 0.72;
    const engulf = (LUNGE_MS / 1000) * 0.28;
    const tl = gsap.timeline();
    const s0 = FLY_W / final;
    // A steady, gentle glide toward the glass: it grows by the same proportion every moment
    // (size s0^(1-t)), so it never seems to stall far off or pop up at the end.
    const glide = (t: number) => (Math.pow(s0, 1 - t) - s0) / (1 - s0);
    // It starts at its own flying size, where it was caught. Centre and scale share one
    // ease, so its face travels in a straight line to the focal point while it grows.
    tl.fromTo(
      el,
      { x: x0, y: y0, xPercent: -50, yPercent: -50, scale: s0, rotate: 0 },
      {
        x: faceX,
        y: faceY + faceOff,
        xPercent: -50,
        yPercent: -50,
        scale: 1,
        rotate: 0,
        duration: approach,
        ease: glide,
        onUpdate() {
          const p = this.progress();
          // A small wobble from the wing beats; it darkens a little as it blocks the light,
          // but its face stays readable.
          gsap.set(el, {
            // a slow, slight sway with its wing beats as it glides in
            rotate: Math.sin(p * Math.PI * 4) * 2 * (1 - p),
            // only a little darker as it blocks the light: the red of its wings stays
            filter: `brightness(${(1 - 0.18 * p).toFixed(3)}) saturate(${(1 - 0.1 * p).toFixed(3)})`,
          });
        },
      },
    );
    // Then the dark comes out of it: still closing in around its open mouth, the black of
    // its throat spreads until it covers the screen.
    const mouthY = faceY + faceOff - mouthOff;
    const k = { s: 1 };
    tl.to(k, {
      s: 1.6,
      duration: engulf,
      ease: 'power2.in',
      onUpdate: () => gsap.set(el, { scale: k.s, y: mouthY + mouthOff * k.s }),
    });
    if (maw) {
      const reach = Math.hypot(vw, vh) * 1.15;
      gsap.set(maw, { left: faceX, top: mouthY, width: reach * 2, height: reach * 2, xPercent: -50, yPercent: -50 });
      tl.fromTo(maw, { scale: (9 * unit) / reach, opacity: 0 }, { scale: 1, opacity: 1, duration: engulf, ease: 'power2.in' }, approach);
    }
    // Fully black a moment before the lunge ends, so the hand-over to the dark step is seamless.
    const shade = shadeRef.current;
    if (shade) tl.fromTo(shade, { opacity: 0 }, { opacity: 1, duration: engulf * 0.4, ease: 'power1.in' }, approach + engulf * 0.45);
    return () => {
      tl.kill();
      // Hand the shade back to the stylesheet (the dark step holds it at full black).
      if (shade) gsap.set(shade, { clearProps: 'opacity' });
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
          // Caught hanging, it is held at its hanging size; once it turns it opens its wings at
          // its own flying size (the same scale), and the lunge grows it from there.
          placed
            ? { transform: `translate(${from.x}px, ${from.y}px)`, width: step === 'turn' ? FLY_W : from.w }
            : step === 'lunge'
              ? {}
              : { width: step === 'grab' ? (from?.w ?? BAT_W) : FLY_W }
        }
      >
        <BatSvg pose={pose} facing={step === 'grab' ? 'away' : 'toward'} eyes={step !== 'grab'} mouth={step === 'grab' ? 'closed' : 'snarl'} />
      </div>
      {/* the dark that comes out of its mouth at the end of the lunge */}
      {step === 'lunge' && <div ref={mawRef} className="lunge-maw" />}
      {hand && (step === 'grab' || step === 'turn') && <SkeletonHand x={hand.x} y={hand.y} closed />}
      {step === 'dark' && <DarkEvents />}
      {(step === 'dark' || step === 'release') && <ClawMarks />}
    </div>
  );
}

/** One claw rake: four gouges torn into the glass, raw red in the middle, dark at the edges. */
export function Rake({ x, y, rot, s }: { x: number; y: number; rot: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      {[0, 1, 2, 3].map((i) => (
        <path
          key={i}
          className="claw-gash"
          style={{ animationDelay: `${i * 0.03}s` }}
          d={`M${i * 9} 0 C ${i * 9 + 6} 30, ${i * 10 + 4} 70, ${i * 11 + 14} 120 C ${i * 11 + 10} 72, ${i * 9 + 2} 34, ${i * 9 - 2} 4 Z`}
        />
      ))}
    </g>
  );
}

/** Two claw marks it leaves on the screen as it goes over you (they stay while the shop turns). */
export function ClawMarks() {
  return (
    <svg className="claw-marks" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <Rake x={24} y={12} rot={-18} s={0.42} />
      <Rake x={60} y={36} rot={-24} s={0.5} />
    </svg>
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
