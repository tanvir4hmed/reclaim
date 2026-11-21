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

/** Hanging pose frame: feet at the top (y −72), ears at the bottom (y 100). Aspect 92:172. */
const HANG_VIEWBOX = '-46 -72 92 172';
export const HANG_ASPECT = 172 / 92;

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

// --- Right wing geometry (the left is its mirror). Shoulder S, wrist W, finger tips T1..T4.
const S: P = [9, -8];
const W: P = [50, -40];
const T1: P = [120, -66];
const T2: P = [119, -12];
const T3: P = [101, 34];
const T4: P = [60, 56];
const B: P = [12, 30];

const WING = (() => {
  const r = seeded(17);
  const edge =
    ragged(T1, T2, W, 0.32, r) + ragged(T2, T3, W, 0.3, r) + ragged(T3, T4, W, 0.3, r) + ragged(T4, B, W, 0.22, r, 9);
  const holes = hole(88, -18, 3.2, r) + hole(76, 26, 2.4, r) + hole(104, 6, 1.8, r) + hole(40, 30, 1.6, r);
  return `M${S[0]} ${S[1]} L${W[0]} ${W[1]} L${T1[0]} ${T1[1]}${edge} Z${holes}`;
})();

export function BatDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="rc-fur" cx="50%" cy="30%" r="75%">
          <stop offset="0" stopColor="#4a3530" />
          <stop offset="0.55" stopColor="#21150f" />
          <stop offset="1" stopColor="#0a0605" />
        </radialGradient>
        {/* Wing membrane lit from behind: blood-red where it is thin, near black at the bones. */}
        <radialGradient id="rc-membrane" cx="48%" cy="42%" r="70%">
          <stop offset="0" stopColor="#c1281d" />
          <stop offset="0.45" stopColor="#7a160f" />
          <stop offset="0.8" stopColor="#2e0906" />
          <stop offset="1" stopColor="#140403" />
        </radialGradient>
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
        <radialGradient id="rc-ear" cx="50%" cy="70%" r="70%">
          <stop offset="0" stopColor="#c0453a" />
          <stop offset="0.6" stopColor="#6e1a14" />
          <stop offset="1" stopColor="#2a0907" />
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

/** One wing, drawn for the right side; the left is mirrored by its parent. */
function WingShape() {
  const bone = (a: P, b: P, bend = 0) =>
    `M${a[0]} ${a[1]} Q${((a[0] + b[0]) / 2 + bend).toFixed(1)} ${((a[1] + b[1]) / 2 - bend).toFixed(1)} ${b[0]} ${b[1]}`;
  return (
    <>
      <path className="membrane" fill="url(#rc-membrane)" fillRule="evenodd" d={WING} />
      {/* veins branching through the thin membrane */}
      <path
        className="veins"
        d="M58 -38 q20 6 34 -6 M64 -20 q14 8 30 4 q8 -2 16 4 M58 -8 q10 14 30 14 M54 6 q6 14 20 22 M44 12 q-4 12 -14 16 M72 -30 q8 -10 22 -14 M84 10 q8 6 10 16"
      />
      <path className="veins bright" d="M66 -24 q10 4 22 0 M60 2 q8 10 18 12" />
      {/* arm and finger bones */}
      <path className="bone-wing" d={`M${S[0]} ${S[1]} Q 28 -30 ${W[0]} ${W[1]}`} />
      <path className="bone-wing thin" d={`${bone(W, T1, 3)} ${bone(W, T2, 2)} ${bone(W, T3, -2)} ${bone(W, T4, -3)}`} />
      <circle className="joint" cx={W[0]} cy={W[1]} r={2.8} />
      {/* hooked thumb claw at the wrist */}
      <path className="claw" d="M50 -40 q2 -8 -4 -13 q1 7 -3 9" />
      <path className="claw-fill" d="M49 -42 q1 -7 -3 -10 q0 6 -2 8 Z" />
    </>
  );
}

