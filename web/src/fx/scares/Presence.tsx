import { Figure } from './Figure';

/**
 * Scares about someone being in the room with you. They are never shown head-on for long:
 * she is in the photo, in the reflection, in the dark where the candle was.
 */

/** Instant camera: it takes a picture of you. A Polaroid develops. She is standing behind you. */
export function CameraPolaroid() {
  return (
    <div className="ts-full ts-dim">
      <div className="ts-polaroid">
        <div className="ts-polaroid-img">
          {/* the room behind the visitor: a doorway, and the viewer's own silhouette in front */}
          <div className="ts-pol-door" />
          <div className="ts-pol-you" />
          <Figure className="ts-pol-her" />
        </div>
        <p className="ts-polaroid-cap">you, tonight</p>
      </div>
    </div>
  );
}

/** Ornament: the bauble swells to fill the screen; in its curved reflection, she is right next to you. */
export function OrnamentReflection() {
  return (
    <div className="ts-full ts-dim">
      <div className="ts-bauble">
        <div className="ts-bauble-room" />
        <Figure className="ts-bauble-her" />
        <div className="ts-bauble-shine" />
      </div>
    </div>
  );
}
