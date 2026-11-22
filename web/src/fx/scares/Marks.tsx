import { FootprintShape } from '../Decals';
import { Figure } from './Figure';

/** Snow globe: a crack runs across your whole screen, as if you were inside the glass. */
export function GlobeCrack() {
  return (
    <div className="ts-full ts-dim">
      <svg className="ts-crack" viewBox="0 0 1000 600" preserveAspectRatio="none">
        <path
          className="ts-crack-line"
          d="M480 0 L470 90 L520 160 L455 250 L500 330 L430 420 L470 520 L440 600 M520 160 L640 200 L760 180 L900 240 L1000 230 M455 250 L330 270 L210 230 L80 280 L0 270 M500 330 L600 380 L700 470 L820 520 M430 420 L320 470 L240 560"
        />
      </svg>
      <p className="ts-whisper ts-late">Let me out.</p>
    </div>
  );
}

/** Teddy: the seam opens on its own. Inside there is no stuffing, only a child's tooth and hair. */
export function TeddySeam() {
  return (
    <div className="ts-full ts-dim">
      <svg className="ts-seam" viewBox="0 0 200 200">
        <defs>
          <radialGradient id="rc-ts-plush" cx="45%" cy="40%" r="60%">
            <stop offset="0" stopColor="#8a6a48" />
            <stop offset="1" stopColor="#3a2614" />
          </radialGradient>
          <filter id="rc-ts-fur">
            <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="2" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="4" />
          </filter>
        </defs>
        {/* the bear's belly, close up: worn plush */}
        <ellipse cx="100" cy="100" rx="96" ry="98" fill="url(#rc-ts-plush)" filter="url(#rc-ts-fur)" />
        {/* the seam pulls open by itself; inside, dark and wet */}
        <path className="ts-seam-open" d="M100 26 C 80 70, 78 130, 100 176 C 122 130, 120 70, 100 26 Z" fill="#160606" />
        <path className="ts-seam-open" d="M100 40 C 88 76, 86 126, 100 162 C 114 126, 112 76, 100 40 Z" fill="#050202" />
        {/* broken stitches still hanging from the edges */}
        <path d="M86 50 l-8 -3 M82 72 l-9 -1 M81 96 l-9 1 M82 120 l-9 3 M86 144 l-8 4 M114 50 l8 -3 M118 72 l9 -1 M119 96 l9 1 M118 120 l9 3 M114 144 l8 4" stroke="#d8c8a6" strokeWidth="1.6" strokeLinecap="round" />
        {/* what she kept inside: a child's milk tooth and a lock of hair */}
        <g className="ts-seam-inside">
          <path d="M95 104 q5 -10 10 0 l-1.5 8 q-3.5 2 -7 0 Z" fill="#efe7d4" />
          <path d="M92 70 C 98 90, 90 118, 99 146 M106 66 C 102 92, 110 120, 104 150 M99 72 C 102 96, 96 124, 101 150" stroke="#2a1606" strokeWidth="1.1" fill="none" />
        </g>
      </svg>
      <p className="ts-whisper ts-late">I kept her safe. Who keeps you?</p>
    </div>
  );
}

/** Child's drawing: crayon scrawls across the screen. A stick family, and you, drawn last, in red. */
export function ChildDrawing() {
  return (
    <div className="ts-full ts-paper">
      <svg className="ts-crayon" viewBox="0 0 800 400">
        {[0, 1, 2].map((i) => (
          <g key={i} className="ts-stick" style={{ animationDelay: `${i * 0.35}s` }} transform={`translate(${160 + i * 130} 120)`}>
            <circle cx="0" cy="0" r="22" />
            <path d="M0 22 L0 120 M0 50 L-36 86 M0 50 L36 86 M0 120 L-26 190 M0 120 L26 190" />
          </g>
        ))}
        <g className="ts-stick ts-stick-you" style={{ animationDelay: '1.3s' }} transform="translate(620 120)">
          <circle cx="0" cy="0" r="22" />
          <path d="M0 22 L0 120 M0 50 L-36 86 M0 50 L36 86 M0 120 L-26 190 M0 120 L26 190" />
          <path d="M-10 -4 l20 8 M10 -4 l-20 8" />
        </g>
        <text className="ts-crayon-text" x="420" y="370" textAnchor="middle">
          THIS IS YOU
        </text>
      </svg>
    </div>
  );
}

/** Tin soldier: they line up across the bottom of your screen, and all turn to face you. */
export function SoldierLine() {
  return (
    <div className="ts-full ts-dim">
      <div className="ts-soldiers">
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} style={{ animationDelay: `${0.8 + i * 0.06}s` }} />
        ))}
      </div>
    </div>
  );
}

/** Family portrait: the missing one is back in the picture, a step closer each time it blinks. */
export function PortraitStep() {
  return (
    <div className="ts-full ts-dim">
      <div className="ts-portrait">
        <div className="ts-portrait-fam" />
        <Figure className="ts-portrait-her" />
      </div>
    </div>
  );
}

/** Shoes: footsteps in the dark, behind you; the last prints stop right at the edge of the screen. */
export function ShoesBehind() {
  return (
    <div className="ts-full ts-dim">
      {/* wet prints walking out of the dark toward you, getting bigger, the last two at your feet */}
      <svg className="ts-steps" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMax meet">
        {Array.from({ length: 8 }, (_, i) => {
          const t = i / 7;
          const y = 140 + t * t * 760;
          const x = 500 + (i % 2 ? 1 : -1) * (12 + t * 70);
          const s = 0.9 + t * t * 5.5;
          return (
            <g key={i} className="ts-step" style={{ animationDelay: `${i * 0.32}s` }} transform={`translate(${x} ${y}) rotate(90) scale(${s})`}>
              <FootprintShape foot={i % 2 ? 'right' : 'left'} />
            </g>
          );
        })}
      </svg>
      <p className="ts-whisper ts-late">They stopped behind you.</p>
    </div>
  );
}

/** Chocolate box: chewing, close to your ear, and something tastes the screen from the other side. */
export function ChocolateChew() {
  return (
    <div className="ts-full ts-dim">
      <div className="ts-lips" />
      <p className="ts-whisper ts-late">Just one more.</p>
    </div>
  );
}

/** Telephone: it rings, and when it stops a voice is already breathing in the room. */
export function PhoneCaller() {
  return (
    <div className="ts-full ts-dim">
      <p className="ts-caller">INCOMING CALL</p>
      <p className="ts-caller-num">FROM: THIS ROOM</p>
    </div>
  );
}
