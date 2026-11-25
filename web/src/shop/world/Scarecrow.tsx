import { BONE, BONE_LINE, HOLLOW, LongBone, r1 } from './bones';
import { seeded } from './noise';
import { useStill } from './useStill';

/** Straw poking out of the scarecrow: tufts of strands from a base point. */
type Tuft = { x: number; y: number; bw: number; a: number; spread: number; len: number; n: number };

/** Behind the cloth: out of the cuffs and from under the hem. */
const UNDER_TUFTS: Tuft[] = [
  { x: 30, y: 121, bw: 4, a: Math.PI, spread: 1.3, len: 14, n: 15 }, // left cuff
  { x: 170, y: 114, bw: 4, a: 0, spread: 1.2, len: 13, n: 14 }, // right cuff
  { x: 101, y: 214, bw: 70, a: Math.PI / 2, spread: 0.5, len: 17, n: 22 }, // under the hem
];
/** Over the cloth: round the collar and through the hole in the chest. */
const OVER_TUFTS: Tuft[] = [
  { x: 101, y: 97, bw: 28, a: -Math.PI / 2, spread: 1.7, len: 9, n: 18 },
  { x: 122, y: 151, bw: 3, a: 0.2, spread: 1.6, len: 8, n: 8 },
];
const HAT_TUFTS: Tuft[] = [{ x: 96, y: 30, bw: 2, a: -2.3, spread: 1.1, len: 6, n: 6 }];
const STRAW_TONES = ['#8f7744', '#6c5a33', '#a68d56'];

/** Strand paths for a set of tufts, one path per tone. Seeded, so it is the same every time. */
function straw(tufts: Tuft[], seed: number): string[] {
  const r = seeded(seed);
  const out = ['', '', ''];
  for (const t of tufts) {
    for (let i = 0; i < t.n; i++) {
      const x = t.x + (r() - 0.5) * t.bw;
      const y = t.y + (r() - 0.5) * 2;
      const a = t.a + (r() - 0.5) * t.spread;
      const l = t.len * (0.5 + r() * 0.6);
      const bend = (r() - 0.5) * 0.7;
      const k = Math.floor(r() * 3);
      out[k] =
        (out[k] ?? '') +
        `M${r1(x)} ${r1(y)}Q${r1(x + Math.cos(a + bend) * l * 0.5)} ${r1(y + Math.sin(a + bend) * l * 0.5)} ${r1(x + Math.cos(a) * l)} ${r1(y + Math.sin(a) * l)}`;
    }
  }
  return out;
}

const UNDER_STRAW = straw(UNDER_TUFTS, 41);
const OVER_STRAW = straw(OVER_TUFTS, 47);
const HAT_STRAW = straw(HAT_TUFTS, 43);

/** A torn strip of cloth hanging from the coat, tucked under its edge at (x, y). */
type Strip = { x: number; y: number; len: number; w: number; dur: number; delay: number; tone: string };

const STRIPS: Strip[] = [
  { x: 44, y: 128, len: 30, w: 6, dur: 2.9, delay: -0.4, tone: '#221d19' },
  { x: 165, y: 121, len: 22, w: 5, dur: 3.6, delay: -1.7, tone: '#2a2420' },
  { x: 72, y: 214, len: 34, w: 7, dur: 3.3, delay: -2.2, tone: '#1d1915' },
  { x: 92, y: 216, len: 22, w: 5, dur: 2.4, delay: -0.9, tone: '#3a2f24' },
  { x: 116, y: 216, len: 28, w: 6, dur: 2.7, delay: -1.3, tone: '#221d19' },
  { x: 134, y: 214, len: 18, w: 4, dur: 3.9, delay: -3.1, tone: '#4a1c1d' },
];

function stripPath({ x, y, len, w }: Strip): string {
  const p = (dx: number, dy: number) => `${r1(x + dx)} ${r1(y + dy)}`;
  return `M${p(-w / 2, 0)}L${p(w / 2, 0)}L${p(w * 0.42, len * 0.45)}L${p(w * 0.1, len * 0.72)}L${p(1, len)}L${p(-w * 0.15, len * 0.82)}L${p(-w * 0.3, len * 0.9)}L${p(-w * 0.45, len * 0.5)}Z`;
}

const ROPE = '#6a583a';
const ROPE_DARK = '#2c2318';

/** The carved holes in the pumpkin: uneven eyes, a small nose, a jagged mouth. */
const CARVED = [
  'M82 62L96 57L94.5 71L89 68Z',
  'M107 63L120 61.5L115.5 70.5Z',
  'M99.5 73L104 72.5L101.5 78Z',
  'M79 81L85 82.5L87 86.5L90 82.5L95 87L98 83L102 88L105 83L109 87L112 82L118 82L124 79L121 87L115 91L111 88L107 93L103 89.5L99 94L95 90L90 93L85 89Z',
];

