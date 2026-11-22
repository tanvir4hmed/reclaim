import type { ReactElement } from 'react';
import { reducedMotion } from '../../director/runtime';
import { useFx } from '../fxStore';
import { CakeFlies, GiftHand, AdventEye, MusicBoxDancer } from './Things';
import { CameraPolaroid, OrnamentReflection, CandleDark, MittenHand } from './Presence';
import { WatchCountdown, TypewriterWall, RadioNames, LetterWriting } from './Words';
import { GlobeCrack, TeddySeam, ChildDrawing, SoldierLine, PortraitStep, ShoesBehind, ChocolateChew, PhoneCaller } from './Marks';

/**
 * One scare for each thing you take after the Reveal (the doll and the mirror have theirs in
 * their models). Each has a reason in its story; some are direct, some only suggest. The
 * consequence sets the flag `scare-<id>` for a few seconds; this layer draws it.
 * Never blocks input (pointer-events: none), never flashes, and under reduced motion shows a
 * still version that keeps the meaning.
 */
const SCARES: Record<string, () => ReactElement> = {
  'pocket-watch': WatchCountdown,
  typewriter: TypewriterWall,
  'valve-radio': RadioNames,
  letter: LetterWriting,
  cake: CakeFlies,
  'unopened-gift': GiftHand,
  'advent-calendar': AdventEye,
  'music-box': MusicBoxDancer,
  'instant-camera': CameraPolaroid,
  'glass-ornament': OrnamentReflection,
  candle: CandleDark,
  mittens: MittenHand,
  'snow-globe': GlobeCrack,
  'teddy-bear': TeddySeam,
  'childs-drawing': ChildDrawing,
  'tin-soldier': SoldierLine,
  'photo-frame': PortraitStep,
  shoes: ShoesBehind,
  'chocolate-box': ChocolateChew,
  telephone: PhoneCaller,
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
