import { useEffect, useMemo } from 'react';
import { useFx } from './fxStore';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function visibleObjectBoxes(): Box[] {
  const out: Box[] = [];
  for (const el of document.querySelectorAll('.card .object-box')) {
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight || r.width === 0) continue;
    out.push({ x: r.left, y: r.top, w: r.width, h: r.height });
  }
  return out.slice(0, 16);
}

/** One dust sheet draped over an object (Requirement 38.4). Its shape turns in the 'turn' beat. */
function Sheet({ b, i, turned }: { b: Box; i: number; turned: boolean }) {
  return (
    <svg className={`dust-sheet${turned ? ' turned' : ''}`} style={{ left: b.x, top: b.y, width: b.w, height: b.h, animationDelay: `${i * 0.08}s`, ['--turn-delay' as string]: `${i * 0.35}s` }} viewBox="0 0 100 100" preserveAspectRatio="none">
      <path className="sheet-cloth" d="M10 100 C 8 70, 18 30, 34 18 C 42 10, 58 10, 66 18 C 82 30, 92 70, 90 100 Z" />
      <path className="sheet-fold" d="M34 22 C 40 48, 38 76, 30 100 M66 22 C 60 50, 62 78, 70 100 M50 14 C 50 40, 52 70, 50 100" />
      <ellipse className="sheet-face" cx="50" cy="34" rx="12" ry="9" />
    </svg>
  );
}

/**
 * Closing time (Requirement 38): power fails, eyes open in every card, dust sheets cover the
 * objects, the shapes beneath turn to the visitor, the sheet ghost rises and lifts its hem as
 * the light fails, then its sheet lies empty. The Director drives the beats; Skip and Escape
 * jump to the end.
 */
export function ClosingTime({ onSkip }: { onSkip: () => void }) {
  const step = useFx((s) => s.closingStep);
  const running = step !== 'none';
  // Measured once when the climax starts; the shop does not move under it.
  const boxes = useMemo(() => (running ? visibleObjectBoxes() : []), [running]);
  useEffect(() => {
    if (step === 'none') return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onSkip();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, onSkip]);
  if (step === 'none') return null;
  const sheets = step === 'sheets' || step === 'turn' || step === 'ghost';
  return (
    <div className={`closing closing-${step}`} data-testid="closing-time" role="presentation">
      {step === 'eyes' &&
        boxes.map((b, i) => <span key={i} className="card-eyes" style={{ left: b.x + b.w / 2, top: b.y + b.h * 0.4, animationDelay: `${i * 0.12}s` }} />)}
      {sheets && boxes.map((b, i) => <Sheet key={i} b={b} i={i} turned={step !== 'sheets'} />)}
      {(step === 'ghost' || step === 'after') && (
        <svg className={`sheet-ghost${step === 'after' ? ' empty' : ''}`} viewBox="0 0 200 260" aria-hidden="true">
          <path className="ghost-cloth" d="M30 250 C 26 170, 30 90, 60 50 C 80 22, 120 22, 140 50 C 170 90, 174 170, 170 250 C 150 238, 136 256, 118 244 C 100 256, 86 238, 68 250 C 52 240, 42 256, 30 250 Z" />
          <ellipse className="ghost-eye" cx="84" cy="96" rx="9" ry="13" />
          <ellipse className="ghost-eye" cx="118" cy="96" rx="9" ry="13" />
        </svg>
      )}
      <button type="button" className="btn btn-quiet closing-skip" onClick={onSkip} data-testid="skip-closing">
        Skip
      </button>
    </div>
  );
}
