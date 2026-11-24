/**
 * An original bat, drawn in code (no image files). Two poses:
 *  - 'fly' / 'spread': torn, red-lit membrane wings over finger bones, thumb claws, clawed feet
 *    reaching forward, a wild furred head with tall ears, red eyes and a fanged mouth.
 *  - 'hang': wings wrapped tight like a leather cocoon with folded bone ridges and a red rim,
 *    feet gripping the perch at the top, the head hanging upside down underneath, ears spread.
 * The head follows `--lx` / `--ly` (set by the caller, -1..1) so it can turn to the pointer.
 * Shared gradients and filters live once in <BatDefs /> (mounted by the FX layer).
 */
export type BatPose = 'hang' | 'fly' | 'spread';
type Mouth = 'closed' | 'open' | 'snarl';

/** Hanging pose frame: feet at the top (y −90), ears at the bottom (y 96). Aspect 76:186. */
const HANG_VIEWBOX = '-38 -90 76 186';
export const HANG_ASPECT = 186 / 76;

/**
 * One size for the hanging bat, by day and after the Reveal. The baseline is the Christmas bat
 * as deployed before round 6 (36 x 88 px box, 26.5 x 86.2 px drawn); it is shown at 80 % of
 * that. The viewBox is unchanged, so every part of the drawing scales by exactly 0.8.
 */
export const BAT_SCALE = 0.8;
const ORIGINAL_HANG_W = 36;
export const HANG_W = ORIGINAL_HANG_W * BAT_SCALE;
export const HANG_H = HANG_W * HANG_ASPECT;
/** How far above the perch line the box starts (the toes hook over it); scaled the same way. */
const HANG_TOP = 4 * BAT_SCALE;

/** Where a hanging bat's box goes so its feet grip the perch at (x, y). Both modes use this. */
export function hangBox(x: number, y: number) {
  return { left: x - HANG_W / 2, top: y - HANG_TOP, width: HANG_W, height: HANG_H };
}

/**
 * Flying, the bat is drawn at the same scale as when it hangs (the same pixels per drawing
 * unit, so the head is the same size): wings spread it is wider than the wrapped bat and its
 * body is smaller. It does not grow or shrink in flight.
 */
export const BAT_UNIT = HANG_W / 76;
export const FLY_W = 244 * BAT_UNIT;
export const FLY_H = 152 * BAT_UNIT;
/**
 * Flying box centred where the hanging bat's body is, so take-off and landing do not jump.
 * `k` lays the box out k times larger round the same centre (for a bat that is then scaled
 * down by 1/k, so it stays sharp when it swells in flight).
 */
export function flyBox(x: number, y: number, k = 1) {
  const cy = y - HANG_TOP + HANG_H / 2;
  const w = FLY_W * k;
  const h = FLY_H * k;
  return { left: x - w / 2, top: cy - h / 2, width: w, height: h };
}

/**
 * Mid-flight, the bat swells to this many times its take-off size, as if it swooped close past
 * the screen, and shrinks back to its own size to land (the take-off and landing size stay
 * FLY_W). Kept in step with the `0.625` (1 / FLY_NEAR) in fx.css.
 */
export const FLY_NEAR = 1.6;
/** In the flying drawing: the face is 28 units above the centre; the open mouth about 19 below it. */
export const FLY_FACE_Y = -28;
export const FLY_MOUTH_Y = -9;

/*
 * Ears: half the original absolute length. The whole bat is already drawn at 0.8, so inside
 * the drawing they are 0.5 / 0.8 = 0.625 of the old ear (old root-to-tip 39.1 units, now 24.4).
 * They now grow from the sides of the head, angled out, instead of from its middle.
 */
export const EAR_LOCAL_SCALE = 0.5 / BAT_SCALE;

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type P = [number, number];

/**
 * A ragged membrane edge from a to b: a scallop that sags toward `pull`, with small jitter and
 * the odd deep tear, so the wing looks old and torn rather than cut out of paper.
 */
function ragged(a: P, b: P, pull: P, sag: number, rnd: () => number, steps = 11): string {
  const c: P = [(a[0] + b[0]) / 2 + (pull[0] - (a[0] + b[0]) / 2) * sag, (a[1] + b[1]) / 2 + (pull[1] - (a[1] + b[1]) / 2) * sag];
  const nx = -(b[1] - a[1]);
  const ny = b[0] - a[0];
  const nl = Math.hypot(nx, ny) || 1;
  let out = '';
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    let x = u * u * a[0] + 2 * u * t * c[0] + t * t * b[0];
    let y = u * u * a[1] + 2 * u * t * c[1] + t * t * b[1];
    if (i < steps) {
      const tear = rnd() < 0.18 ? 3 + rnd() * 5 : 0;
      const j = (rnd() - 0.5) * 2.2 - tear;
      x += (nx / nl) * j;
      y += (ny / nl) * j;
    }
    out += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return out;
}

/** A small irregular hole in the membrane (drawn as a sub-path; evenodd makes it see-through). */
function hole(cx: number, cy: number, r: number, rnd: () => number): string {
  let d = '';
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.6 + rnd() * 0.7);
    d += `${i ? ' L' : ' M'}${(cx + Math.cos(a) * rr * 1.3).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`;
  }
  return d + ' Z';
}

