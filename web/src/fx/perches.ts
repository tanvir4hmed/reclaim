export interface PerchSpot {
  id: string;
  /** Page coordinates of where the bat's feet grip. */
  x: number;
  y: number;
}

/** Every `[data-perch]` element is a place the Day bat can hang from (Requirement 8.2). */
export function perchSpot(id: string, seed = 0.5): PerchSpot | null {
  const el = document.querySelector<HTMLElement>(`[data-perch="${CSS.escape(id)}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  // Hang from the top edge, inset so the bat never covers prices or buttons at the sides.
  // Category tiles centre their icon and text, so a bat there hangs from a corner instead.
  const frac = id.startsWith('tile-') ? (seed < 0.5 ? 0.1 : 0.9) : 0.2 + 0.6 * seed;
  const x = r.left + window.scrollX + r.width * frac;
  const y = r.top + window.scrollY + 2;
  return { id, x, y };
}

/** Perches near the current viewport, so the bat follows the visitor down the page. */
export function nearbyPerches(margin = 0.4): string[] {
  const vh = window.innerHeight;
  const out: string[] = [];
  for (const el of document.querySelectorAll<HTMLElement>('[data-perch]')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    if (r.top > -vh * margin && r.top < vh * (1 - 0.15)) out.push(el.dataset.perch ?? '');
  }
  return out.filter(Boolean);
}
