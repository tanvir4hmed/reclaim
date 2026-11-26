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

/** Long thin white hair hanging from the sides of the bald head, and the beard below the mouth. */
const HAIR = (() => {
  const r = seeded(17);
  const out: { d: string; w: number; o: number }[] = [];
  for (let i = 0; i < 90; i++) {
    const side = i % 2 ? 1 : -1;
    const x0 = 245 + side * (52 + r() * 34);
    const y0 = 80 + r() * 70;
    const x1 = 245 + side * (70 + r() * 90);
    const y1 = y0 + 120 + r() * 160;
    const bend = side * (10 + r() * 40);
    out.push({ d: `M${x0.toFixed(1)} ${y0.toFixed(1)} C ${(x0 + bend).toFixed(1)} ${(y0 + 60).toFixed(1)}, ${(x1 - bend).toFixed(1)} ${(y1 - 70).toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`, w: 0.5 + r() * 1.4, o: 0.35 + r() * 0.5 });
  }
  return out;
})();

const BEARD = (() => {
  const r = seeded(29);
  const out: { d: string; w: number; o: number }[] = [];
  for (let i = 0; i < 110; i++) {
    const t = i / 110;
    const x0 = 180 + t * 135 + (r() - 0.5) * 8;
    const y0 = 205 + Math.abs(t - 0.5) * 60 + r() * 20;
    const x1 = 245 + (x0 - 245) * (0.5 + r() * 0.6) + (r() - 0.5) * 30;
    const y1 = 400 + r() * 140;
    out.push({ d: `M${x0.toFixed(1)} ${y0.toFixed(1)} C ${(x0 + (r() - 0.5) * 30).toFixed(1)} ${(y0 + 80).toFixed(1)}, ${(x1 + (r() - 0.5) * 30).toFixed(1)} ${(y1 - 90).toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`, w: 0.5 + r() * 1.5, o: 0.4 + r() * 0.5 });
  }
  return out;
})();

/** Deep wrinkles across the brow and the bald crown, and round the eyes. */
const WRINKLES = (() => {
  const r = seeded(5);
  const out: string[] = [];
  for (let i = 0; i < 9; i++) {
    const y = 58 + i * 9;
    const half = 30 + i * 4 + r() * 8;
    out.push(`M${(245 - half).toFixed(1)} ${(y + 4).toFixed(1)} Q 245 ${(y - 6 - r() * 4).toFixed(1)} ${(245 + half).toFixed(1)} ${(y + 4).toFixed(1)}`);
  }
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) out.push(`M${245 + s * 66} ${118 + i * 10} q ${s * 10} ${4 + i * 2} ${s * 18} ${10 + i * 4}`);
  }
  return out;
})();

/** The long fangs, top and bottom, round the gaping mouth. */
const FANGS_TOP = [196, 212, 228, 246, 264, 280, 296].map((x, i) => ({ x, len: i === 0 || i === 6 ? 26 : 40 + ((i * 13) % 12) }));
const FANGS_LOW = [214, 232, 250, 268, 286].map((x, i) => ({ x, len: 22 + ((i * 7) % 10) }));