/*
 * --- Right wing geometry (the left is its mirror), after Tanvir's reference image: the arm
 * rises steeply from the shoulder S to a high wrist W, where a long hooked thumb curls up and
 * in; the top edge runs out from the wrist to the outermost tip T1; from there the torn,
 * scalloped trailing edge falls through finger tips T2..T4 back to the hip B. The wing does
 * not reach below the body: the legs and claws hang free under it.
 */
const S: P = [19, -30];
const W: P = [61, -63];
const T1: P = [121, -53];
const T2: P = [119, -27];
const T3: P = [103, 3];
const T4: P = [64, 23];
const B: P = [21, 12];

const WING_OUTLINE = (() => {
  const r = seeded(17);
  const edge =
    ragged(T1, T2, W, 0.34, r) + ragged(T2, T3, W, 0.34, r) + ragged(T3, T4, W, 0.32, r) + ragged(T4, B, W, 0.26, r, 9);
  // torn holes near the trailing edge, as in the reference
  // (each one inside the deep scallops of the trailing edge, so none floats outside the wing)
  const holes = hole(88, -40, 1.8, r) + hole(84, -24, 1.6, r) + hole(70, -17, 1.5, r) + hole(50, -12, 1.3, r) + hole(93, -55, 1.1, r);
  // The top edge bows up a little as it runs out from the wrist to the outer tip.
  return { outline: `M${S[0]} ${S[1]} Q 36 -52 ${W[0]} ${W[1]} Q 96 -66 ${T1[0]} ${T1[1]}${edge} Z`, holes };
})();
const WING = WING_OUTLINE.outline + WING_OUTLINE.holes;

/** A bone path from a to b with a slight bend. */
function bonePath(a: P, b: P, bend = 0) {
  return `M${a[0]} ${a[1]} Q${((a[0] + b[0]) / 2 + bend).toFixed(1)} ${((a[1] + b[1]) / 2 - bend).toFixed(1)} ${b[0]} ${b[1]}`;
}
const FINGERS = `${bonePath(W, T1, 3)} ${bonePath(W, T2, 2)} ${bonePath(W, T3, -2)} ${bonePath(W, T4, -3)}`;
/** The arm: up from the shoulder to the high wrist. */
const ARM = `M${S[0]} ${S[1]} Q 34 -54 ${W[0]} ${W[1]}`;
/** Down the middle of each membrane panel, where it sags between the bones: the recesses. */
const PANEL_MIDS = 'M61 -63 Q 95 -50 120 -40 M61 -63 Q 92 -30 112 -12 M61 -63 Q 80 -20 86 13 M56 -58 Q 42 -22 43 17 M24 -26 Q 30 -6 30 12';

