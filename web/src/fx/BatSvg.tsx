/**
 * An original bat, drawn in code: membrane wings stretched over finger bones, a thumb claw,
 * furred body, tall veined ears, a leaf nose and a mouth that opens on long fangs.
 * Shared gradients and filters live once in <BatDefs /> (mounted by the FX layer).
 *
 * Poses: 'hang' wings wrapped like a cloak (drawn upright, rotated by CSS to hang),
 * 'fly' spread with a flap cycle, 'spread' spread and still (the lunge).
 */
export type BatPose = 'hang' | 'fly' | 'spread';

export function BatDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="rc-fur" cx="50%" cy="30%" r="75%">
          <stop offset="0" stopColor="#4a3a33" />
          <stop offset="0.55" stopColor="#261c18" />
          <stop offset="1" stopColor="#0d0908" />
        </radialGradient>
        <radialGradient id="rc-face" cx="50%" cy="40%" r="70%">
          <stop offset="0" stopColor="#5a4038" />
          <stop offset="1" stopColor="#1a1210" />
        </radialGradient>
        <linearGradient id="rc-membrane-l" x1="1" x2="0" y1="0" y2="0.3">
          <stop offset="0" stopColor="#1a1311" />
          <stop offset="0.6" stopColor="#2c201b" stopOpacity="0.96" />
          <stop offset="1" stopColor="#4a3328" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id="rc-membrane-r" x1="0" x2="1" y1="0" y2="0.3">
          <stop offset="0" stopColor="#1a1311" />
          <stop offset="0.6" stopColor="#2c201b" stopOpacity="0.96" />
          <stop offset="1" stopColor="#4a3328" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id="rc-ear" x1="0" x2="0" y1="1" y2="0">
          <stop offset="0" stopColor="#2a1d18" />
          <stop offset="1" stopColor="#5c3d33" />
        </linearGradient>
        <radialGradient id="rc-eye-glow" cx="45%" cy="40%" r="60%">
          <stop offset="0" stopColor="#fff2b0" />
          <stop offset="0.35" stopColor="#ffb02e" />
          <stop offset="0.8" stopColor="#c2260c" />
          <stop offset="1" stopColor="#3a0602" />
        </radialGradient>
        <radialGradient id="rc-eye-dark" cx="40%" cy="35%" r="65%">
          <stop offset="0" stopColor="#3a2a22" />
          <stop offset="1" stopColor="#050303" />
        </radialGradient>
        <radialGradient id="rc-throat" cx="50%" cy="30%" r="70%">
          <stop offset="0" stopColor="#7a1018" />
          <stop offset="1" stopColor="#1a0204" />
        </radialGradient>
        {/* Fur: break the body outline into tufts and give it a fibrous texture. */}
        <filter id="rc-furry" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="rc-glow" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
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

/** Wing: arm, wrist, four finger bones and a scalloped membrane between them. */
function Wing({ side }: { side: 1 | -1 }) {
  const s = side;
  const p = (x: number, y: number) => `${x * s} ${y}`;
  return (
    <g className={`wing ${s < 0 ? 'wing-left' : 'wing-right'}`}>
      <path
        className="membrane"
        fill={`url(#rc-membrane-${s < 0 ? 'l' : 'r'})`}
        d={`M${p(9, -6)} L${p(46, -30)} L${p(118, -22)} Q${p(108, 0)} ${p(112, 18)} Q${p(96, 26)} ${p(88, 46)} Q${p(70, 44)} ${p(54, 54)} Q${p(34, 40)} ${p(14, 34)} Z`}
      />
      {/* veins in the membrane */}
      <path
        className="veins"
        d={`M${p(30, 4)} Q${p(60, 2)} ${p(90, 20)} M${p(26, 18)} Q${p(52, 22)} ${p(70, 40)} M${p(60, -12)} Q${p(84, -6)} ${p(104, 4)}`}
      />
      {/* arm and finger bones */}
      <path className="bone-wing" d={`M${p(9, -6)} Q${p(26, -24)} ${p(46, -30)}`} />
      <path className="bone-wing thin" d={`M${p(46, -30)} L${p(118, -22)} M${p(46, -30)} L${p(112, 18)} M${p(46, -30)} L${p(88, 46)} M${p(46, -30)} L${p(54, 54)}`} />
      <circle className="joint" cx={46 * s} cy={-30} r={2.6} />
      {/* thumb claw */}
      <path className="claw" d={`M${p(46, -30)} q${4 * s} -9 ${-1 * s} -14 q${-1 * s} 7 ${-4 * s} 9`} />
    </g>
  );
}

/** Wings wrapped around the body like a cloak, for hanging. */
function Cloak() {
  return (
    <g className="cloak">
      {/* Each wing folds forward over the body; together they make a teardrop that hides the legs. */}
      <path
        fill="url(#rc-membrane-l)"
        d="M-4 -20 C-28 -16 -36 14 -30 38 C-26 54 -14 64 0 66 C-6 44 -6 10 -4 -20 Z"
      />
      <path
        fill="url(#rc-membrane-r)"
        d="M4 -20 C28 -16 36 14 30 38 C26 54 14 64 0 66 C6 44 6 10 4 -20 Z"
      />
      {/* folded finger bones show through the membrane as ridges */}
      <path className="bone-wing thin" d="M-6 -18 C-24 -8 -30 20 -24 44 M-5 -16 C-16 4 -18 30 -10 56 M6 -18 C24 -8 30 20 24 44 M5 -16 C16 4 18 30 10 56" />
      <path className="veins" d="M-20 6 q-4 14 -2 26 M20 6 q4 14 2 26" />
      {/* thumb claws hooked at the shoulders, beside the face */}
      <path className="claw" d="M-10 -20 q-6 -5 -3 -11 q1 5 4 6 M10 -20 q6 -5 3 -11 q-1 5 -4 6" />
    </g>
  );
}