/** A gnarled old hand: palm, four long fingers and a thumb, knuckles and nails. */
function Hand({ x, y, s, rot, blur }: { x: number; y: number; s: number; rot: number; blur?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`} filter={blur ? 'url(#jsNear)' : undefined}>
      <path
        fill="url(#jsSkinDark)"
        d="M-40 70 C-46 30 -44 6 -34 -10 C-46 -36 -54 -70 -46 -86 C-38 -96 -28 -82 -24 -54 C-24 -84 -22 -116 -10 -120 C2 -122 2 -92 0 -60 C6 -94 14 -120 26 -116 C38 -110 30 -78 26 -50 C34 -74 46 -94 56 -88 C66 -82 52 -52 44 -28 C52 -36 66 -40 70 -30 C74 -18 54 4 40 22 C34 44 30 58 26 72 Z"
      />
      <path d="M-30 -40 q6 -5 12 0 M-6 -48 q6 -5 12 0 M20 -42 q6 -5 12 0 M-26 14 q22 10 46 0 M-22 -10 q4 -3 8 0" stroke="#3a2620" strokeOpacity="0.6" strokeWidth="1.6" fill="none" />
      <path d="M-46 -86 l-3 -9 l8 4 Z M-10 -120 l-1 -10 l8 7 Z M26 -116 l2 -10 l6 8 Z M56 -88 l4 -9 l3 9 Z" fill="#2b1c16" />
    </g>
  );
}

/**
 * The last thing in the shop, after Accept: the old priest who kept it, at the lens. A found-
 * footage frame (grain, scan lines, REC, the date stamp), dark with a dull red light: a bald,
 * wrinkled head before a cracked gold halo, long white hair and beard, bulging white eyes with
 * pin pupils weeping black, a mouth torn open far too long and lined with fangs, a gnarled hand
 * reaching out of the frame at you, the other clutching his book. He cuts in already close,
 * jerks, then lunges. Drawn in code. No flashing: the frame never goes bright.
 */
export function JumpScare() {
  const on = useFx((s) => s.scare);
  const leaving = useFx((s) => s.flags['accepted-leaving'] !== undefined);
  const words = useFx((s) => s.acceptedShown);
  if (!on) return null;
  const still = reducedMotion();
  return (
    <div className={`scare${still ? ' scare-still' : ''}${leaving ? ' scare-leaving' : ''}`} aria-hidden="true" data-testid="scare">
      <div className="scare-stage">
        <svg className="scare-figure" viewBox="0 0 400 520" preserveAspectRatio="xMidYMid slice">
          <defs>
            <radialGradient id="jsRoom" cx="58%" cy="30%" r="75%">
              <stop offset="0" stopColor="#3a120c" />
              <stop offset="0.45" stopColor="#170605" />
              <stop offset="1" stopColor="#030101" />
            </radialGradient>
            <radialGradient id="jsHalo" cx="50%" cy="50%" r="50%">
              <stop offset="0.55" stopColor="#c07a2a" stopOpacity="0" />
              <stop offset="0.72" stopColor="#d99a48" stopOpacity="0.55" />
              <stop offset="0.86" stopColor="#8a4a1c" stopOpacity="0.85" />
              <stop offset="1" stopColor="#2a0c04" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="jsHaloGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#ff9a40" stopOpacity="0.4" />
              <stop offset="1" stopColor="#ff5a20" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="jsFace" cx="50%" cy="34%" r="66%">
              <stop offset="0" stopColor="#d2ab98" />
              <stop offset="0.55" stopColor="#9a6c5c" />
              <stop offset="1" stopColor="#3e2420" />
            </radialGradient>
            <linearGradient id="jsSkinDark" x1="0" x2="0" y1="1" y2="0">
              <stop offset="0" stopColor="#5a3a32" />
              <stop offset="1" stopColor="#c49a8a" />
            </linearGradient>
            <radialGradient id="jsEye" cx="45%" cy="40%" r="60%">
              <stop offset="0" stopColor="#f4ece4" />
              <stop offset="0.7" stopColor="#d9bfb2" />
              <stop offset="1" stopColor="#7a3a30" />
            </radialGradient>
            <radialGradient id="jsThroat" cx="50%" cy="40%" r="65%">
              <stop offset="0" stopColor="#000" />
              <stop offset="0.8" stopColor="#0a0202" />
              <stop offset="1" stopColor="#4a0c0c" />
            </radialGradient>
            <linearGradient id="jsRobe" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#7a1010" />
              <stop offset="1" stopColor="#2a0404" />
            </linearGradient>
            <linearGradient id="jsVest" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#c9b89a" />
              <stop offset="1" stopColor="#5a4c38" />
            </linearGradient>
            <filter id="jsSoft">
              <feGaussianBlur stdDeviation="1" />
            </filter>
            <filter id="jsNear">
              <feGaussianBlur stdDeviation="3.5" />
            </filter>
            <filter id="jsSkin">
              <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="11" result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale="1.4" result="d" />
              <feGaussianBlur in="d" stdDeviation="0.6" />
            </filter>
          </defs>

          {/* the dark room, a dull red light in it */}
          <rect width="400" height="520" fill="url(#jsRoom)" />
          {/* the cracked gold halo behind his head, glowing */}
          <circle cx="250" cy="150" r="185" fill="url(#jsHaloGlow)" />
          <circle cx="250" cy="150" r="150" fill="url(#jsHalo)" />
          <path d="M140 120 l20 8 l-6 14 M330 70 l-14 16 l8 10 M352 190 l-18 -4 l-4 16 M170 250 l14 -10" stroke="#3a1a08" strokeWidth="1.4" fill="none" opacity="0.8" />

          {/* the vestment and the red cloak, torn */}
          <path fill="url(#jsVest)" d="M120 330 C 150 290, 340 280, 380 330 L 400 520 L 90 520 Z" />
          <path fill="#1f3a2a" opacity="0.8" d="M150 340 C 190 320, 250 320, 270 345 L 290 520 L 140 520 Z" />
          <path fill="url(#jsRobe)" d="M0 250 C 60 240, 120 280, 160 330 C 150 400, 130 470, 120 520 L 0 520 Z" />
          <path d="M20 270 l10 30 M60 262 l6 40 M100 290 l-4 36 M130 320 l-10 30" stroke="#a82020" strokeWidth="2" opacity="0.6" />
          {/* the gold cross on the stole */}
          <path fill="#c8963a" stroke="#5a3a10" strokeWidth="1" d="M182 400 h10 v-14 h8 v14 h10 v8 h-10 v24 h-8 v-24 h-10 Z" />

          {/* the book he holds, and his hand on it */}
          <g transform="translate(300 400) rotate(10)">
            <rect x="0" y="0" width="90" height="120" rx="6" fill="#3a2418" stroke="#1a0e08" strokeWidth="2" />
            <rect x="8" y="8" width="74" height="104" rx="4" fill="none" stroke="#8a6a3a" strokeWidth="1.5" />
            <path fill="#8a6a3a" d="M40 30 h10 v20 h16 v10 h-16 v34 h-10 v-34 h-16 v-10 h16 Z" />
          </g>
          <Hand x={330} y={470} s={0.75} rot={-70} />

          {/* long white hair from the sides of the head */}
          <g stroke="#cfc6bc" fill="none" strokeLinecap="round" filter="url(#jsSoft)">
            {HAIR.map((h, i) => (
              <path key={i} d={h.d} strokeWidth={h.w} strokeOpacity={h.o} />
            ))}
          </g>

          {/* the head: bald, wrinkled, gaunt, lit warm from the halo */}
          <g filter="url(#jsSkin)">
            <path fill="url(#jsFace)" d="M245 40 C 300 40, 330 80, 326 140 C 322 190, 306 220, 292 250 L 200 250 C 186 220, 168 190, 164 140 C 160 80, 190 40, 245 40 Z" />
            <g stroke="#4a2a22" strokeOpacity="0.55" strokeWidth="1.3" fill="none">
              {WRINKLES.map((d, i) => (
                <path key={i} d={d} />
              ))}
            </g>
            {/* deep sockets round the bulging eyes */}
            <ellipse cx="208" cy="134" rx="32" ry="26" fill="#3a1c18" opacity="0.8" />
            <ellipse cx="284" cy="134" rx="32" ry="26" fill="#3a1c18" opacity="0.8" />
            {/* the hooked nose */}
            <path fill="#a87866" d="M246 140 C 238 170, 230 190, 232 204 C 240 212, 256 212, 262 204 C 262 186, 254 166, 246 140 Z" />
            <path d="M234 204 q6 6 12 2 M248 206 q6 4 12 -2" stroke="#3a1c16" strokeWidth="1.4" fill="none" />
          </g>

          {/* the eyes: bulging white, veined red, a pin pupil each, black tears running */}
          {[208, 284].map((cx) => (
            <g key={cx}>
              <path fill="#060202" opacity="0.92" d={`M${cx - 6} 150 C ${cx - 8} 200, ${cx - 2} 260, ${cx - 6} 330 C ${cx + 2} 270, ${cx + 6} 210, ${cx + 6} 150 Z`} />
              <circle cx={cx} cy="132" r="24" fill="url(#jsEye)" />
              <path d={`M${cx - 22} 128 q8 2 12 -4 M${cx + 22} 136 q-9 0 -13 -5 M${cx - 18} 142 q8 -3 10 -9 M${cx + 18} 122 q-7 3 -10 8`} stroke="#9a1a1a" strokeWidth="0.8" strokeOpacity="0.8" fill="none" />
              <circle cx={cx + 1} cy="132" r="2" fill="#0a0404" />
            </g>
          ))}

          {/* the mouth torn open far too long, black inside, red gums, long fangs */}
          <g className="scare-jaw">
            <path fill="#5a1a14" d="M245 212 C 290 212, 302 260, 298 330 C 294 390, 272 430, 245 430 C 218 430, 196 390, 192 330 C 188 260, 200 212, 245 212 Z" />
            <path fill="url(#jsThroat)" d="M245 222 C 282 222, 290 266, 286 330 C 282 384, 264 418, 245 418 C 226 418, 208 384, 204 330 C 200 266, 208 222, 245 222 Z" />
            {FANGS_TOP.map(({ x, len }) => (
              <path key={x} fill="#e2d6b8" stroke="#6a5a3a" strokeWidth="0.6" d={`M${x - 6} 222 L ${x} ${222 + len} L ${x + 6} 222 Z`} />
            ))}
            {FANGS_LOW.map(({ x, len }) => (
              <path key={x} fill="#d8caa8" stroke="#6a5a3a" strokeWidth="0.6" d={`M${x - 5} 416 L ${x} ${416 - len} L ${x + 5} 416 Z`} />
            ))}
          </g>

          {/* the beard round the mouth, long and thin, down over the chest */}
          <g stroke="#d6cec4" fill="none" strokeLinecap="round" filter="url(#jsSoft)">
            {BEARD.map((h, i) => (
              <path key={i} d={h.d} strokeWidth={h.w} strokeOpacity={h.o} />
            ))}
          </g>

          {/* his hand, reaching out of the frame at you: huge and blurred, nearly at the lens */}
          <path d="M20 520 C 40 460, 80 420, 120 400" stroke="url(#jsSkinDark)" strokeWidth="56" strokeLinecap="round" fill="none" filter="url(#jsNear)" />
          <Hand x={120} y={370} s={1.55} rot={58} blur />

          {/* the red light over everything */}
          <rect width="400" height="520" fill="#7a1008" opacity="0.18" style={{ mixBlendMode: 'multiply' }} />
        </svg>
      </div>
      {/* camcorder frame on top: grain, scan lines, vignette, REC and the date stamp */}
      <div className="scare-glitch" />
      <div className="scare-grain" />
      <div className="scare-lines" />
      <div className="scare-ui">
        <span className="scare-rec">● REC</span>
        <span className="scare-batt">▮▮▯</span>
        <span className="scare-date">6 DECEMBER AD 343</span>
      </div>
      {words && <p className="scare-words">Forgive me, Lord, for I have sinned.</p>}
    </div>
  );
}