export function BatDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        {/* Fur: near-black at the edges, warm brown where the light catches the crown. */}
        <radialGradient id="rc-fur" cx="50%" cy="30%" r="75%">
          <stop offset="0" stopColor="#5f3829" />
          <stop offset="0.35" stopColor="#49291c" />
          <stop offset="0.62" stopColor="#381e13" />
          <stop offset="0.85" stopColor="#2a150d" />
          <stop offset="1" stopColor="#1d0d08" />
        </radialGradient>
        <filter id="rc-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.3" />
        </filter>
        <filter id="rc-soft-fine" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.6" />
        </filter>
        {/* Spread wing membrane: dark burgundy, raised and lighter toward the wrist, near black at the edge. */}
        <radialGradient id="rc-membrane" cx="62%" cy="45%" r="70%">
          <stop offset="0" stopColor="#5a1219" />
          <stop offset="0.35" stopColor="#3c0d13" />
          <stop offset="0.7" stopColor="#1c080b" />
          <stop offset="1" stopColor="#070405" />
        </radialGradient>
        {/* Scaly grain for the membrane: overlapping small arcs, crimson-lit edges. */}
        <pattern id="rc-scales" width="4" height="3.2" patternUnits="userSpaceOnUse">
          <path d="M0 3.2 Q2 0.6 4 3.2 M-2 1.6 Q0 -1 2 1.6 M2 1.6 Q4 -1 6 1.6" fill="none" stroke="#a52430" strokeWidth="0.35" strokeOpacity="0.55" />
          <path d="M0 3.4 Q2 1 4 3.4" fill="none" stroke="#050304" strokeWidth="0.3" strokeOpacity="0.6" />
        </pattern>
        <clipPath id="rc-wing-clip">
          <path d={WING_OUTLINE.outline} />
        </clipPath>
        {/* In flight: near-black fur with cool grey tips, and amber eyes. */}
        <radialGradient id="rc-fur-fly" cx="50%" cy="30%" r="75%">
          <stop offset="0" stopColor="#39353a" />
          <stop offset="0.4" stopColor="#1d191d" />
          <stop offset="0.78" stopColor="#111013" />
          <stop offset="1" stopColor="#080708" />
        </radialGradient>
        <radialGradient id="rc-ear-fly" cx="40%" cy="75%" r="80%">
          <stop offset="0" stopColor="#68252b" />
          <stop offset="0.55" stopColor="#32171c" />
          <stop offset="1" stopColor="#1b1014" />
        </radialGradient>
        <radialGradient id="rc-eye-amber" cx="45%" cy="40%" r="60%">
          <stop offset="0" stopColor="#ffd9a0" />
          <stop offset="0.3" stopColor="#ff9a3a" />
          <stop offset="0.7" stopColor="#c8501a" />
          <stop offset="1" stopColor="#3a0e04" />
        </radialGradient>
        {/* a tight glow, no halo */}
        <filter id="rc-glow-soft" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="0.7" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Wrapped wings: dark leather, a cold sheen on top and a red rim from below. */}
        <linearGradient id="rc-leather" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#3a2a27" />
          <stop offset="0.45" stopColor="#1d1210" />
          <stop offset="1" stopColor="#0b0605" />
        </linearGradient>
        <linearGradient id="rc-leather-r" x1="1" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#2e1f1c" />
          <stop offset="0.5" stopColor="#170d0b" />
          <stop offset="1" stopColor="#070403" />
        </linearGradient>
        {/*
          Hanging wings, layered: a dark reddish-brown base (these two gradients), deep shadow
          where one fold tucks under another, warmer raised ridges, low-contrast bones and veins
          on top (drawn in <Hanging />). The front wing is lit; the one behind it is in its shade.
        */}
        <radialGradient id="rc-hang-leather" cx="68%" cy="38%" r="88%">
          <stop offset="0" stopColor="#6c352b" />
          <stop offset="0.25" stopColor="#592921" />
          <stop offset="0.5" stopColor="#4a2019" />
          <stop offset="0.78" stopColor="#3b1811" />
          <stop offset="1" stopColor="#280f0a" />
        </radialGradient>
        <radialGradient id="rc-hang-leather-r" cx="35%" cy="45%" r="88%">
          <stop offset="0" stopColor="#4a2019" />
          <stop offset="0.45" stopColor="#3b1811" />
          <stop offset="0.8" stopColor="#280f0a" />
          <stop offset="1" stopColor="#110704" />
        </radialGradient>
        {/* A broad light across the curve of the front wing, so the wrap reads as round. */}
        <linearGradient id="rc-hang-sheen" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#83493e" stopOpacity="0" />
          <stop offset="0.55" stopColor="#83493e" stopOpacity="0.28" />
          <stop offset="0.8" stopColor="#9b675b" stopOpacity="0.12" />
          <stop offset="1" stopColor="#83493e" stopOpacity="0" />
        </linearGradient>
        {/* Inside of the ear: reddish-brown, darker toward the rim. */}
        <radialGradient id="rc-ear" cx="40%" cy="75%" r="80%">
          <stop offset="0" stopColor="#b04a3c" />
          <stop offset="0.5" stopColor="#7a2a1e" />
          <stop offset="1" stopColor="#3b1811" />
        </radialGradient>
        <radialGradient id="rc-eye-glow" cx="45%" cy="40%" r="60%">
          <stop offset="0" stopColor="#ffe9c2" />
          <stop offset="0.3" stopColor="#ff5a2a" />
          <stop offset="0.75" stopColor="#c0140a" />
          <stop offset="1" stopColor="#3a0402" />
        </radialGradient>
        <radialGradient id="rc-throat" cx="50%" cy="35%" r="70%">
          <stop offset="0" stopColor="#8a1418" />
          <stop offset="1" stopColor="#1a0204" />
        </radialGradient>
        {/* Fur: break outlines into tufts. */}
        <filter id="rc-furry" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="3.4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* Leather: fine creases lit from above. */}
        <filter id="rc-leathery" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.55 0.9" numOctaves="3" seed="11" result="n" />
          <feDiffuseLighting in="n" surfaceScale="1.6" lightingColor="#ffffff" result="lit">
            <feDistantLight azimuth="235" elevation="55" />
          </feDiffuseLighting>
          <feComposite in="lit" in2="SourceGraphic" operator="in" result="tex" />
          <feBlend in="SourceGraphic" in2="tex" mode="multiply" />
        </filter>
        <filter id="rc-glow" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}

/**
 * One wing, drawn for the right side; the left is mirrored by its parent. Layered: a dark
 * burgundy membrane over a near-black base; crimson where it is thinnest; darker recesses down
 * the middle of each panel where it sags; lighter raised folds along the bones; branching veins;
 * a little light on the joints; a darker band round the torn edge. Soft edges come from stacked
 * low-opacity strokes, not blur filters, so the huge close-up stays smooth to animate.
 */
