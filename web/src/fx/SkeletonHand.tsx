/**
 * The cursor over the bat: a skeletal hand, index finger raised and pointing, the other
 * fingers curled (Requirement 9.2). Clicking snaps it into a bony fist that grabs the bat.
 * The fingertip is the hotspot, so `x, y` is exactly where the pointer is.
 */
function Bone({ x1, y1, x2, y2, w }: { x1: number; y1: number; x2: number; y2: number; w: number }) {
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3b3128" strokeWidth={w + 1.6} strokeLinecap="round" />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="url(#rc-bone)" strokeWidth={w} strokeLinecap="round" />
      <circle cx={x2} cy={y2} r={w * 0.62} fill="#efe8d6" stroke="#3b3128" strokeWidth="0.8" />
    </g>
  );
}

export function SkeletonHand({ x, y, closed = false }: { x: number; y: number; closed?: boolean }) {
  return (
    <svg
      className={`skeleton-hand${closed ? ' closed' : ''}`}
      style={{ left: x - 25, top: y - 3 }}
      viewBox="0 0 70 96"
      aria-hidden="true"
      data-testid="skeleton-hand"
    >
      <defs>
        <linearGradient id="rc-bone" x1="0" x2="1">
          <stop offset="0" stopColor="#cfc5ad" />
          <stop offset="0.45" stopColor="#f4eedf" />
          <stop offset="1" stopColor="#b9ae95" />
        </linearGradient>
        <radialGradient id="rc-bone-shadow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#000" stopOpacity="0.35" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="38" cy="92" rx="22" ry="4" fill="url(#rc-bone-shadow)" />
      {!closed ? (
        <g className="hand-open">
          {/* wrist bones */}
          <Bone x1={33} y1={94} x2={34} y2={80} w={7} />
          <Bone x1={42} y1={94} x2={42} y2={80} w={6} />
          {/* palm (metacarpals) */}
          <Bone x1={31} y1={78} x2={26} y2={52} w={4.6} />
          <Bone x1={36} y1={78} x2={36} y2={54} w={4.2} />
          <Bone x1={41} y1={78} x2={45} y2={56} w={4} />
          <Bone x1={45} y1={78} x2={53} y2={60} w={3.6} />
          {/* raised index finger: three phalanges, pointing */}
          <Bone x1={26} y1={52} x2={25} y2={34} w={4.2} />
          <Bone x1={25} y1={34} x2={25} y2={18} w={3.8} />
          <Bone x1={25} y1={18} x2={25} y2={5} w={3.4} />
          {/* curled middle, ring, little fingers */}
          <Bone x1={36} y1={54} x2={38} y2={44} w={3.8} />
          <Bone x1={38} y1={44} x2={33} y2={50} w={3.4} />
          <Bone x1={45} y1={56} x2={47} y2={47} w={3.6} />
          <Bone x1={47} y1={47} x2={42} y2={53} w={3.2} />
          <Bone x1={53} y1={60} x2={55} y2={52} w={3.2} />
          <Bone x1={55} y1={52} x2={50} y2={57} w={2.8} />
          {/* thumb across the curled fingers */}
          <Bone x1={30} y1={80} x2={18} y2={68} w={4.4} />
          <Bone x1={18} y1={68} x2={20} y2={57} w={3.8} />
          <Bone x1={20} y1={57} x2={30} y2={55} w={3.4} />
        </g>
      ) : (
        <g className="hand-fist">
          <Bone x1={33} y1={94} x2={34} y2={80} w={7} />
          <Bone x1={42} y1={94} x2={42} y2={80} w={6} />
          <Bone x1={29} y1={78} x2={24} y2={58} w={4.6} />
          <Bone x1={35} y1={78} x2={33} y2={56} w={4.4} />
          <Bone x1={41} y1={78} x2={42} y2={57} w={4.2} />
          <Bone x1={46} y1={78} x2={51} y2={60} w={3.8} />
          {/* fingers folded down over the palm: the grab */}
          {[
            [24, 58, 22, 48, 28, 44, 30, 54],
            [33, 56, 32, 46, 38, 43, 39, 53],
            [42, 57, 42, 47, 48, 45, 48, 55],
            [51, 60, 52, 51, 57, 50, 56, 58],
          ].map(([a, b, c, d, e, f, g, h], i) => (
            <g key={i}>
              <Bone x1={a!} y1={b!} x2={c!} y2={d!} w={3.8} />
              <Bone x1={c!} y1={d!} x2={e!} y2={f!} w={3.4} />
              <Bone x1={e!} y1={f!} x2={g!} y2={h!} w={3} />
            </g>
          ))}
          <Bone x1={29} y1={80} x2={16} y2={70} w={4.4} />
          <Bone x1={16} y1={70} x2={20} y2={60} w={3.8} />
          <Bone x1={20} y1={60} x2={36} y2={60} w={3.4} />
        </g>
      )}
    </svg>
  );
}
