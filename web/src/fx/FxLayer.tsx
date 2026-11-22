import { useCallback } from 'react';
import { skipClosing } from '../director/sequences';
import { BatDefs } from './BatSvg';
import { ClosingTime } from './ClosingTime';
import { CrawlingHand } from './CrawlingHand';
import { DayBat } from './DayBat';
import { Decals } from './Decals';
import { Fly } from './Fly';
import { useFx } from './fxStore';
import { HauntedBats } from './HauntedBats';
import { Accepted, CatchLunge, Darkness } from './Overlays';
import { ExitPlea } from './Extras';
import { JumpScare } from './JumpScare';
import { TakeScares } from './scares/TakeScares';
import { CandleDark, FreedBat } from './TakeFx';

/** Every DOM and SVG effect, layered per the design's rendering stack. */
export function FxLayer() {
  const tremor = useFx((s) => s.tremor);
  const onSkip = useCallback(() => skipClosing(), []);
  return (
    <>
      <BatDefs />
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
      <TakeScares />
      <FreedBat />
      <CandleDark />
      <JumpScare />
      <ExitPlea />
      {tremor && <div className="tremor-marker" hidden />}
    </>
  );
}
