import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { blackoutPattern, brownoutPattern, limitFlashes, maxFlashesInAnySecond, stormPattern } from '../../src/director/flash';
import { footprintPath, seeded } from '../../src/director/footprints';
import { begin, canStart, end, initialStage, quietGap, type AnomalySize, type StageState } from '../../src/director/stage';

const key = fc.record({ t: fc.integer({ min: 0, max: 5000 }), level: fc.double({ min: 0, max: 1, noNaN: true }) });

describe('flash limiter (Req 9.4, 26.5, 34)', () => {
  it('never lets more than 3 flashes into any one-second window', () => {
    fc.assert(
      fc.property(fc.array(key, { maxLength: 60 }), (pattern) => {
        expect(maxFlashesInAnySecond(limitFlashes(pattern))).toBeLessThanOrEqual(3);
      }),
      { numRuns: 500 },
    );
  });

  it('keeps patterns that are already safe unchanged', () => {
    const slow = [
      { t: 0, level: 0.2 },
      { t: 600, level: 1 },
      { t: 1400, level: 0.3 },
    ];
    expect(limitFlashes(slow)).toEqual(slow);
  });

  it('the built-in storm, brownout and blackout patterns are safe', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const r = seeded(seed);
        expect(maxFlashesInAnySecond(stormPattern())).toBeLessThanOrEqual(3);
        expect(maxFlashesInAnySecond(brownoutPattern(r(), r))).toBeLessThanOrEqual(3);
        const b = blackoutPattern(r);
        expect(maxFlashesInAnySecond(b)).toBeLessThanOrEqual(3);
        // A Blackout never hides controls for more than 3 seconds (Req 34.6).
        const darkStart = b.find((k) => k.level === 0)?.t ?? 0;
        const back = b.find((k) => k.t > darkStart && k.level > 0)?.t ?? 0;
        expect(back - darkStart).toBeLessThanOrEqual(3000);
      }),
    );
  });
});

type Op = { kind: 'try'; id: string; size: AnomalySize; visitor: boolean; dt: number } | { kind: 'end'; dt: number };

const op: fc.Arbitrary<Op> = fc.oneof(
  fc.record({
    kind: fc.constant('try' as const),
    id: fc.constantFrom('a', 'b', 'c', 'd'),
    size: fc.constantFrom('major' as const, 'minor' as const, 'quirk' as const),
    visitor: fc.boolean(),
    dt: fc.integer({ min: 0, max: 8000 }),
  }),
  fc.record({ kind: fc.constant('end' as const), dt: fc.integer({ min: 0, max: 8000 }) }),
);

describe('Stage scheduler (Req 12.3a, 12.3b)', () => {
  it('never runs two major Anomalies at once, and ambient majors respect the quiet gap', () => {
    fc.assert(
      fc.property(fc.array(op, { maxLength: 80 }), fc.integer({ min: 1, max: 3 }), (ops, act) => {
        let s: StageState = initialStage;
        let now = 0;
        for (const o of ops) {
          now += o.dt;
          if (o.kind === 'end') {
            if (s.holder) s = end(s, s.holder.id, now);
            continue;
          }
          if (!canStart(s, o.size, o.visitor, now, act)) continue;
          if (!o.visitor && o.size === 'major') {
            expect(s.holder).toBeNull();
            expect(now - s.lastEnd).toBeGreaterThanOrEqual(quietGap(act));
          }
          if (!o.visitor && o.size !== 'major') expect(s.holder).toBeNull();
          // A visitor Consequence pre-empts an ambient holder; the ambient one is ended first.
          if (s.holder && o.visitor) s = end(s, s.holder.id, now);
          expect(s.holder).toBeNull();
          s = begin(s, o.id, o.size, o.visitor);
        }
      }),
      { numRuns: 400 },
    );
  });
});

describe('footprints (Req 13.3)', () => {
  const pt = fc.record({ x: fc.integer({ min: 0, max: 1600 }), y: fc.integer({ min: 0, max: 3000 }) });
  it('ends at the cart, alternates feet and keeps strides short', () => {
    fc.assert(
      fc.property(pt, pt, fc.integer(), (from, to, seed) => {
        const prints = footprintPath(from, to, seeded(seed));
        const last = prints[prints.length - 1]!;
        expect(Math.hypot(last.x - to.x, last.y - to.y)).toBeLessThan(1e-6);
        prints.forEach((p, i) => expect(p.foot).toBe(i % 2 === 0 ? 'left' : 'right'));
        for (const p of prints) {
          expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.angle)).toBe(true);
        }
      }),
      { numRuns: 300 },
    );
  });
});