function WingShape() {
  const soft = (d: string, color: string, widths: number[], opacity: number) =>
    widths.map((w) => <path key={w} d={d} fill="none" stroke={color} strokeWidth={w} strokeOpacity={opacity} strokeLinecap="round" />);
  return (
    <>
      <path className="membrane" fill="url(#rc-membrane)" fillRule="evenodd" d={WING} />
      <g clipPath="url(#rc-wing-clip)">
        {/* deep crimson where the light comes through the thin membrane */}
        <ellipse cx="92" cy="-26" rx="26" ry="16" fill="#8a1820" opacity="0.34" />
        <ellipse cx="100" cy="-4" rx="14" ry="9" fill="#8a1820" opacity="0.3" />
        <ellipse cx="70" cy="4" rx="16" ry="10" fill="#7a141c" opacity="0.32" />
        <ellipse cx="42" cy="-8" rx="12" ry="14" fill="#6a1218" opacity="0.28" />
        {/* the fine scaly grain of old skin, red in the light, lost in the shadows */}
        <rect x="0" y="-80" width="130" height="110" fill="url(#rc-scales)" opacity="0.55" />
        {/* recesses between the bones */}
        {soft(PANEL_MIDS, '#080506', [11, 6, 2.5], 0.14)}
        {/* raised membrane along the bones */}
        {soft(`${FINGERS} ${ARM}`, '#5a1219', [6, 3], 0.2)}
        {/* the torn outer edge, darker */}
        {soft(WING_OUTLINE.outline, '#080506', [7, 3.5], 0.26)}
      </g>
      {/* veins branching through the thin membrane */}
      <path
        className="veins"
        d="M66 -58 q18 4 30 -2 M70 -44 q14 6 28 2 q8 -2 14 2 M66 -32 q12 10 28 10 M62 -18 q6 12 18 18 M50 -10 q-4 10 -12 14 M80 -54 q8 -4 20 -4 M90 -8 q6 6 8 14 M98 -20 q6 -2 12 0 M74 8 q-4 4 -2 10"
      />
      <path className="veins bright" d="M72 -40 q10 4 22 0 M66 -16 q8 8 18 10" />
      {/* arm and finger bones, with a thin lit ridge on each */}
      <path className="bone-wing" d={ARM} />
      <path className="bone-wing thin" d={FINGERS} />
      <path className="bone-lit" d={`M${S[0]} ${S[1] - 1} Q 34 -55 ${W[0]} ${W[1] - 1} ${FINGERS}`} />
      <circle className="joint" cx={W[0]} cy={W[1]} r={3} />
      <circle cx={W[0] - 0.8} cy={W[1] - 0.9} r={1.1} fill="#814047" opacity="0.5" />
      {/* the long hooked thumb at the wrist, curling up and in toward the head */}
      <path d="M58.5 -64 C57 -72 54 -78 46.5 -79.5 C51.5 -76 54 -71 55.2 -63.8 Z" fill="#1a1215" stroke="#080506" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M57 -66 C55.6 -72 53 -76.4 48.6 -78.4" fill="none" stroke="#6a3a40" strokeWidth="0.45" strokeOpacity="0.7" />
      {/* the outer tip: a small hooked point */}
      <path d="M119.6 -54 C123 -57 126 -56.4 127.4 -53.4 C125 -54.6 122.6 -54 121 -52.2 Z" fill="#1a1215" />
    </>
  );
}

/**
 * Colours for the face. Hanging, it is the warm reddish-brown roosting bat; in flight it is the
 * near-black, crimson-shadowed creature with small amber eyes. The shapes (and so the
 * expression) are the same in both.
 */
const FACE_COLORS = {
  hang: {
    fur: 'url(#rc-fur)',
    muzzle: '#3e2216',
    tufts: '#49291c',
    fine: '#5f3829',
    earBack: '#2e140d',
    earRim: '#140805',
    earIn: 'url(#rc-ear)',
    earLine: '#3b1811',
    nose: '#4a2a22',
    bridge: '#7a4a38',
    lip: '#5f3829',
    eye: 'url(#rc-eye-glow)',
    glow: 'url(#rc-glow)',
    light: null as string | null,
  },
  fly: {
    fur: 'url(#rc-fur-fly)',
    muzzle: '#1d191d',
    tufts: '#2a262b',
    fine: '#4a454b',
    earBack: '#1b1014',
    earRim: '#080708',
    earIn: 'url(#rc-ear-fly)',
    earLine: '#24191d',
    nose: '#2a2428',
    bridge: '#57505a',
    lip: '#3d373e',
    eye: 'url(#rc-eye-amber)',
    glow: 'url(#rc-glow-soft)',
    // soft light on the brow, cheekbones and upper lip, so the face reads on near-black fur
    light: '#39353a' as string | null,
  },
};

