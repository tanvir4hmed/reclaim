/**
 * An original bat drawing in code. Wings are separate groups so CSS can fold, unfold and
 * flap them; `pose` picks the state. Eyes can glow (Requirement 11.1b).
 */
export function BatSvg({
  pose,
  eyes = false,
  facing = 'away',
  className,
}: {
  pose: 'hang' | 'fly' | 'spread';
  eyes?: boolean;
  facing?: 'away' | 'toward';
  className?: string;
}) {
  return (
    <svg
      className={`bat bat-${pose} bat-${facing} ${className ?? ''}`}
      viewBox="-60 -30 120 70"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id="batFur" cx="50%" cy="35%" r="70%">
          <stop offset="0" stopColor="#3b3230" />
          <stop offset="1" stopColor="#120e0d" />
        </radialGradient>
        <linearGradient id="batSkin" x1="0" x2="1">
          <stop offset="0" stopColor="#2a2120" />
          <stop offset="1" stopColor="#0d0a0a" />
        </linearGradient>
      </defs>
      <g className="wing wing-left">
        <path
          d="M-6 0 C-18 -14 -34 -20 -56 -10 C-48 -6 -46 0 -48 6 C-40 2 -34 4 -32 10 C-26 4 -18 6 -14 12 C-12 6 -8 4 -6 4 Z"
          fill="url(#batSkin)"
        />
        <path d="M-6 0 L-56 -10 M-12 2 L-48 6 M-14 4 L-32 10 M-10 5 L-14 12" stroke="#000" strokeOpacity="0.45" strokeWidth="0.8" fill="none" />
      </g>
      <g className="wing wing-right">
        <path
          d="M6 0 C18 -14 34 -20 56 -10 C48 -6 46 0 48 6 C40 2 34 4 32 10 C26 4 18 6 14 12 C12 6 8 4 6 4 Z"
          fill="url(#batSkin)"
        />
        <path d="M6 0 L56 -10 M12 2 L48 6 M14 4 L32 10 M10 5 L14 12" stroke="#000" strokeOpacity="0.45" strokeWidth="0.8" fill="none" />
      </g>
      <g className="bat-body">
        <ellipse cx="0" cy="4" rx="8" ry="12" fill="url(#batFur)" />
        <g className="bat-head">
          <path d="M-6 -8 L-8 -19 L-2 -11 Z M6 -8 L8 -19 L2 -11 Z" fill="#1a1413" className="bat-ears" />
          <circle cx="0" cy="-7" r="6.5" fill="url(#batFur)" />
          {facing === 'toward' && (
            <>
              <path d="M-2.4 -2.8 l1 2.6 l1 -2.6 M0.6 -2.8 l1 2.6 l1 -2.6" fill="#e9e1d8" />
              <circle cx="-2.6" cy="-8" r="1.5" className={eyes ? 'bat-eye glow' : 'bat-eye'} />
              <circle cx="2.6" cy="-8" r="1.5" className={eyes ? 'bat-eye glow' : 'bat-eye'} />
            </>
          )}
          {facing === 'away' && eyes && (
            <>
              <circle cx="-2.6" cy="-8" r="1.3" className="bat-eye glow" />
              <circle cx="2.6" cy="-8" r="1.3" className="bat-eye glow" />
            </>
          )}
        </g>
        <path d="M-4 15 l-1.5 5 M4 15 l1.5 5" stroke="#120e0d" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    </svg>
  );
}
