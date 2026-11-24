import type { ReactElement } from 'react';
import { reducedMotion } from '../../director/runtime';
import { useFx } from '../fxStore';
import { TopLayer } from '../TopLayer';
import { ChildDrawing } from './Marks';
import { CameraFlash } from './Presence';
import { TeddySlash } from './Slash';
import { MusicSkullPass } from './SkullPass';

/**
 * The few Take events that reach out of the object's own picture: the camera's one flash, the
 * music-box skull that comes through the middle of the screen, the sword stroke across the
 * window, and the crayon family drawing you in last. Everything else happens in the product's
 * model (see products/*). The consequence sets the flag `scare-<id>`.
 * Never blocks input; one flash at most; reduced motion shows the end state (and no flash).
 */
const SCARES: Record<string, () => ReactElement | null> = {
  'instant-camera': CameraFlash,
  'music-box': MusicSkullPass,
  'childs-drawing': ChildDrawing,
  'teddy-bear': TeddySlash,
};

export function TakeScares() {
  const id = useFx((s) => Object.keys(s.flags).find((k) => k.startsWith('scare-'))?.slice(6) ?? null);
  if (!id) return null;
  const Scene = SCARES[id];
  if (!Scene) return null;
  // Inside the product view when it is open, so it happens the instant you take it, there.
  return (
    <TopLayer key={id} stick>
      <div className={`take-scare take-scare-${id}${reducedMotion() ? ' take-scare-still' : ''}`} aria-hidden="true" data-testid="take-scare">
        <Scene />
      </div>
    </TopLayer>
  );
}
