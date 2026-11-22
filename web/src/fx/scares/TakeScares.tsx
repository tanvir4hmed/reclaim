import type { ReactElement } from 'react';
import { reducedMotion } from '../../director/runtime';
import { useFx } from '../fxStore';
import { ChildDrawing } from './Marks';
import { CameraPolaroid, OrnamentReflection } from './Presence';

/**
 * The few Take events that cannot happen inside the object's own picture: the Polaroid the
 * camera takes of you (she is behind you in it), her reflection in the bauble the instant you
 * take it, and the crayon family drawing you in last. Every other product does its thing in its
 * model (see products/*). The consequence sets the flag `scare-<id>`.
 * Never blocks input, never flashes; reduced motion shows the end state.
 */
const SCARES: Record<string, () => ReactElement> = {
  'instant-camera': CameraPolaroid,
  'glass-ornament': OrnamentReflection,
  'childs-drawing': ChildDrawing,
};

export function TakeScares() {
  const id = useFx((s) => Object.keys(s.flags).find((k) => k.startsWith('scare-'))?.slice(6) ?? null);
  if (!id) return null;
  const Scene = SCARES[id];
  if (!Scene) return null;
  return (
    <div className={`take-scare take-scare-${id}${reducedMotion() ? ' take-scare-still' : ''}`} aria-hidden="true" data-testid="take-scare">
      <Scene />
    </div>
  );
}