/**
 * A scarecrow in the scorched field between the headline and the still life: a crooked post
 * and cross-beam, a patched coat with straw coming out of it, a carved pumpkin head lit faintly
 * from inside, and a few small bones tied on with string. It creaks in the wind: the post sways
 * from its foot with little catches, the head lolls behind, rags and bones swing on their own
 * timings. The farmer's warning for crows, kept on after there was nothing left to guard.
 * Decorative (aria-hidden); still under reduced motion.
 */
export function Scarecrow() {
  const still = useStill();
  return (
    <svg className="world-crow" viewBox="0 0 200 320" aria-hidden="true" focusable="false" data-still={still}>
      <defs>
        <linearGradient id="rc-crow-wood" x1="0" x2="1">
          <stop offset="0" stopColor="#1a110b" />
          <stop offset="0.45" stopColor="#3a291c" />
          <stop offset="1" stopColor="#170f0a" />
        </linearGradient>
        <linearGradient id="rc-crow-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a291c" />
          <stop offset="1" stopColor="#160e09" />
        </linearGradient>
        <linearGradient id="rc-crow-coat" x1="0" x2="1">
          <stop offset="0" stopColor="#161210" />
          <stop offset="0.5" stopColor="#2b2520" />
          <stop offset="1" stopColor="#13100e" />
        </linearGradient>
        <radialGradient id="rc-crow-rind" cx="0.42" cy="0.38" r="0.7">
          <stop offset="0" stopColor="#8d4a17" />
          <stop offset="0.6" stopColor="#5a2b0c" />
          <stop offset="1" stopColor="#241004" />
        </radialGradient>
        <radialGradient id="rc-crow-fire" cx="0.5" cy="0.6" r="0.65">
          <stop offset="0" stopColor="#ffb24a" />
          <stop offset="0.55" stopColor="#d9621c" />
          <stop offset="1" stopColor="#6e2207" />
        </radialGradient>
        <radialGradient id="rc-crow-halo">
          <stop offset="0" stopColor="#ff8a2a" stopOpacity="0.3" />
          <stop offset="1" stopColor="#ff8a2a" stopOpacity="0" />
        </radialGradient>
        <clipPath id="rc-crow-v">
          <path d="M86 98L100 132L116 96Q101 92 86 98Z" />
        </clipPath>
      </defs>

      <g className="crow-sway">
        {/* fixes the box, so the sway turns about the foot of the post */}
        <rect width="200" height="320" fill="none" />

        {/* a little heap of dirty snow and stones round the foot */}
        <path d="M76 320C82 311 92 309 100 310C110 309 118 312 124 320Z" fill="#1b1817" />
        <path d="M84 318l4-3 3 3M110 317l3-2 4 2" stroke="#0c0a09" strokeWidth="1.2" fill="none" />

        {/* the post, crooked, split near the foot */}
        <path d="M95 320L96.5 250L95.5 200L97.5 130L98 64L106 64L105 130L107.5 200L105.5 250L104.5 320Z" fill="url(#rc-crow-wood)" stroke="#0d0805" strokeWidth="1" />
        <path d="M99 318L99.5 262M102.6 300L103 236M100.4 226L100 214" stroke="#120c08" strokeWidth="0.8" fill="none" />
        <ellipse cx="101.5" cy="244" rx="2.2" ry="3.4" fill="#120b07" />
        <path d="M97 320L99 300L98.4 288" stroke="#050302" strokeWidth="1.2" fill="none" />

        {/* the cross-beam, bent in the middle */}
        <path d="M12 113L100 106L190 98L191 106L100 114L13 121Z" fill="url(#rc-crow-beam)" stroke="#0d0805" strokeWidth="1" />
        <path d="M16 117L60 113.5M140 105L186 101" stroke="#120c08" strokeWidth="0.7" />

        {/* rags torn from the coat, tucked under its edges; each flutters on its own timing */}
        {STRIPS.map((s, i) => (
          <path
            key={i}
            className="crow-strip"
            d={stripPath(s)}
            fill={s.tone}
            stroke="#0b0908"
            strokeWidth="0.7"
            style={{ animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` }}
          />
        ))}

        {/* straw under the hem and out of the cuffs, behind the cloth */}
        {UNDER_STRAW.map((d, i) => (
          <path key={i} d={d} stroke={STRAW_TONES[i]} strokeWidth="1.1" strokeLinecap="round" fill="none" />
        ))}

        {/* the coat, hung on the beam: sleeves along it, a ragged hem */}
        <path
          d="M72 104Q52 108 30 111L28 120L31 129L34 131Q54 136 70 146L66 186L62 224L70 216L76 228L83 214L90 226L98 212L106 230L112 215L120 224L127 212L134 221L140 210L136 180L132 142Q150 130 168 125L172 122L169 114L173 106Q152 102 130 100L116 96L100 132L86 98Z"
          fill="url(#rc-crow-coat)"
          stroke="#0b0908"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        {/* folds and seams */}
        <path d="M74 150Q78 180 72 214M128 146Q124 178 130 208M100 134L100 212M50 112Q52 122 48 132M150 106Q152 116 150 128" stroke="#0e0c0a" strokeWidth="1" fill="none" />
        <path d="M86 98L96 124M116 96L104 124" stroke="#0a0807" strokeWidth="1.4" fill="none" />
        {/* the shirt under it, a faded check */}
        <path d="M86 98L100 132L116 96Q101 92 86 98Z" fill="#45382a" />
        <g clipPath="url(#rc-crow-v)" stroke="#231a12" strokeWidth="1.1">
          <path d="M84 104H118M84 112H118M84 120H118M92 94V134M100 94V134M108 94V134" />
        </g>
        {/* patches sewn on with big stitches, and the holes they missed */}
        <g strokeWidth="0.7" strokeDasharray="2 1.4">
          <path d="M72 156L87 154L88 167L73 169Z" fill="#3a3024" stroke="#8a7a5a" />
          <path d="M117 186L130 185L130.5 196L118 197Z" fill="#4a1c1d" stroke="#8a6a5a" />
          <path d="M44 113L56 112L57 123L45 124Z" fill="#2e3530" stroke="#7a8070" />
        </g>
        <path d="M118 148L126 146L125 156L119 155Z" fill="#070605" />
        <path d="M82 192L88 200L80 202Z" fill="#070605" />
        <path d="M58 118l4 2-3 3Z" fill="#070605" />
        <circle cx="108" cy="148" r="1.8" fill="#5a4a36" stroke="#0b0908" strokeWidth="0.5" />
        <circle cx="107" cy="166" r="1.6" fill="#2d2a26" stroke="#0b0908" strokeWidth="0.5" />
        <path d="M107 182l1.5 3" stroke="#5a4a36" strokeWidth="0.6" />

        {/* straw through the chest hole and round the collar */}
        {OVER_STRAW.map((d, i) => (
          <path key={i} d={d} stroke={STRAW_TONES[i]} strokeWidth="1" strokeLinecap="round" fill="none" />
        ))}

        {/* rope: tied round the cuffs and the waist, the belt's knot hanging */}
        <g fill="none" strokeLinecap="round">
          <path d="M38 109Q36 121 38.5 132M41.5 108.6Q39.5 121 42 131.6M161 102Q163 113 161 126M164 101.6Q166 113 164 125.4M66 178Q100 183 137 174" stroke={ROPE} strokeWidth="2.4" />
          <path d="M38 109Q36 121 38.5 132M161 102Q163 113 161 126M66 178Q100 183 137 174" stroke={ROPE_DARK} strokeWidth="2.4" strokeDasharray="0.8 2" />
          <path d="M38 133L36 141M39.5 133L40.5 140M162 126L160 133" stroke={ROPE} strokeWidth="1.4" />
        </g>
        <circle cx="110" cy="179.5" r="3" fill={ROPE} stroke={ROPE_DARK} strokeWidth="0.8" />
        <path className="crow-strip" d="M109 181Q108 190 110 199M111.5 181Q112 189 114 196" stroke={ROPE} strokeWidth="1.6" strokeLinecap="round" fill="none" style={{ animationDuration: '4.1s', animationDelay: '-2s' }} />

        {/* charms on strings under the sleeves: a bird's skull, finger bones, a knucklebone and a tooth */}
        <g className="crow-dangle" style={{ transformOrigin: '48px 133px', animationDuration: '3.9s', animationDelay: '-1.1s' }}>
          <path d="M48 133L48 156" stroke="#5a4e3e" strokeWidth="0.7" />
          <path d="M45.4 162L40.5 175.5L47.6 164.2Z" fill={BONE} stroke={BONE_LINE} strokeWidth="0.7" strokeLinejoin="round" />
          <path d="M44.6 163.4L42 170" stroke={BONE_LINE} strokeWidth="0.4" />
          <circle cx="48.2" cy="159.8" r="4.3" fill={BONE} stroke={BONE_LINE} strokeWidth="0.8" />
          <circle cx="47" cy="160.4" r="1.7" fill={HOLLOW} />
        </g>
        <g className="crow-dangle" style={{ transformOrigin: '63px 141px', animationDuration: '4.6s', animationDelay: '-0.3s' }}>
          <path d="M63 141L63 160" stroke="#5a4e3e" strokeWidth="0.7" />
          <path d="M59 152C59 149.5 67 149.5 67 152L68.8 153L67 154.2C67 156.6 59 156.6 59 154.2L57.2 153Z" fill={BONE} stroke={BONE_LINE} strokeWidth="0.7" />
          <circle cx="63" cy="153.1" r="1.1" fill={HOLLOW} />
          <path d="M61.6 160L64.4 160L63.6 166.5L62.8 163.5Z" fill={BONE} stroke={BONE_LINE} strokeWidth="0.6" />
        </g>
        <g className="crow-dangle" style={{ transformOrigin: '152px 131px', animationDuration: '5.2s', animationDelay: '-2.6s' }}>
          <path d="M152 131L152.4 161" stroke="#5a4e3e" strokeWidth="0.7" />
          <LongBone a={[152, 140]} b={[152.2, 147.5]} w={2.6} />
          <LongBone a={[152.3, 150]} b={[152.4, 155.5]} w={2.3} />
          <path d="M151.3 158L153.5 158L152.6 164Z" fill={BONE} stroke={BONE_LINE} strokeWidth="0.6" />
        </g>

        {/* the rope that ties the head on */}
        <path d="M86 99Q101 103 116 97" stroke={ROPE} strokeWidth="2.4" fill="none" strokeLinecap="round" />

        {/* the head: tipped to one side for good, and lolling a little behind the body */}
        <g transform="rotate(-9 102 96)">
          <g className="crow-head">
            <ellipse cx="80" cy="71" rx="15" ry="23" fill="url(#rc-crow-rind)" stroke="#1e0d04" strokeWidth="1" />
            <ellipse cx="124" cy="71" rx="15" ry="23" fill="url(#rc-crow-rind)" stroke="#1e0d04" strokeWidth="1" />
            <ellipse cx="90" cy="70" rx="16" ry="25.5" fill="url(#rc-crow-rind)" stroke="#1e0d04" strokeWidth="1" />
            <ellipse cx="114" cy="70" rx="16" ry="25.5" fill="url(#rc-crow-rind)" stroke="#1e0d04" strokeWidth="1" />
            <ellipse cx="102" cy="69.5" rx="15" ry="26" fill="url(#rc-crow-rind)" stroke="#1e0d04" strokeWidth="1" />
            {/* a soft, rotting patch going grey */}
            <path d="M113 84C118 80 126 81 128 86C127 91 119 93 114 90Z" fill="#1d1206" opacity="0.85" />
            <path d="M117 86h0.5M121 85h0.5M123 88h0.5M119 89h0.5" stroke="#5b5848" strokeWidth="1.2" strokeLinecap="round" />
            {/* the carving: cut edges dark, the candle light inside them */}
            {CARVED.map((d, i) => (
              <path key={i} d={d} fill="#120602" stroke="#2a1205" strokeWidth="1.4" strokeLinejoin="round" />
            ))}
            <g className="crow-glow">
              {CARVED.map((d, i) => (
                <path key={i} d={d} fill="url(#rc-crow-fire)" />
              ))}
            </g>
            <circle className="crow-halo" cx="102" cy="76" r="32" fill="url(#rc-crow-halo)" />
            {/* the hat: brim's shadow, crown with its tip fallen over, a band, a tear */}
            <ellipse cx="103" cy="53" rx="27" ry="4" fill="#000" opacity="0.45" />
            <path d="M79 47C80 38 82 30 86 24C89 18 95 15 100 16C104 11 110 7 117 9C121 10 123 14 121 17C116 15 111 16 108 20C111 28 114 38 117 46Z" fill="#16120f" stroke="#0a0807" strokeWidth="1" strokeLinejoin="round" />
            <path d="M80 45C92 43 106 43 117 44L116.5 40C105 39 92 39 81 41Z" fill="#3b1714" />
            <path d="M58 52C64 45 80 43 98 44C116 44 136 45 146 51C141 55 132 55 124 54L121 58L117 54C106 56 92 57 80 57C70 57 61 56 58 52Z" fill="#1d1814" stroke="#0a0807" strokeWidth="1" strokeLinejoin="round" />
            <path d="M62 51C72 46 88 45.5 100 46M128 46.5C136 47.5 141 49 144 51" stroke="#2e2620" strokeWidth="0.9" fill="none" />
            <path d="M101 25L109 24.5L109.5 31L101.5 31.5Z" fill="#251f1a" stroke="#6a5c48" strokeWidth="0.6" strokeDasharray="1.6 1.2" />
            <ellipse cx="96" cy="30" rx="2.6" ry="2" fill="#050404" />
            {HAT_STRAW.map((d, i) => (
              <path key={i} d={d} stroke={STRAW_TONES[i]} strokeWidth="1" strokeLinecap="round" fill="none" />
            ))}
          </g>
        </g>
      </g>
    </svg>
  );
}
