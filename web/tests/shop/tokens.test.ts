import { describe, expect, it } from 'vitest';
import { DAY, HAUNTED, TEXT_PAIRS, UI_PAIRS, contrast, type Palette } from '../../src/shop/tokens';

describe('design tokens meet WCAG AA in both states (Req 26.6)', () => {
  for (const [name, palette] of [
    ['day', DAY],
    ['haunted', HAUNTED],
  ] as [string, Palette][]) {
    for (const [fg, bg] of TEXT_PAIRS) {
      it(`${name}: ${fg} on ${bg} ≥ 4.5`, () => {
        expect(contrast(palette[fg], palette[bg])).toBeGreaterThanOrEqual(4.5);
      });
    }
    for (const [fg, bg] of UI_PAIRS) {
      it(`${name}: ${fg} against ${bg} ≥ 3`, () => {
        expect(contrast(palette[fg], palette[bg])).toBeGreaterThanOrEqual(3);
      });
    }
  }
});