/** The face, drawn upright and centred on (0, 0); the hanging pose turns it upside down. */
function Face({ eyes, open, mouth }: { eyes: boolean; open: boolean; mouth: Mouth }) {
  const drop = mouth === 'snarl' ? 13 : mouth === 'open' ? 7 : 0;
  return (
    <g className={`bat-face mouth-${mouth}`}>
      {/* tall, pointed, veined ears */}
      {[-1, 1].map((s) => (
        <g key={s} className="bat-ear">
          <path d={`M${-6 * s} -9 C ${-14 * s} -18 ${-21 * s} -32 ${-20 * s} -46 C ${-13 * s} -38 ${-6 * s} -26 ${-1 * s} -12 Z`} fill="url(#rc-ear)" stroke="#120706" strokeWidth="0.8" />
          <path d={`M${-7 * s} -13 q${-5 * s} -10 ${-10 * s} -24 M${-9 * s} -18 q${-4 * s} -2 ${-7 * s} -2`} stroke="#3a0b08" strokeWidth="0.6" fill="none" />
        </g>
      ))}
      {/* wild fur */}
      <g filter="url(#rc-furry)">
        <ellipse rx="15" ry="14" fill="url(#rc-fur)" />
        <ellipse cy="4" rx="11" ry="8" fill="#2c1c17" opacity="0.8" />
      </g>
      <path
        d="M-15 -2 l-4 -2 M-14 5 l-5 1 M15 -2 l4 -2 M14 5 l5 1 M-10 -12 l-2 -4 M10 -12 l2 -4 M-4 -14 l0 -4 M4 -14 l0 -4 M-12 10 l-3 4 M12 10 l3 4"
        stroke="#3b2a24"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      {/* brows dragged down into a scowl */}
      <path d="M-12 -7 L-3 -3 M12 -7 L3 -3" stroke="#0e0605" strokeWidth="1.6" strokeLinecap="round" />
      {/* eyes: shut slits at rest; open and burning red when it looks at you */}
      {[-1, 1].map((s) => (
        <g key={s} transform={`translate(${6.5 * s} -1)`}>
          {open || eyes ? (
            <g className="bat-eye-look">
              <path d={`M${-4 * s} 1 Q 0 -3.6 ${4 * s} -1 Q 0 3 ${-4 * s} 1 Z`} fill="#140605" />
              <ellipse className={eyes ? 'bat-eye glow' : 'bat-eye'} rx="3" ry="2.2" fill={eyes ? 'url(#rc-eye-glow)' : '#4a1410'} filter={eyes ? 'url(#rc-glow)' : undefined} />
              <ellipse className="bat-pupil" rx="0.6" ry="1.8" fill="#1a0402" />
            </g>
          ) : (
            <path d={`M${-4 * s} 0 Q 0 1.6 ${4 * s} -0.6`} stroke="#5a1610" strokeWidth="1" fill="none" />
          )}
        </g>
      ))}
      {/* snout: a wrinkled, upturned nose with flared nostrils */}
      <path d="M-5 6 C-4 2 4 2 5 6 C4 9 -4 9 -5 6 Z" fill="#3a2420" />
      <ellipse cx="-2" cy="6.2" rx="1.1" ry="0.8" fill="#0a0303" />
      <ellipse cx="2" cy="6.2" rx="1.1" ry="0.8" fill="#0a0303" />
      <path d="M-7 3 q2 -2 4 0 M7 3 q-2 -2 -4 0" stroke="#160b09" strokeWidth="0.6" fill="none" />
      {/* the mouth: lips peel back from long fangs and rows of small teeth */}
      <g className="bat-mouth" transform="translate(0 11)">
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

/** Flying body: furred torso, clawed feet reaching forward, head on top. */
function FlyBody({ eyes, open, mouth }: { eyes: boolean; open: boolean; mouth: Mouth }) {
  return (
    <g className="bat-body">
      {/* legs and hooked talons, reaching for whatever is in front */}
      {[-1, 1].map((s) => (
        <g key={s}>
          <path className="leg" d={`M${8 * s} 20 Q ${16 * s} 32 ${17 * s} 44`} />
          <path className="claw" d={`M${17 * s} 44 q${-4 * s} 4 ${-3 * s} 9 M${17 * s} 44 q${0} 5 ${2 * s} 9 M${17 * s} 44 q${4 * s} 3 ${6 * s} 7 M${17 * s} 44 q${-6 * s} 1 ${-8 * s} 5`} />
        </g>
      ))}
      <g filter="url(#rc-furry)">
        <ellipse cx="0" cy="6" rx="14" ry="22" fill="url(#rc-fur)" />
        <ellipse cx="0" cy="-6" rx="12" ry="9" fill="#2c1d18" opacity="0.8" />
      </g>
      <path d="M-8 0 l-2 6 M-3 4 l-1 7 M3 4 l1 7 M8 0 l2 6 M-6 14 l-1 6 M6 14 l1 6" stroke="#3d2b24" strokeWidth="1" strokeLinecap="round" />
      <g className="bat-look bat-look-fly">
        <g transform="translate(0 -24)">
          <Face eyes={eyes} open={open} mouth={mouth} />
        </g>
      </g>
    </g>
  );
}

/** Hanging: the wrapped-wing cocoon, the feet on the perch, the head upside down below. */
function Hanging({ eyes, open, mouth }: { eyes: boolean; open: boolean; mouth: Mouth }) {
  const r = seeded(5);
  // Outline of the two wrapped wings, with the elbows sticking out at the sides.
  const left = 'M-3 -60 C-14 -52 -28 -34 -35 -12 C-36 -6 -34 0 -31 6 C-26 22 -18 34 -9 42 L0 44 L0 -60 Z';
  const right = 'M3 -60 C14 -52 28 -34 35 -12 C36 -6 34 0 31 6 C26 22 18 34 9 42 L0 44 L0 -60 Z';
  const holesL = hole(-20, -16, 1.8, r) + hole(-14, 12, 1.3, r);
  const holesR = hole(18, 4, 2, r) + hole(24, -22, 1.2, r);
  return (
    <g className="bat-body">
      {/* feet: toes curled over the perch, long hooked claws */}
      {[-1, 1].map((s) => (
        <g key={s}>
          <path className="leg" d={`M${5 * s} -58 L${5 * s} -64`} />
          <path className="claw" d={`M${3 * s} -64 q${1 * s} -6 ${4 * s} -6 q2 0 ${3 * s} 3 M${6 * s} -64 q${1 * s} -5 ${4 * s} -4`} />
        </g>
      ))}
      <g className="bat-wrap" filter="url(#rc-leathery)">
        <path fill="url(#rc-leather)" fillRule="evenodd" d={left + holesL} />
        <path fill="url(#rc-leather-r)" fillRule="evenodd" d={right + holesR} />
      </g>
      {/* folded finger bones as ridges, and the overlap seam down the middle */}
      <path className="fold" d="M-3 -56 C-14 -40 -28 -24 -34 -10 M-33 -6 C-20 -2 -8 12 -2 38 M-30 8 C-22 18 -14 30 -8 40" />
      <path className="fold" d="M3 -56 C14 -40 28 -24 34 -10 M33 -6 C20 -2 8 12 2 38 M30 8 C22 18 14 30 8 40" />
      <path className="seam" d="M0 -58 C2 -30 -2 0 1 42" />
      {/* red rim light along the outer edges, like a low moon behind it */}
      <path className="rim" d="M-3 -60 C-14 -52 -28 -34 -35 -12 C-36 -6 -34 0 -31 6 C-26 22 -18 34 -9 42" />
      <path className="rim" d="M3 -60 C14 -52 28 -34 35 -12 C36 -6 34 0 31 6 C26 22 18 34 9 42" />
      {/* the head, hanging upside down beneath the wings; it turns from the neck */}
      <g className="bat-look bat-look-hang">
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
