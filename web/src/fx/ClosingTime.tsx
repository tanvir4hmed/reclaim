import { useEffect } from 'react';
import { useFx } from './fxStore';

/**
 * Closing time (Requirement 38): the power fails and the sheet ghost rises, close and silent,
 * lifting its hem as the light dies; then its sheet lies empty. Skip and Escape jump to the end.
 */
export function ClosingTime({ onSkip }: { onSkip: () => void }) {
  const step = useFx((s) => s.closingStep);
  useEffect(() => {
    if (step === 'none') return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onSkip();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, onSkip]);
  if (step === 'none') return null;
  return (
    <div className={`closing closing-${step}`} data-testid="closing-time" role="presentation">
      {(step === 'ghost' || step === 'after') && (
        <svg className={`sheet-ghost${step === 'after' ? ' empty' : ''}`} viewBox="0 0 200 260" aria-hidden="true">
          <defs>
            <radialGradient id="rc-sheet" cx="45%" cy="25%" r="80%">
              <stop offset="0" stopColor="#f7f3ea" />
              <stop offset="0.6" stopColor="#d9d1c2" />
              <stop offset="1" stopColor="#8f8676" />
            </radialGradient>
            <filter id="rc-sheet-soft">
              <feTurbulence type="fractalNoise" baseFrequency="0.02 0.06" numOctaves="2" seed="7" />
              <feDisplacementMap in="SourceGraphic" scale="6" />
            </filter>
          </defs>
          {/* the eyes are part of the sheet: whatever the cloth does, they move with it */}
          <g className="ghost-body">
            <g filter="url(#rc-sheet-soft)">
              <path className="ghost-cloth" fill="url(#rc-sheet)" d="M30 250 C 26 170, 30 90, 60 50 C 80 22, 120 22, 140 50 C 170 90, 174 170, 170 250 C 150 238, 136 256, 118 244 C 100 256, 86 238, 68 250 C 52 240, 42 256, 30 250 Z" />
              <path d="M72 70 C 66 130, 64 190, 62 248 M128 70 C 134 130, 138 190, 140 246 M100 40 C 98 120, 102 190, 98 250" stroke="#8a8172" strokeOpacity="0.35" strokeWidth="2" fill="none" />
              <ellipse className="ghost-eye" cx="84" cy="96" rx="9" ry="13" />
              <ellipse className="ghost-eye" cx="118" cy="96" rx="9" ry="13" />
            </g>
          </g>
        </svg>
      )}
      <button type="button" className="btn btn-quiet closing-skip" onClick={onSkip} data-testid="skip-closing">
        Skip
      </button>
    </div>
  );
}
