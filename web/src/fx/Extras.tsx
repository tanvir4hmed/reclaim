import { useState } from 'react';
import { productById } from '../products/catalog';
import { useHaunted, useStory } from '../store';
import { useFx } from './fxStore';

/** The letter opens on hover, tap or keyboard; after the Reveal a stain spreads over "Sorry." (Req 16). */
export function LetterOpen() {
  const haunted = useHaunted();
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`letter-open${open ? ' is-open' : ''}`}
      onPointerEnter={(e) => e.pointerType !== 'touch' && setOpen(true)}
      onPointerLeave={(e) => e.pointerType !== 'touch' && setOpen(false)}
    >
      <button type="button" className="letter-toggle" aria-expanded={open} data-testid="letter-open" onClick={(e) => {
          // Hover already opened it for a mouse; a click must not fold it again (found by e2e).
          const mouse = (e.nativeEvent as PointerEvent).pointerType === 'mouse';
          setOpen((v) => (mouse ? true : !v));
        }}>
        {open ? 'Fold the letter' : 'Read the letter'}
      </button>
      {open && (
        <div className="letter-paper" role="region" aria-label="The letter">
          {haunted ? (
            <p>
              Dearest M, the trains have stopped. I am walking home. Keep the candle in the window. If I am late,
              I am <span className="stained" data-testid="sorry">Sorry.</span>
            </p>
          ) : (
            <p>Dearest M, I will be home for Christmas. Keep the candle in the window. All my love.</p>
          )}
        </div>
      )}
    </div>
  );
}


/** Exit-intent plea, once per visit, dismissible, never blocking (Requirement 32.10). */
export function ExitPlea() {
  const day = useFx((s) => s.flags['exit-day'] !== undefined);
  const haunted = useFx((s) => s.flags['exit-haunted'] !== undefined);
  const unflag = useFx((s) => s.unflag);
  if (!day && !haunted) return null;
  return (
    <div className="toast" role="status" data-testid="exit-plea">
      <span>{haunted ? 'Don’t leave us here.' : 'Leaving so soon? Take 10% off your first order.'}</span>{' '}
      <button type="button" className="btn btn-quiet" onClick={() => (unflag('exit-day'), unflag('exit-haunted'))}>
        Close
      </button>
    </div>
  );
}

/** What the last player left behind, back in the cheerful hero; the only difference (Req 23.3). */
export function HeroEcho() {
  const echo = useStory((s) => (s.story.phase === 'day' ? s.story.echo : null));
  if (!echo) return null;
  const p = productById(echo.product);
  return (
    <div className="hero-echo-item" data-perch="hero-echo" data-testid="hero-echo" aria-hidden="true">
      <span className="echo-object">{p.haunted.name}</span>
    </div>
  );
}