/** The face, drawn upright and centred on (0, 0); the hanging pose turns it upside down. */
function Face({ eyes, open, mouth, look = 'hang' }: { eyes: boolean; open: boolean; mouth: Mouth; look?: 'hang' | 'fly' }) {
  const drop = mouth === 'snarl' ? 13 : mouth === 'open' ? 7 : 0;
  const c = FACE_COLORS[look];
  return (
    <g className={`bat-face mouth-${mouth}`}>
      {/*
        Pointed ears growing from the sides of the head, angled out, half their old length
        (EAR_LOCAL_SCALE). Drawn for the right side and mirrored; the roots sit just inside
        the fur so they blend in, and the crown of the head shows between and beyond them.
      */}
      {[-1, 1].map((s) => (
        <g key={s} transform={s < 0 ? 'scale(-1 1)' : undefined}>
          {/* in flight, as in the reference, the ears stand taller and more upright */}
          <g transform={look === 'fly' ? 'translate(9 -8.5) rotate(-14) scale(0.95) translate(-9 8.5)' : undefined}>
          <g className="bat-ear">
            {/* the back of the ear: dark skin, a fine darker rim */}
            <path d="M6.3 -11.1 C10 -17 17 -24 24.1 -27.7 C25 -20 18.5 -9.5 11.9 -5.9 Z" fill={c.earBack} stroke={c.earRim} strokeWidth="0.6" strokeLinejoin="round" />
            {/* the hollow inside: reddish-brown, curved, lighter toward the root */}
            <path d="M7.8 -10.6 C11 -15.6 16.8 -22 22.4 -25.8 C21.6 -19.6 17 -12.2 11.3 -7.7 Z" fill={c.earIn} />
            <path d="M9.6 -10.4 q4 -5.2 9.4 -11.2 M12.2 -8.8 q3 -3.2 6.2 -6.4" stroke={c.earLine} strokeWidth="0.45" strokeLinecap="round" fill="none" />
          </g>
          </g>
        </g>
      ))}
      {/* wild fur */}
      <g filter="url(#rc-furry)">
        <ellipse rx="15" ry="14" fill={c.fur} />
        {/* the muzzle a shade lighter than the fur round it, so nose and mouth read against it */}
        <ellipse cy="4" rx="11" ry="8" fill={c.muzzle} opacity="0.85" />
        {c.light && (
          <>
            <ellipse cy="-8.5" rx="8" ry="3" fill={c.light} opacity="0.45" />
            <ellipse cx="-9.5" cy="2.5" rx="3.6" ry="2.2" fill={c.light} opacity="0.4" />
            <ellipse cx="9.5" cy="2.5" rx="3.6" ry="2.2" fill={c.light} opacity="0.4" />
            <ellipse cy="9" rx="6" ry="1.6" fill={c.light} opacity="0.35" />
          </>
        )}
      </g>
      <path
        // in flight, no upright pair on the crown: close up they read as two antennae
        d={`M-15 -2 l-4 -2 M-14 5 l-5 1 M15 -2 l4 -2 M14 5 l5 1 M-10 -12 l-2 -4 M10 -12 l2 -4 ${look === 'fly' ? '' : 'M-4 -14 l0 -4 M4 -14 l0 -4 '}M-12 10 l-3 4 M12 10 l3 4`}
        stroke={c.tufts}
        strokeWidth={look === 'fly' ? 0.5 : 1.1}
        strokeOpacity={look === 'fly' ? 0.6 : 1}
        strokeLinecap="round"
      />
      {/* fine raised fur on the forehead and cheeks */}
      <path d="M-7 -11 l-1 -2.4 M-2 -12.6 l0 -2.4 M2.4 -12.4 l0.6 -2.4 M7 -10.6 l1.2 -2.2 M-12.6 2 l-2.2 0.4 M12.6 2 l2.2 0.4" stroke={c.fine} strokeWidth="0.5" strokeLinecap="round" />
      {/* brows dragged down into a scowl */}
      <path d="M-12 -7 L-3 -3 M12 -7 L3 -3" stroke="#0e0605" strokeWidth="1.6" strokeLinecap="round" />
      {/* eyes: shut slits at rest; open and burning red when it looks at you */}
      {[-1, 1].map((s) => (
        <g key={s} transform={`translate(${6.5 * s} -1)`}>
          {open || eyes ? (
            <g className="bat-eye-look">
              <path d={`M${-4 * s} 1 Q 0 -3.6 ${4 * s} -1 Q 0 3 ${-4 * s} 1 Z`} fill="#140605" />
              <ellipse className={eyes ? 'bat-eye glow' : 'bat-eye'} rx="3" ry="2.2" fill={eyes ? c.eye : '#4a1410'} filter={eyes ? c.glow : undefined} />
              <ellipse className="bat-pupil" rx="0.6" ry="1.8" fill="#0c0502" />
              {/* a tiny warm catch-light, not white */}
              <circle cx={-1.1 * s} cy="-0.9" r="0.45" fill="#d9a27c" opacity={eyes ? 0.55 : 0.8} />
            </g>
          ) : (
            <>
              {/* shut: the same red slit, set in a darker socket so it shows on the fur */}
              <path d={`M${-4.4 * s} 0.3 Q 0 2.6 ${4.4 * s} -0.4`} stroke="#0c0502" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5" />
              <path d={`M${-4 * s} 0 Q 0 1.6 ${4 * s} -0.6`} stroke="#5a1610" strokeWidth="1" fill="none" />
            </>
          )}
        </g>
      ))}
      {/* snout: a wrinkled, upturned nose with flared nostrils */}
      {/* shade under the nose, then the nose, its nostrils, and light along the bridge */}
      <ellipse cy="8.6" rx="4.4" ry="1.3" fill="#0c0502" opacity="0.6" filter="url(#rc-soft-fine)" />
      <path d="M-5 6 C-4 2 4 2 5 6 C4 9 -4 9 -5 6 Z" fill={c.nose} />
      <ellipse cx="-2" cy="6.2" rx="1.1" ry="0.8" fill="#0a0303" />
      <ellipse cx="2" cy="6.2" rx="1.1" ry="0.8" fill="#0a0303" />
      <path d="M-3.4 4 Q0 2.6 3.4 4" stroke={c.bridge} strokeWidth="0.6" strokeLinecap="round" fill="none" opacity="0.85" />
      <path d="M-7 3 q2 -2 4 0 M7 3 q-2 -2 -4 0" stroke="#160b09" strokeWidth="0.6" fill="none" />
      {/* the mouth: lips peel back from long fangs and rows of small teeth */}
      <g className="bat-mouth" transform="translate(0 11)">
        {/* a faint lit edge on the lower lip, so the line of the mouth shows on dark fur */}
        <path d="M-8.6 0.6 Q0 3.8 8.6 0.6" stroke={c.lip} strokeWidth="0.6" fill="none" opacity="0.75" />
        {drop > 0 && (
          <g className="bat-jaw">
            <path d={`M-8 0 Q0 ${drop * 1.25} 8 0 Q0 2 -8 0 Z`} fill="url(#rc-throat)" />
            <path d={`M-3 ${(drop * 0.55).toFixed(1)} q3 ${(drop * 0.35).toFixed(1)} 6 0`} fill="#9a2a30" />
            {/* lower teeth */}
            <path d={`M-5 ${drop * 0.85} l1 -2.6 l1 2.4 l1 -2.2 l1 2.2 l1 -2.2 l1 2.2 l1 -2.4 l1 2.6`} fill="#ddd0b8" />
            <path d={`M-6 ${drop} L-5 ${drop - 4} L-4 ${drop} Z M6 ${drop} L5 ${drop - 4} L4 ${drop} Z`} fill="#efe4cc" />
            {/* strings of saliva */}
            <path d={`M-4.5 1 Q-4 ${drop * 0.5} -4.4 ${drop * 0.9} M3.5 1 Q4 ${drop * 0.4} 3.6 ${drop * 0.8}`} stroke="#f2e8d8" strokeOpacity="0.5" strokeWidth="0.35" fill="none" />
          </g>
        )}
        {/* upper teeth and the two long fangs (visible even with the mouth shut) */}
        <path d="M-4 0 l0.8 2.2 l0.8 -2 l0.8 2 l0.8 -2 l0.8 2 l0.8 -2 l0.8 2.2 l0.8 -2.2" fill="#e2d6be" />
        <path d={`M-6.6 -0.4 L-5.2 ${drop > 0 ? 6.5 : 4.2} L-3.9 -0.2 Z M6.6 -0.4 L5.2 ${drop > 0 ? 6.5 : 4.2} L3.9 -0.2 Z`} fill="#f3eadb" stroke="#6a5a48" strokeWidth="0.3" />
        <path d="M-9 -0.8 Q0 2 9 -0.8" stroke="#0e0605" strokeWidth="1.2" fill="none" />
      </g>
    </g>
  );
}

