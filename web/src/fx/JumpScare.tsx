import { reducedMotion } from '../director/runtime';
import { useFx } from './fxStore';

/** Deterministic pseudo-random, so the drawing is the same every time (and pure in render). */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Long wet strands of black hair falling from the crown past the shoulders. */
const STRANDS = (() => {
  const r = seeded(44);
  const out: { d: string; w: number; o: number }[] = [];
  for (let i = 0; i < 70; i++) {
    const side = i % 2 ? 1 : -1;
    const start = 200 + side * (4 + r() * 46);
    const sway = side * (18 + r() * 70);
    const end = 200 + side * (40 + r() * 150);
    const len = 360 + r() * 140;
    out.push({
      d: `M${start.toFixed(1)} ${(128 + r() * 18).toFixed(1)} C ${(start + sway * 0.4).toFixed(1)} 230, ${(end - sway * 0.3).toFixed(1)} ${(len * 0.7).toFixed(1)}, ${end.toFixed(1)} ${len.toFixed(1)}`,
      w: 0.8 + r() * 2.6,
      o: 0.45 + r() * 0.5,
    });
  }
  return out;
})();

/** A few wet strands stuck across the face: thin, wavy, mostly at the sides. */
const FACE_STRANDS = (() => {
  const r = seeded(9);
  const xs = [154, 160, 168, 230, 238, 246, 192];
  return xs.map((x) => {
    const w = (r() - 0.5) * 14;
    return `M${x} 130 C ${(x + w).toFixed(1)} 180, ${(x - w).toFixed(1)} 230, ${(x + w * 1.4).toFixed(1)} ${(300 + r() * 50).toFixed(1)}`;
  });
})();

