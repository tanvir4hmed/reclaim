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

/** Candle: it goes out. In the dark, two eyes, very close. Then it relights and nothing is there. */
export function CandleDark() {
  return (
    <div className="ts-full ts-black">
      <svg className="ts-close-eyes" viewBox="0 0 400 160">
        <defs>
          <radialGradient id="rc-ts-sclera" cx="50%" cy="50%" r="55%">
            <stop offset="0" stopColor="#efe9dc" />
            <stop offset="0.6" stopColor="#bdb3a2" />
            <stop offset="1" stopColor="#5a2a24" />
          </radialGradient>
          <radialGradient id="rc-ts-skin" cx="50%" cy="45%" r="60%">
            <stop offset="0" stopColor="#3a352f" stopOpacity="0.55" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* the barest hint of a face, too close to the lens */}
        <ellipse cx="200" cy="90" rx="200" ry="120" fill="url(#rc-ts-skin)" />
        {[110, 290].map((cx) => (
          <g key={cx}>
            <path d={`M${cx - 52} 80 Q ${cx} 42 ${cx + 52} 78 Q ${cx} 112 ${cx - 52} 80 Z`} fill="url(#rc-ts-sclera)" />
            <path
              d={`M${cx - 46} 80 q12 -2 20 4 M${cx - 44} 84 q10 4 18 2 M${cx + 46} 78 q-12 -2 -20 4 M${cx + 44} 82 q-10 4 -18 3`}
              stroke="#8a1414"
              strokeWidth="1.2"
              fill="none"
              opacity="0.8"
            />
            <circle cx={cx} cy="79" r="16" fill="#2a1c14" />
            <circle cx={cx} cy="79" r="3" fill="#000" />
            <path d={`M${cx - 54} 79 Q ${cx} 34 ${cx + 54} 77`} stroke="#0a0606" strokeWidth="4" fill="none" />
          </g>
        ))}
      </svg>
      <p className="ts-whisper ts-late">It was still lit for you.</p>
    </div>
  );
}

/** Mittens: a small hand presses against the inside of your screen, as if the glass were a window. */
export function MittenHand() {
  return (
    <div className="ts-full ts-dim">
      <svg className="ts-press" viewBox="0 0 120 140">
        <g fill="rgb(200 205 210 / 0.5)" stroke="rgb(230 235 240 / 0.6)" strokeWidth="0.8">
          <ellipse cx="60" cy="96" rx="26" ry="28" />
          <ellipse cx="30" cy="80" rx="7" ry="16" transform="rotate(-35 30 80)" />
          <ellipse cx="44" cy="46" rx="6.5" ry="20" />
          <ellipse cx="58" cy="40" rx="6.5" ry="23" />
          <ellipse cx="72" cy="44" rx="6.5" ry="21" />
          <ellipse cx="85" cy="56" rx="5.5" ry="17" transform="rotate(14 85 56)" />
        </g>
        {/* breath fog where a face would be, just above the hand */}
        <ellipse cx="60" cy="20" rx="40" ry="14" fill="rgb(220 225 235 / 0.25)" />
      </svg>
      <p className="ts-whisper ts-late">My hands are cold.</p>
    </div>
  );
}