/**
 * Flying body: a narrow, densely furred torso with shoulders that carry into the wing arms,
 * the head on top, and two thin legs hanging relaxed below with small curved claws (it is not
 * reaching for anything).
 */
/**
 * The torso's outline: broad furred shoulders under the head, a deep shaggy chest, tapering to
 * a ragged point between the legs, with tufts sticking out all down the sides.
 */
const TORSO = (() => {
  const r = seeded(29);
  const pts: P[] = [];
  // right side, top to bottom, then the left side back up (mirrored, with its own jitter)
  const side: P[] = [
    [20, -30],
    [24, -18],
    [23, -6],
    [20, 6],
    [16, 17],
    [11, 27],
    [6, 35],
    [0, 41],
  ];
  for (const [x, y] of side) pts.push([x + (r() - 0.5) * 1.6, y]);
  for (let i = side.length - 2; i >= 0; i--) {
    const [x, y] = side[i]!;
    pts.push([-x + (r() - 0.5) * 1.6, y]);
  }
  // between each pair of points a tuft juts out from the body
  let d = `M${pts[0]![0]} ${pts[0]![1]}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    const out = 2.2 + r() * 2;
    const sx = Math.sign(mx) || 0;
    d += ` Q${(mx + sx * out).toFixed(1)} ${(my + out * 0.6).toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
  }
  return d + ' Z';
})();

/** The face is drawn a little larger in flight, as in the reference. */
const FLY_FACE_SCALE = 1.15;

/**
 * Flying body, after Tanvir's reference: a big shaggy near-black torso hung between the wings,
 * the head with its tall ears on top, and two strong legs hanging under it, each ending in a
 * foot of long hooked claws, spread.
 */
function FlyBody({ eyes, open, mouth }: { eyes: boolean; open: boolean; mouth: Mouth }) {
  return (
    <g className="bat-body">
      {[-1, 1].map((s) => (
        <g key={s} className="fly-leg-g">
          {/* thigh out of the fur, shin down to the ankle */}
          <path className="fly-leg" d={`M${7 * s} 32 C${10 * s} 38 ${11.5 * s} 44 ${12 * s} 50`} />
          <path className="fly-leg-lit" d={`M${7.8 * s} 33 C${10.6 * s} 38.6 ${12.1 * s} 44 ${12.6 * s} 49`} />
          {/* the foot: four long claws, spread and hooked inward */}
          <ellipse cx={12 * s} cy={50.6} rx={2.2} ry={1.6} fill="#1a1215" />
          <path
            className="fly-claw"
            d={`M${10.4 * s} 51 q${-1.6 * s} 3.4 ${-1 * s} 6.6 M${11.6 * s} 51.6 q${-0.6 * s} 3.8 ${0.4 * s} 6.6 M${12.8 * s} 51.6 q${0.6 * s} 3.6 ${1.8 * s} 6 M${13.8 * s} 51 q${1.6 * s} 3 ${3.2 * s} 4.6`}
          />
        </g>
      ))}
      <g filter="url(#rc-furry)">
        {/* shoulders, where the arms leave the body */}
        <ellipse cx="-16" cy="-24" rx="8.5" ry="8" fill="#151215" />
        <ellipse cx="16" cy="-24" rx="8.5" ry="8" fill="#151215" />
        <path d={TORSO} fill="url(#rc-fur-fly)" />
        {/* the chest: a lighter, shaggy ruff under the chin, and a shadow down the middle */}
        <ellipse cx="0" cy="-8" rx="14" ry="11" fill="#242026" opacity="0.85" />
        <ellipse cx="0" cy="-10" rx="8" ry="5" fill="#39353a" opacity="0.45" />
        <path d="M0 0 Q-1.4 16 0 34" stroke="#060506" strokeWidth="3" fill="none" opacity="0.5" />
      </g>
      {/* layers of long fur: dark strokes and lighter tips, uneven, hanging down */}
      <path
        d="M-14 -4 l-2 8 M-8 2 l-1 9 M-2 6 l0 9 M4 4 l1 9 M10 0 l2 8 M16 -6 l2 7 M-12 14 l-1 8 M-5 18 l-0.5 8 M5 18 l0.5 8 M12 12 l1 8 M-6 28 l-0.5 6 M6 28 l0.5 6 M0 30 l0 7"
        stroke="#060506"
        strokeWidth="0.6"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M-13 -5 l-1.4 5 M-7 1 l-0.6 6 M3 3 l0.6 6 M9 -1 l1.4 5 M-18 -22 l-3 -2 M18 -22 l3 -2 M-4 17 l-0.4 5 M4 17 l0.4 5 M-20 -10 l-2.6 1 M20 -10 l2.6 1"
        stroke="#4a454b"
        strokeWidth="0.55"
        strokeLinecap="round"
        opacity="0.75"
      />
      <g className="bat-look bat-look-fly">
        <g transform={`translate(0 ${FLY_FACE_Y}) scale(${FLY_FACE_SCALE})`}>
          <Face eyes={eyes} open={open} mouth={mouth} look="fly" />
        </g>
      </g>
    </g>
  );
}

