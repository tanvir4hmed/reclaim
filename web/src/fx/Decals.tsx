import type { ReactElement } from 'react';
import { useStory } from '../store';
import { useFx } from './fxStore';

function FootprintShape({ foot }: { foot: 'left' | 'right' }) {
  const flip = foot === 'right' ? -1 : 1;
  return (
    <g transform={`scale(1 ${flip})`}>
      <ellipse cx="2" cy="0" rx="7" ry="4.2" />
      <ellipse cx="-7.5" cy="0.4" rx="3.6" ry="3" />
      <circle cx="9.5" cy="-2.6" r="1.4" />
      <circle cx="10.4" cy="-0.4" r="1.2" />
      <circle cx="10.2" cy="1.8" r="1.1" />
    </g>
  );
}

const SHAPES: Record<string, (rot: number) => ReactElement> = {
  footprint: () => <FootprintShape foot="left" />,
  'footprint-r': () => <FootprintShape foot="right" />,
  'blood-print': () => (
    <g>
      <ellipse cx="0" cy="0" rx="5" ry="7" />
      <ellipse cx="-1" cy="-9" rx="2.4" ry="3" opacity="0.8" />
    </g>
  ),
  drag: () => <rect x="-30" y="-2" width="60" height="4" rx="2" opacity="0.55" />,
  ash: () => <ellipse cx="0" cy="0" rx="40" ry="3" opacity="0.5" />,
  wax: () => <path d="M-4 0 q2 8 0 14 q4 -2 4 -14 z" />,
  stuffing: () => <circle r="5" opacity="0.85" />,
  mitten: () => <path d="M-8 10 C-10 -4 -6 -12 0 -12 C6 -12 9 -6 8 2 L12 -2 C14 0 13 4 10 6 L8 10 Z" />,
};

/** Lasting marks in page coordinates, so they stay where they fell when the page scrolls (Req 11.3b). */
export function Decals() {
  const marks = useStory((s) => s.story.marks);
  const prints = useFx((s) => s.prints);
  return (
    <svg className="decals" aria-hidden="true" data-testid="decals">
      {marks.map((m) => (
        <g key={m.id} className={`decal decal-${m.kind}`} transform={`translate(${m.x} ${m.y}) rotate(${(m.rotation * 180) / Math.PI}) scale(${m.scale})`}>
          {(SHAPES[m.kind] ?? SHAPES.ash)!(m.rotation)}
        </g>
      ))}
      {prints.map((p, i) => (
        <g
          key={`${i}-${p.x}`}
          className="print"
          style={{ animationDelay: `${i * 0.22}s` }}
          transform={`translate(${p.x} ${p.y}) rotate(${(p.angle * 180) / Math.PI})`}
        >
          <FootprintShape foot={p.foot} />
        </g>
      ))}
    </svg>
  );
}
