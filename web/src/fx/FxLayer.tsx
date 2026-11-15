import { useCallback } from 'react';
import { skipClosing } from '../director/sequences';
import { ClosingTime } from './ClosingTime';
import { CrawlingHand } from './CrawlingHand';
import { DayBat } from './DayBat';
import { Decals } from './Decals';
import { Fly } from './Fly';
import { useFx } from './fxStore';
import { HauntedBats } from './HauntedBats';
import { Accepted, CatchLunge, Darkness } from './Overlays';

/** Every DOM and SVG effect, layered per the design's rendering stack. */
export function FxLayer() {
  const tremor = useFx((s) => s.tremor);
  const onSkip = useCallback(() => skipClosing(), []);
  return (
    <>
      <div className="page-layer" aria-hidden={false}>
        <Decals />
        <HauntedBats />
        <DayBat />
      </div>
      <Darkness />
      <CrawlingHand />
      <Fly />
      <CatchLunge />
      <ClosingTime onSkip={onSkip} />
      <Accepted />
      {tremor && <div className="tremor-marker" hidden />}
    </>
  );
}
