import gsap from 'gsap';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { LUNGE_MS } from '../director/sequences';
import { useHaunted, useStory } from '../store';
import { BatSvg, FLY_FACE_Y, FLY_MOUTH_Y, FLY_VB_W, FLY_W, HANG_ASPECT } from './BatSvg';
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
 * The catch (Req 9.6–9.9). The bony fist closes where the visitor clicked; the bat breaks free
 * and takes off as it does by day, wings beating, swings round and comes at the screen from
 * above, eyes burning and fangs bared, its wings opening wide until they blot out everything.
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
    // Lay the bat out at its FINAL size and shrink it down to start from, so the browser draws
    // the SVG and its fur at full resolution (scaling a small element up made it blurry).
    // The body keeps its old close-up size; the wings, much bigger now, reach far past the edges.
    const unit = Math.max(vw * 1.9, vh * 3) / 244;
    const final = FLY_VB_W * unit;
    el.style.width = `${final}px`;
    // Centre it in GSAP (CSS `translate` is dropped once GSAP owns the transform).
    el.style.translate = 'none';
    // At scale 1, the face sits this far above the bat's centre, and the open mouth this far.
    const faceOff = -FLY_FACE_Y * unit;
    const mouthOff = -FLY_MOUTH_Y * unit;
    // Where it ends, looking at you: centred, high (a third of the way down), so its spread
    // wings cover the top of the screen too.
    const faceX = vw / 2;
    const faceY = vh * 0.335;
    const flight = (LUNGE_MS / 1000) * 0.74;
    const engulf = (LUNGE_MS / 1000) * 0.26;
    const s0 = FLY_W / final;

    /*
     * It takes off the way it flies by day: drops off the perch with its wings beating, swings
     * out, banks round and comes back in from above, at you, wings opening wide as it nears.
     * The path is for its face (what you watch); its size grows slowly at first and then
     * faster. Wing beats are driven here, continuously, so the fast, deep flapping of the
     * take-off slows and flattens into wide-open gliding strokes with no jump between them.
     */
    const face0 = { x: x0, y: y0 - faceOff * s0 };
    const toCentre = Math.sign(vw / 2 - x0) || 1;
    const p1 = { x: face0.x + toCentre * 0.08 * vw, y: face0.y + 0.14 * vh };
    const p2 = { x: faceX + toCentre * 0.22 * vw, y: faceY - 0.2 * vh };
    const bez = (a: number, b: number, c: number, d: number, t: number) => {
      const u = 1 - t;
      return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
    };
    const wingL = el.querySelector<SVGGElement>('.wing-left');
    const wingR = el.querySelector<SVGGElement>('.wing-right');
    const body = el.querySelector<SVGGElement>('.bat-body');
    const beat = { amp: 1, freq: 1 / 0.48, phase: 0, last: performance.now(), on: true };
    const flap = () => {
      if (!beat.on) return;
      const now = performance.now();
      beat.phase += 2 * Math.PI * beat.freq * ((now - beat.last) / 1000);
      beat.last = now;
      const b = Math.sin(beat.phase);
      const a = beat.amp;
      const down = (1 - b) / 2;
      // the day flight's stroke (up 16°, down −34°, the wing narrowing on the downstroke), scaled by amp
      const r = a * (-9 + 25 * b);
      const sy = 1.05 - 0.5 * a * down - 0.05 * (1 - a);
      const sx = 1 - 0.08 * a * down;
      if (wingR) wingR.style.transform = `rotate(${r.toFixed(2)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
      if (wingL) wingL.style.transform = `rotate(${(-r).toFixed(2)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
      if (body) body.style.transform = `translateY(${(2 * a * down).toFixed(2)}px)`;
      requestAnimationFrame(flap);
    };
    requestAnimationFrame(flap);

    const tl = gsap.timeline();
    const st = { t: 0 };
    let prevX = face0.x;
    let prevAt = performance.now();
    let bank = 0;
    gsap.set(el, { x: x0, y: y0, xPercent: -50, yPercent: -50, scale: s0, rotate: 0 });
    tl.to(st, {
      t: 1,
      duration: flight,
      ease: 'none',
      onUpdate: () => {
        const t = st.t;
        // along the path: quick off the perch, settling onto the focal point as it arrives
        const q = 1 - Math.pow(1 - t, 1.5);
        const fx = bez(face0.x, p1.x, p2.x, faceX, q);
        const fy = bez(face0.y, p1.y, p2.y, faceY, q);
        // size: little change while it takes off, then a steady rush toward the glass
        const s = s0 * Math.pow(1 / s0, Math.pow(t, 1.5));
        // banks into its turns like the day flight, levelling out as it faces you
        const now = performance.now();
        const vx = (fx - prevX) / Math.max(1, now - prevAt);
        prevX = fx;
        prevAt = now;
        bank += (Math.max(-22, Math.min(22, vx * 40)) * (1 - t) - bank) * 0.25;
        gsap.set(el, {
          x: fx,
          y: fy + faceOff * s,
          scale: s,
          rotate: bank,
          // only a little darker as it blocks the light: the red of its wings stays
          filter: `brightness(${(1 - 0.18 * t).toFixed(3)}) saturate(${(1 - 0.1 * t).toFixed(3)})`,
        });
        // the beats: day flapping for the take-off, then slower, flatter, wings wide open
        const g = Math.min(1, Math.max(0, (t - 0.35) / 0.55));
        const e = g * g * (3 - 2 * g);
        beat.amp = 1 - 0.82 * e;
        beat.freq = (1 - e) / 0.48 + e / 1.1;
      },
    });
    // Then the dark comes out of it: still closing in around its open mouth, the black of
    // its throat spreads until it covers the screen.
    const mouthY = faceY + faceOff - mouthOff;
    const k = { s: 1 };
    tl.to(k, {
      s: 1.6,
      duration: engulf,
      ease: 'power2.in',
      onUpdate: () => {
        bank *= 0.8;
        gsap.set(el, { scale: k.s, y: mouthY + mouthOff * k.s, rotate: bank });
      },
    });
    if (maw) {
      const reach = Math.hypot(vw, vh) * 1.15;
      gsap.set(maw, { left: faceX, top: mouthY, width: reach * 2, height: reach * 2, xPercent: -50, yPercent: -50 });
      tl.fromTo(maw, { scale: (9 * unit) / reach, opacity: 0 }, { scale: 1, opacity: 1, duration: engulf, ease: 'power2.in' }, flight);
    }
    // Fully black a moment before the lunge ends, so the hand-over to the dark step is seamless.
    const shade = shadeRef.current;
    if (shade) tl.fromTo(shade, { opacity: 0 }, { opacity: 1, duration: engulf * 0.4, ease: 'power1.in' }, flight + engulf * 0.45);
    return () => {
      tl.kill();
      beat.on = false;
      // Hand the shade back to the stylesheet (the dark step holds it at full black).
      if (shade) gsap.set(shade, { clearProps: 'opacity' });
    };
  }, [step, from]);

  if (step === 'none') return null;
  const pose = step === 'grab' ? 'hang' : 'fly';
  const placed = from && step === 'grab';
  return (
    <div className={`lunge lunge-${step}`} aria-hidden="true" data-testid="lunge">
      <div ref={shadeRef} className="lunge-shade" />
      <div
        ref={batRef}
        className="lunge-bat"
        style={
          // Caught hanging, it is held at its hanging size (its own box, not the wide flying
          // frame); then it takes off at its own flying size, and the lunge grows it from there.
          placed
            ? { transform: `translate(${from.x}px, ${from.y}px)`, width: from.w, height: from.w * HANG_ASPECT }
            : step === 'lunge'
              ? {}
              : { width: step === 'grab' ? (from?.w ?? BAT_W) : FLY_W }
        }
      >
        <BatSvg pose={pose} facing={step === 'grab' ? 'away' : 'toward'} eyes={step !== 'grab'} mouth={step === 'grab' ? 'closed' : 'snarl'} detail={step === 'lunge'} />
      </div>
      {/* the dark that comes out of its mouth at the end of the lunge */}
      {step === 'lunge' && <div ref={mawRef} className="lunge-maw" />}
      {hand && step === 'grab' && <SkeletonHand x={hand.x} y={hand.y} closed />}
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