/** Hanging: the wrapped-wing cocoon, the feet on the perch, the head upside down below. */
function Hanging({ eyes, open, mouth }: { eyes: boolean; open: boolean; mouth: Mouth }) {
  const r = seeded(5);
  /*
   * Like a real roosting fruit bat: two separate legs at the top with daylight between them,
   * the wrapped wings widening all the way down to two pointed shoulder corners (the folded
   * wrists) at the bottom, about level with the head, which hangs between them. One wing is
   * folded over the other: its leading edge runs diagonally across the body.
   */
  // Outer edges run down to two pointed corners (the folded wrists, at ±31, 31) where the
  // edge turns sharply back in under the body: an angle, not a rounded cloak.
  const backL = 'M-8 -73 C-14 -56 -21 -28 -25 0 C-26.5 12 -28.5 22 -31 34.5 L-24 29.6 L-21 30.4 L-11 35 L0 34 L0 -58 C-2 -64 -5 -69 -8 -73 Z';
  const backR = 'M8 -73 C14 -56 21 -28 25 0 C26.5 12 28.5 22 31 34.5 L24 29.6 L21 30.4 L11 35 L0 34 L0 -58 C2 -64 5 -69 8 -73 Z';
  // The right wing wrapped over the front, its edge falling diagonally to the left and ending
  // in a second, smaller point where it tucks under at the bottom.
  const flap = 'M7 -72 C13 -50 20 -24 24 0 C25.5 14 28.5 22 31 34.5 L24 29.6 L20 31.6 L9 35 L-6 34 L-20.5 29.6 C-12 6 -4 -28 3 -60 Z';
  const edge = 'M-20.5 29.6 C-12 6 -4 -28 3 -60';
  const holes = hole(-16, -12, 1.4, r) + hole(15, -30, 1.2, r) + hole(10, 14, 1.6, r);
  // Creases where the membrane folds at the wrist (a shallow V) and along the hidden forearm.
  const folds = 'M25 2 C14 4 2 8 -14 16 M-23 19 C-12 24 -4 28 2 30 M23 22 C12 24 4 27 -2 31 M-12 -40 C-15 -22 -19 -4 -22 14';
  // The bones that hold the folded wing: forearms up from each wrist corner, and the fingers
  // fanning from the wrist back across the wrap. Thin and low-contrast, following the folds.
  const bones = 'M30.6 33.4 C26 14 21 -12 14 -44 M30 32.6 C24 20 16 14 6 12 M30 33 C22 26 12 26 2 29 M-30.6 33.4 C-26 14 -21 -10 -15 -42 M-30 32.6 C-26 22 -22 16 -18 12';
  const veins =
    'M16 -20 q-4 6 -9 8 q-2 1 -3 4 M18 -6 q-6 2 -10 8 M20 -32 q-5 3 -6 9 M-15 -30 q-2 7 0 13 q1 3 -1 6 M-19 4 q3 6 2 12 M12 8 q-5 5 -6 12 M24 12 q-4 3 -5 8 M-22 -12 q2 5 1 10';
  return (
    <g className="bat-body">
      {/* the legs, apart: slender, the toes hooked over the perch with thin curved claws */}
      {[-1, 1].map((s) => (
        <g key={s} className="bat-foot">
          <path className="hang-leg" d={`M${7 * s} -70 C${7.5 * s} -75 ${7.4 * s} -80 ${7 * s} -84`} />
          <path className="hang-leg-lit" d={`M${7.6 * s} -71 C${8 * s} -75 ${7.9 * s} -79 ${7.5 * s} -83`} />
          {/* a narrow foot, short toes close together, and thin claws hooked over the perch */}
          <ellipse className="hang-pad" cx={7 * s} cy={-84.6} rx={1.7} ry={1.2} />
          <path className="hang-gap" d={`M${6.6 * s} -85.4 l0 -1.2 M${7.5 * s} -85.4 l0.1 -1.2`} />
          <path className="hang-toe" d={`M${6 * s} -85.2 q0 -1.4 ${0.3 * s} -2 M${7 * s} -85.4 q0 -1.4 ${0.3 * s} -2.1 M${8 * s} -85.2 q${0.2 * s} -1.3 ${0.5 * s} -1.9`} />
          <path className="hang-claw" d={`M${6.3 * s} -87.2 q${0.6 * s} -2 ${2 * s} -1.2 q${0.5 * s} 0.4 ${0.4 * s} 1.4 M${7.3 * s} -87.5 q${0.7 * s} -1.9 ${2.1 * s} -1 q${0.4 * s} 0.4 ${0.3 * s} 1.3`} />
          <path className="hang-claw-lit" d={`M${6.5 * s} -87.6 q${0.6 * s} -1.4 ${1.5 * s} -1 M${7.5 * s} -87.9 q${0.6 * s} -1.3 ${1.5 * s} -0.8`} />
        </g>
      ))}
      <g className="bat-wrap" filter="url(#rc-leathery)">
        <path fill="url(#rc-hang-leather-r)" d={backL} />
        <path fill="url(#rc-hang-leather-r)" d={backR} />
        <path fill="url(#rc-hang-leather)" fillRule="evenodd" d={flap + holes} />
      </g>
      {/* the light across the curve of the front wing */}
      <path fill="url(#rc-hang-sheen)" fillRule="evenodd" d={flap + holes} />
      {/* deep shade where the front wing overlaps the back one, and under each pointed corner */}
      <g className="hang-shade" filter="url(#rc-soft)" opacity="0.75">
        <path d={edge} transform="translate(-2.2 1.4)" fill="none" stroke="#1e0805" strokeWidth="3.4" />
        <path d="M-29.6 32 L-23.6 29 L-25.6 21 Z M29.6 32 L23.6 29 L25.6 21 Z M-19.5 29 L-8 33 L-13 24 Z" fill="#1e0805" />
      </g>
      {/* raised ridges: warmer light where the membrane turns over the bones */}
      <g className="hang-ridge" filter="url(#rc-soft-fine)">
        <path d="M29.4 28 C24.6 10 19.6 -14 12.8 -44" />
        <path d="M-29.4 28 C-24.6 10 -19.8 -12 -13.8 -42" opacity="0.6" />
        <path d="M28 27.4 C21 24 12 24 3 27" opacity="0.7" />
      </g>
      <path className="hang-bones" d={bones} />
      <path className="fold" d={folds} />
      <path className="fold-lit" d={folds} transform="translate(0.6 -0.6)" />
      <path className="hang-veins" d={veins} />
      {/* the flap's leading edge: a narrow lit lip with the shade under it */}
      <path className="seam" d={edge} transform="translate(-1 1)" />
      <path className="rim" d={edge} />
      {/* controlled light down both outer edges to the pointed wrist corners */}
      <path className="rim rim-soft" d="M-8 -73 C-14 -56 -21 -28 -25 0 C-26.5 12 -28.5 22 -31 34.5" />
      <path className="rim rim-soft" d="M8 -73 C14 -56 21 -28 25 0 C26.5 12 28.5 22 31 34.5" />
      {/* a soft shadow where the head hangs against the wings, then the short neck */}
      <ellipse cx="0" cy="36.5" rx="15" ry="4.6" fill="#0c0502" opacity="0.55" filter="url(#rc-soft)" />
      {/* the head, hanging upside down between the wrist corners; it turns from the neck */}
      <g className="bat-look bat-look-hang">
        <g filter="url(#rc-furry)">
          <ellipse cx="0" cy="35.4" rx="8.5" ry="5" fill="#2a150d" />
          <ellipse cx="0" cy="34.6" rx="5.5" ry="3" fill="#381e13" />
        </g>
        <g transform="translate(0 50) rotate(180)">
          <Face eyes={eyes} open={open} mouth={mouth} />
        </g>
      </g>
    </g>
  );
}

export function BatSvg({
  pose,
  eyes = false,
  facing = 'away',
  mouth = 'closed',
  className,
}: {
  pose: BatPose;
  eyes?: boolean;
  /** 'toward': eyes open on the visitor. 'away': resting, eyes shut unless `eyes` lights them. */
  facing?: 'away' | 'toward';
  mouth?: Mouth;
  className?: string;
}) {
  const open = facing === 'toward' || eyes;
  return (
    <svg
      className={`bat bat-${pose} bat-${facing} ${className ?? ''}`}
      viewBox={pose === 'hang' ? HANG_VIEWBOX : '-122 -76 244 152'}
      aria-hidden="true"
      focusable="false"
    >
      <g className="bat-rig">
        {pose === 'hang' ? (
          <Hanging eyes={eyes} open={open} mouth={mouth} />
        ) : (
          <>
            <g className="wing wing-left">
              <g transform="scale(-1 1)">
                <WingShape />
              </g>
            </g>
            <g className="wing wing-right">
              <WingShape />
            </g>
            <FlyBody eyes={eyes} open={open} mouth={mouth} />
          </>
        )}
      </g>
    </svg>
  );
}
