/**
 * Design tokens for both states (steering: design-direction.md). One source of truth:
 * the theme component writes them as CSS custom properties, and tests check contrast.
 */
export interface Palette {
  paper: string;
  paper2: string;
  card: string;
  line: string;
  ink: string;
  muted: string;
  berry: string;
  berryInk: string;
  berryHover: string;
  /** Button outline. Haunted buttons are too dark to stand out from cards without it. */
  berryEdge: string;
  gold: string;
  goldInk: string;
  focus: string;
  sale: string;
  saleInk: string;
}

export const DAY: Palette = {
  paper: '#f4ecdf',
  paper2: '#fbf6ee',
  card: '#fffaf3',
  line: '#e3d6c3',
  ink: '#2a2220',
  muted: '#6a574d',
  berry: '#9b1b24',
  berryInk: '#fff8f0',
  berryHover: '#7f141c',
  berryEdge: '#9b1b24',
  gold: '#c8a24c',
  goldInk: '#7a5a14',
  focus: '#1f5fbf',
  sale: '#b81d2a',
  saleInk: '#ffffff',
};

export const HAUNTED: Palette = {
  paper: '#0e1420',
  paper2: '#121826',
  card: '#171a22',
  line: '#2a2f3b',
  ink: '#e6dccb',
  muted: '#a99f90',
  berry: '#7a1820',
  berryInk: '#f1e7d6',
  berryHover: '#5f1118',
  berryEdge: '#b84a52',
  gold: '#a8894e',
  goldInk: '#c9ad73',
  focus: '#e8c66a',
  sale: '#5c1218',
  saleInk: '#f1e7d6',
};

/** Text/background pairs that must meet WCAG AA (4.5:1 for normal text). */
export const TEXT_PAIRS: ReadonlyArray<readonly [keyof Palette, keyof Palette]> = [
  ['ink', 'paper'],
  ['ink', 'paper2'],
  ['ink', 'card'],
  ['muted', 'paper'],
  ['muted', 'card'],
  ['berryInk', 'berry'],
  ['berryInk', 'berryHover'],
  ['goldInk', 'card'],
  ['saleInk', 'sale'],
];

/** Non-text UI pairs that must meet 3:1 (WCAG 1.4.11). */
export const UI_PAIRS: ReadonlyArray<readonly [keyof Palette, keyof Palette]> = [
  ['focus', 'paper'],
  ['focus', 'card'],
  ['berryEdge', 'card'],
  ['berryEdge', 'paper'],
];

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m?.[1]) throw new Error(`Bad colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

export function cssVars(p: Palette): Record<string, string> {
  return {
    '--paper': p.paper,
    '--paper-2': p.paper2,
    '--card': p.card,
    '--line': p.line,
    '--ink': p.ink,
    '--muted': p.muted,
    '--berry': p.berry,
    '--berry-ink': p.berryInk,
    '--berry-hover': p.berryHover,
    '--berry-edge': p.berryEdge,
    '--gold': p.gold,
    '--gold-ink': p.goldInk,
    '--focus': p.focus,
    '--sale': p.sale,
    '--sale-ink': p.saleInk,
  };
}
