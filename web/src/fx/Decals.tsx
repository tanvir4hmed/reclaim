import type { ReactElement } from 'react';
import { createPortal } from 'react-dom';
import type { LastingMark as Mark } from '../core';
import type { Print } from '../director/footprints';
import { useStory } from '../store';
import { useFx } from './fxStore';
import { useOpenDialog } from './TopLayer';

/**
 * A child's boot print, about 48 px long (pointing +x): the sole with its tread bars and a
 * separate heel, smudged where the foot dragged. Right feet are mirrored.
 */
export function FootprintShape({ foot }: { foot: 'left' | 'right' }) {
  const flip = foot === 'right' ? -1 : 1;
  return (
    <g transform={`scale(1 ${flip})`}>
      <path d="M-4 -7 C 8 -9, 20 -8, 24 -3 C 27 1, 24 6, 18 7 C 10 8, 2 7, -4 6 C -6 2, -6 -3, -4 -7 Z" />
      <path d="M-24 -5.5 C -17 -7, -11 -6.5, -10 -4 L -10 4 C -12 6.5, -18 6.5, -24 5 C -26 2, -26 -2, -24 -5.5 Z" />
      {/* tread: bars cut out of the print */}
      <g className="tread">
        <rect x="0" y="-5.4" width="1.6" height="10.6" />
        <rect x="5" y="-6.2" width="1.6" height="12" />
        <rect x="10" y="-6.4" width="1.6" height="12.6" />
        <rect x="15" y="-5.6" width="1.6" height="11" />
        <rect x="-20" y="-4.2" width="1.4" height="8.4" />
        <rect x="-15.5" y="-4.6" width="1.4" height="9.2" />
      </g>
      {/* a smear behind the heel where it dragged */}
      <path className="smear" d="M-26 -3 C -34 -2, -40 0, -46 1 C -40 2, -33 3, -26 3 Z" />
    </g>
  );
}

const SHAPES: Record<string, (rot: number) => ReactElement> = {
  footprint: () => <FootprintShape foot="left" />,
  'footprint-r': () => <FootprintShape foot="right" />,
  ash: () => <ellipse cx="0" cy="0" rx="40" ry="3" opacity="0.5" />,
  wax: () => <path d="M-4 0 q2 8 0 14 q4 -2 4 -14 z" />,
  stuffing: () => <circle r="5" opacity="0.85" />,
  mitten: () => <path d="M-8 10 C-10 -4 -6 -12 0 -12 C6 -12 9 -6 8 2 L12 -2 C14 0 13 4 10 6 L8 10 Z" />,
};

function Prints({ prints }: { prints: readonly Print[] }) {
  return prints.map((p, i) => (
    <g
      key={`${i}-${p.x}`}
      className="print"
      style={{ animationDelay: `${i * 0.22}s` }}
      transform={`translate(${p.x} ${p.y}) rotate(${(p.angle * 180) / Math.PI})`}
    >
      <FootprintShape foot={p.foot} />
    </g>
  ));
}

/**
 * Lasting marks in page coordinates, so they stay where they fell when the page scrolls (Req 11.3b).
 * While the product view is open the walking prints are drawn inside it too (it sits above the
 * page), so the shoes start walking the moment they are taken, right there.
 */
export function Decals() {
  const marks = useStory((s) => s.story.marks);
  const prints = useFx((s) => s.prints);
  const dialog = useOpenDialog();
  return (
    <>
      {dialog &&
        prints.length > 0 &&
        createPortal(
          <svg className="decals decals-top" aria-hidden="true" data-testid="decals-top">
            <g transform={`translate(${-window.scrollX} ${-window.scrollY})`}>
              <Prints prints={prints} />
            </g>
          </svg>,
          dialog,
        )}
      <PageDecals marks={marks} prints={prints} />
    </>
  );
}

function PageDecals({ marks, prints }: { marks: readonly Mark[]; prints: readonly Print[] }) {
  return (
    <svg className="decals" aria-hidden="true" data-testid="decals">
      {marks.map((m) => {
        // Kinds no longer drawn (the hand's old blood spots) are skipped, even in a saved story.
        const shape = SHAPES[m.kind];
        return shape ? (
          <g key={m.id} className={`decal decal-${m.kind}`} transform={`translate(${m.x} ${m.y}) rotate(${(m.rotation * 180) / Math.PI}) scale(${m.scale})`}>
            {shape(m.rotation)}
          </g>
        ) : null;
      })}
      <Prints prints={prints} />
    </svg>
  );
}
