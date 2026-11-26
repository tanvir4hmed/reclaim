import { useFx } from './fxStore';

/** The severed hand (Requirement 11.3a): drawn in code, animated by the Director's sequence. */
export function CrawlingHand() {
  const pose = useFx((s) => s.flags['hand-x'] !== undefined);
  const x = useFx((s) => s.flags['hand-x'] ?? 0);
  const y = useFx((s) => s.flags['hand-y'] ?? 0);
  const stage = useFx((s) => s.flags['hand-stage'] ?? 0);
  if (!pose) return null;
  const names = ['rise', 'grip', 'pull', 'gone'];
  return (
    <svg
      className={`crawling-hand hand-${names[stage] ?? 'rise'}`}
      style={{ left: x - 40, top: y - 40 }}
      viewBox="0 0 80 80"
      aria-hidden="true"
      data-testid="crawling-hand"
    >
      <g className="hand-fingers">
        {[0, 1, 2, 3].map((i) => (
          <path
            key={i}
            className={`finger finger-${i}`}
            d={`M${22 + i * 10} 44 C ${21 + i * 10} 30, ${20 + i * 10} 18, ${24 + i * 10} 10 C ${27 + i * 10} 8, ${29 + i * 10} 12, ${28 + i * 10} 16 L ${28 + i * 10} 44 Z`}
          />
        ))}
        <path className="finger thumb" d="M18 50 C 10 46, 6 40, 8 36 C 10 33, 14 36, 18 42 Z" />
      </g>
      <path className="hand-palm" d="M16 44 C 16 60, 24 70, 40 72 C 56 70, 64 60, 62 44 Z" />
      <path className="hand-wound" d="M24 70 C 32 76, 48 76, 56 70 C 50 74, 30 74, 24 70 Z" />
    </svg>
  );
}