function Face({ eyes, mouth }: { eyes: boolean; mouth: 'closed' | 'open' | 'snarl' }) {
  return (
    <g className={`bat-face mouth-${mouth}`}>
      {/* leaf nose and wrinkled snout */}
      <path d="M-5 -22 C-3 -28 3 -28 5 -22 C4 -18 -4 -18 -5 -22 Z" fill="#3b2722" />
      <path d="M-3 -21 q3 -5 6 0 M-2 -24 q2 -2 4 0" stroke="#160d0b" strokeWidth="0.8" fill="none" />
      <path d="M-11 -30 q4 3 6 9 M11 -30 q-4 3 -6 9 M-9 -35 q9 -4 18 0" stroke="#160d0b" strokeOpacity="0.7" strokeWidth="0.7" fill="none" />
      {/* eyes */}
      {[-1, 1].map((s) => (
        <g key={s} transform={`translate(${s * 7.5} -32)`}>
          <ellipse rx="3.6" ry="3" fill="#120a08" />
          <ellipse
            className={eyes ? 'bat-eye glow' : 'bat-eye'}
            rx="2.7"
            ry="2.2"
            fill={eyes ? 'url(#rc-eye-glow)' : 'url(#rc-eye-dark)'}
            filter={eyes ? 'url(#rc-glow)' : undefined}
          />
          {!eyes && <circle cx="-0.8" cy="-0.8" r="0.7" fill="#d8cfc4" opacity="0.8" />}
          {eyes && <ellipse rx="0.6" ry="1.9" fill="#1a0402" />}
        </g>
      ))}
      {/* mouth: upper lip, fangs, jaw that drops */}
      <g className="bat-mouth" transform="translate(0 -14)">
        <path className="throat" d="M-7 0 Q0 9 7 0 Q0 3 -7 0 Z" fill="url(#rc-throat)" />
        <path className="bat-jaw" d="M-7 0 Q0 4 7 0 L5 3 Q0 6 -5 3 Z" fill="#2a1a16" />
        <path className="fang" d="M-4.6 -0.4 L-3.4 5.6 L-2.4 -0.2 Z M4.6 -0.4 L3.4 5.6 L2.4 -0.2 Z" fill="#efe6d2" />
        <path className="fang small" d="M-1.4 0 L-0.9 2.2 L-0.4 0 Z M1.4 0 L0.9 2.2 L0.4 0 Z" fill="#e2d7c0" />
        <path d="M-8 -0.6 Q0 2.4 8 -0.6" stroke="#130b09" strokeWidth="1.1" fill="none" />
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
  facing?: 'away' | 'toward';
  mouth?: 'closed' | 'open' | 'snarl';
  className?: string;
}) {
  return (
    <svg
      className={`bat bat-${pose} bat-${facing} ${className ?? ''}`}
      viewBox={pose === 'hang' ? '-46 -62 92 136' : '-122 -76 244 152'}
      aria-hidden="true"
      focusable="false"
    >
      <g className="bat-rig">
        {pose === 'hang' ? null : (
          <>
            <Wing side={-1} />
            <Wing side={1} />
          </>
        )}
        <g className="bat-body">
          {/* legs and hooked feet (they grip the perch when hanging) */}
          <path className="leg" d="M-5 28 q-3 12 -4 22 M5 28 q3 12 4 22" />
          <path className="claw" d="M-9 50 q-3 4 0 6 M-9 50 q1 5 3 5 M9 50 q3 4 0 6 M9 50 q-1 5 -3 5" />
          <path className="tail-membrane" d="M-9 30 Q0 46 9 30 Q0 36 -9 30 Z" fill="#1d1411" />
          <g filter="url(#rc-furry)">
            <ellipse cx="0" cy="8" rx="13" ry="24" fill="url(#rc-fur)" />
            <ellipse cx="0" cy="-8" rx="11" ry="9" fill="#2f231e" opacity="0.7" />
          </g>
          {pose === 'hang' && <Cloak />}
          <g className="bat-head">
            {/* ears with inner veins */}
            {/* Short, broad, pointed ears (a real bat's, not a rabbit's). */}
            <path className="bat-ear" d="M-12 -34 C-16 -40 -17 -47 -15 -54 C-10 -50 -6 -45 -3 -40 Z" fill="url(#rc-ear)" />
            <path className="bat-ear" d="M12 -34 C16 -40 17 -47 15 -54 C10 -50 6 -45 3 -40 Z" fill="url(#rc-ear)" />
            <path d="M-10 -40 q-2 -5 -4 -10 M10 -40 q2 -5 4 -10" stroke="#7a4c3e" strokeOpacity="0.7" strokeWidth="0.8" fill="none" />
            <g filter="url(#rc-furry)">
              <ellipse cx="0" cy="-30" rx="13" ry="13" fill="url(#rc-fur)" />
            </g>
            {facing === 'toward' ? (
              <Face eyes={eyes} mouth={mouth} />
            ) : (
              // Back of the head: only a rim of eye-glow shows when it is about to turn.
              eyes && (
                <g opacity="0.7">
                  <ellipse cx="-8" cy="-30" rx="2" ry="1.4" fill="url(#rc-eye-glow)" filter="url(#rc-glow)" />
                  <ellipse cx="8" cy="-30" rx="2" ry="1.4" fill="url(#rc-eye-glow)" filter="url(#rc-glow)" />
                </g>
              )
            )}
          </g>
        </g>
      </g>
    </svg>
  );
}