function Hand({ x, y, flip, scale }: { x: number; y: number; flip: boolean; scale: number }) {
  // Palm toward the camera, fingers spread and hooked, long nails, close enough to blur.
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`} filter="url(#rc-scare-near)">
      <path
        fill="url(#rc-scare-skin-dark)"
        d="M-30 60 C-34 30 -36 10 -30 -6 C-40 -30 -46 -58 -40 -70 C-34 -76 -28 -66 -24 -46 C-22 -66 -22 -94 -14 -98 C-6 -100 -6 -78 -6 -52 C-2 -78 4 -102 12 -100 C20 -96 14 -70 12 -46 C18 -66 26 -86 34 -82 C42 -78 32 -52 26 -30 C34 -40 46 -48 52 -40 C58 -30 40 -10 30 8 C26 30 22 46 20 60 Z"
      />
      {/* knuckle creases and tendons */}
      <path d="M-24 -30 q4 -4 8 0 M-4 -36 q4 -4 8 0 M14 -30 q4 -4 8 0 M-18 10 q14 8 30 0" stroke="#3a332c" strokeOpacity="0.5" strokeWidth="1.4" fill="none" />
      {/* cracked nails */}
      <path d="M-40 -70 l-2 -8 l6 4 Z M-14 -98 l-1 -9 l6 6 Z M12 -100 l1 -9 l5 7 Z M34 -82 l3 -8 l3 8 Z" fill="#2a241e" />
    </g>
  );
}

/**
 * The jump scare after Accept (the climax's last beat). A found-footage frame: camcorder grain,
 * REC, a date stamp from the night the shop was left. She comes out of the dark hallway and
 * rushes the lens, arms out, mouth open, filling the screen in about a second. Drawn in code.
 * No flashing: the frame never goes bright, so the flash limit (Req 9.4) is not involved.
 */
export function JumpScare() {
  const on = useFx((s) => s.scare);
  if (!on) return null;
  const still = reducedMotion();
  return (
    <div className={`scare${still ? ' scare-still' : ''}`} aria-hidden="true" data-testid="scare">
      <div className="scare-stage">
        <svg className="scare-figure" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice">
          <defs>
            <radialGradient id="rc-scare-room" cx="50%" cy="42%" r="65%">
              <stop offset="0" stopColor="#3a3a36" />
              <stop offset="0.5" stopColor="#141412" />
              <stop offset="1" stopColor="#030303" />
            </radialGradient>
            <radialGradient id="rc-scare-face" cx="50%" cy="38%" r="62%">
              <stop offset="0" stopColor="#d9d4ca" />
              <stop offset="0.55" stopColor="#a39d92" />
              <stop offset="1" stopColor="#4a463f" />
            </radialGradient>
            <linearGradient id="rc-scare-skin-dark" x1="0" x2="0" y1="1" y2="0">
              <stop offset="0" stopColor="#5d5850" />
              <stop offset="1" stopColor="#b5afa4" />
            </linearGradient>
            <radialGradient id="rc-scare-mouth" cx="50%" cy="35%" r="70%">
              <stop offset="0" stopColor="#1a0808" />
              <stop offset="0.7" stopColor="#060202" />
              <stop offset="1" stopColor="#2a1414" />
            </radialGradient>
            <radialGradient id="rc-scare-eye" cx="50%" cy="45%" r="55%">
              <stop offset="0" stopColor="#f2efe6" />
              <stop offset="0.75" stopColor="#bdb8ad" />
              <stop offset="1" stopColor="#5a554c" />
            </radialGradient>
            <linearGradient id="rc-scare-gown" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#c9c3b6" />
              <stop offset="1" stopColor="#4d4a43" />
            </linearGradient>
            <radialGradient id="rc-scare-socket" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#1a1714" />
              <stop offset="0.6" stopColor="#3a3530" stopOpacity="0.9" />
              <stop offset="1" stopColor="#6a645a" stopOpacity="0" />
            </radialGradient>
            <filter id="rc-scare-soft">
              <feGaussianBlur stdDeviation="1.1" />
            </filter>
            <filter id="rc-scare-near">
              <feGaussianBlur stdDeviation="4" />
            </filter>
            <filter id="rc-scare-skin">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="5" result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale="1.2" result="d" />
              <feGaussianBlur in="d" stdDeviation="0.7" />
            </filter>
          </defs>

          {/* the hallway behind her: a door frame in perspective, a dead light */}
          <rect width="400" height="500" fill="url(#rc-scare-room)" />
          <path d="M120 40 L136 470 M280 40 L264 470 M120 40 L280 40" stroke="#1c1c1a" strokeWidth="6" fill="none" />
          <path d="M60 0 L96 500 M340 0 L304 500" stroke="#0a0a09" strokeWidth="14" fill="none" />

          {/* hair mass behind the head and shoulders */}
          <path fill="#060606" d="M200 112 C 120 110, 104 190, 92 300 C 80 400, 60 470, 40 500 L360 500 C 340 470, 320 400, 308 300 C 296 190, 280 110, 200 112 Z" />
          <g stroke="#0d0d0c" fill="none" strokeLinecap="round">
            {STRANDS.map((s, i) => (
              <path key={i} d={s.d} strokeWidth={s.w} strokeOpacity={s.o} />
            ))}
          </g>

          {/* gown: torn neckline, the arms come forward out of it */}
          <path fill="url(#rc-scare-gown)" d="M124 330 C 150 300, 250 300, 276 330 L 300 500 L 100 500 Z" filter="url(#rc-scare-soft)" />

          {/* the face: gaunt, lit from below by something, jaw hanging open */}
          <g filter="url(#rc-scare-skin)">
            <path fill="url(#rc-scare-face)" d="M200 128 C 236 128, 252 160, 250 204 C 248 250, 236 296, 220 322 C 212 334, 188 334, 180 322 C 164 296, 152 250, 150 204 C 148 160, 164 128, 200 128 Z" />
            {/* hollow cheeks and temples */}
            <path d="M160 214 C 166 246, 172 268, 180 290 M240 214 C 234 246, 228 268, 220 290" stroke="#5a554c" strokeOpacity="0.6" strokeWidth="6" fill="none" filter="url(#rc-scare-soft)" />
            {/* eye sockets, sunk and bruised, fading into the skin */}
            <ellipse cx="179" cy="196" rx="21" ry="15" fill="url(#rc-scare-socket)" />
            <ellipse cx="221" cy="196" rx="21" ry="15" fill="url(#rc-scare-socket)" />
            {/* blank, milky eyes, staring straight into the lens */}
            <ellipse cx="179" cy="197" rx="12" ry="8.5" fill="url(#rc-scare-eye)" />
            <ellipse cx="221" cy="197" rx="12" ry="8.5" fill="url(#rc-scare-eye)" />
            <circle cx="179" cy="197" r="1.6" fill="#3d3a33" opacity="0.7" />
            <circle cx="221" cy="197" r="1.6" fill="#3d3a33" opacity="0.7" />
            {/* brows pulled up in the scream */}
            <path d="M160 180 q19 -12 36 -2 M204 178 q17 -10 36 2" stroke="#2d2924" strokeOpacity="0.55" strokeWidth="1.6" fill="none" filter="url(#rc-scare-soft)" />
            {/* nose */}
            <path d="M200 206 C 196 226, 194 236, 192 242 C 198 246, 204 246, 210 242" stroke="#544f46" strokeWidth="2.2" fill="none" />
            {/* the scream: a jaw hanging far too low, a black throat, a few yellowed teeth */}
            <path fill="#5a3a34" opacity="0.6" d="M200 248 C 226 248, 234 268, 232 292 C 230 320, 216 336, 200 336 C 184 336, 170 320, 168 292 C 166 268, 174 248, 200 248 Z" />
            <path fill="url(#rc-scare-mouth)" d="M200 254 C 220 254, 228 270, 226 292 C 224 316, 213 328, 200 328 C 187 328, 176 316, 174 292 C 172 270, 180 254, 200 254 Z" />
            <path fill="#b9ad94" opacity="0.85" d="M184 257 q3 7 6 0 Z M192 255 q3 6 6 0 Z M202 255 q3 6 6 0 Z M210 257 q3 7 6 0 Z" />
            <path fill="#8f8470" opacity="0.6" d="M188 326 q3 -5 6 0 Z M206 326 q3 -5 6 0 Z" />
          </g>

          {/* hair hanging across the face */}
          <g stroke="#080707" fill="none" strokeLinecap="round" strokeOpacity="0.55" filter="url(#rc-scare-soft)">
            {FACE_STRANDS.map((d, i) => (
              <path key={i} d={d} strokeWidth={i % 2 ? 0.6 : 1} />
            ))}
          </g>

          {/* arms out to the camera, hands huge and blurred because they are nearly at the lens */}
          <path d="M130 340 C 100 380, 80 420, 60 470" stroke="url(#rc-scare-skin-dark)" strokeWidth="40" strokeLinecap="round" fill="none" filter="url(#rc-scare-soft)" />
          <path d="M270 340 C 300 380, 320 420, 340 470" stroke="url(#rc-scare-skin-dark)" strokeWidth="40" strokeLinecap="round" fill="none" filter="url(#rc-scare-soft)" />
          <Hand x={52} y={470} flip={false} scale={1.35} />
          <Hand x={348} y={470} flip scale={1.35} />
        </svg>
      </div>
      {/* camcorder frame on top: grain, scan lines, vignette, REC and the date stamp */}
      <div className="scare-grain" />
      <div className="scare-lines" />
      <div className="scare-ui">
        <span className="scare-rec">● REC</span>
        <span className="scare-batt">▮▮▯</span>
        <span className="scare-date">
          DEC 24 1944
          <br />
          11:47 PM
        </span>
      </div>
    </div>
  );
}
