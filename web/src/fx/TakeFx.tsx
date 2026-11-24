import { reducedMotion } from '../director/runtime';
import { BatSvg } from './BatSvg';
import { useFx } from './fxStore';
import { TopLayer, useOpenDialog } from './TopLayer';

/** The bat that was shut in the gift: out of the card, at you, and away over the page. */
export function FreedBat() {
  const bat = useFx((s) => s.freeBat);
  if (!bat) return null;
  return (
    <div key={bat.id} className="freed-bat" style={{ left: bat.x, top: bat.y }} aria-hidden="true" data-testid="freed-bat">
      <BatSvg pose="fly" facing="toward" eyes mouth="snarl" />
    </div>
  );
}

/**
 * The candle is taken and goes out, and the product view's light was its light: the view goes
 * dim, not black. Everything is still there and the close button can still be found. (The
 * candle's own smoke, and what it becomes, is in its model.) It stays dim until the view is
 * closed; on the shelf the candle's card stays dim instead (see ObjectBox).
 */
export function CandleDark() {
  const on = useFx((s) => s.flags['candle-dark'] !== undefined);
  const dialog = useOpenDialog();
  if (!on || !dialog) return null;
  return (
    <TopLayer stick>
      <div className={`candle-dim${reducedMotion() ? ' candle-dim-still' : ''}`} aria-hidden="true" data-testid="candle-dark" />
    </TopLayer>
  );
}
