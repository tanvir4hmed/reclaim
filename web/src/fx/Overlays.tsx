import { useMemo } from 'react';
import { useHaunted, useStory } from '../store';
import { BatSvg } from './BatSvg';
import { useFx } from './fxStore';

/** Darkness between the DOM and the canvas: covers the UI, not flames and eyes (design z 2). */
export function Darkness() {
  const mains = useFx((s) => s.mains);
  const haunted = useHaunted();
  const base = haunted ? 0.08 : 0;
  return <div className="darkness" aria-hidden="true" style={{ opacity: Math.min(0.97, base + (1 - mains) * 0.92) }} />;
}

/** The catch: the bat's head jerks round, it lunges, its wings fill the screen (Req 9.7–9.9). */
export function CatchLunge() {
  const step = useFx((s) => s.catchStep);
  if (step === 'none') return null;
  return (
    <div className={`lunge lunge-${step}`} aria-hidden="true" data-testid="lunge">
      <div className="lunge-bat">
        <BatSvg pose={step === 'grab' || step === 'turn' ? 'hang' : 'spread'} facing={step === 'grab' ? 'away' : 'toward'} eyes={step !== 'grab'} />
      </div>
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
