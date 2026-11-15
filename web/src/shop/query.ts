import type { ProductId } from '../core/ids';
import type { Cart } from '../core/types';
import { CATALOG, CATEGORIES, productById, type CategoryId, type ProductMeta } from '../products/catalog';

export type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'rating';
export type ViewMode = 'grid' | 'list';

export interface Query {
  q: string;
  categories: CategoryId[];
  /** Price bounds in whole dollars of the Day list price. */
  min: number;
  max: number;
  sort: SortKey;
  view: ViewMode;
}

export const PRICE_FLOOR = 0;
export const PRICE_CEIL = 250;

export const DEFAULT_QUERY: Query = {
  q: '',
  categories: [],
  min: PRICE_FLOOR,
  max: PRICE_CEIL,
  sort: 'featured',
  view: 'grid',
};

const SORTS: readonly SortKey[] = ['featured', 'price-asc', 'price-desc', 'rating'];
const CATEGORY_IDS = new Set<string>(CATEGORIES.map((c) => c.id));

function clampInt(raw: string | null, lo: number, hi: number, fallback: number): number {
  if (raw === null || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

/** Reads the shop view from the URL (Requirement 4.6). Unknown values fall back to defaults. */
export function parseQuery(params: URLSearchParams): Query {
  const sort = params.get('sort');
  const view = params.get('view');
  let min = clampInt(params.get('min'), PRICE_FLOOR, PRICE_CEIL, DEFAULT_QUERY.min);
  let max = clampInt(params.get('max'), PRICE_FLOOR, PRICE_CEIL, DEFAULT_QUERY.max);
  if (min > max) [min, max] = [max, min];
  return {
    q: (params.get('q') ?? '').slice(0, 80),
    categories: (params.get('cat') ?? '')
      .split(',')
      .filter((c): c is CategoryId => CATEGORY_IDS.has(c)),
    min,
    max,
    sort: SORTS.includes(sort as SortKey) ? (sort as SortKey) : DEFAULT_QUERY.sort,
    view: view === 'list' ? 'list' : 'grid',
  };
}

/** Writes only non-default values so shared URLs stay short. */
export function toSearchParams(query: Query): URLSearchParams {
  const p = new URLSearchParams();
  if (query.q) p.set('q', query.q);
  if (query.categories.length) p.set('cat', query.categories.join(','));
  if (query.min !== DEFAULT_QUERY.min) p.set('min', String(query.min));
  if (query.max !== DEFAULT_QUERY.max) p.set('max', String(query.max));
  if (query.sort !== DEFAULT_QUERY.sort) p.set('sort', query.sort);
  if (query.view !== DEFAULT_QUERY.view) p.set('view', query.view);
  return p;
}

function normalize(text: string): string {
  return text.toLocaleLowerCase('en').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

export interface QueryContext {
  haunted: boolean;
  /** Products that joined the catalog during the run (haunted search). */
  extras: readonly ProductId[];
}

export function isListed(p: ProductMeta, ctx: QueryContext): boolean {
  return !p.hiddenByDay || (ctx.haunted && ctx.extras.includes(p.id));
}

/**
 * Filters and sorts the catalog. Sorting by price always uses the Day list price, so the
 * grid order does not change at the Reveal (Requirement 4.5). Ties keep catalog order.
 */
export function runQuery(query: Query, ctx: QueryContext): ProductMeta[] {
  const terms = normalize(query.q).split(/\s+/).filter(Boolean);
  const rows = CATALOG.map((p, index) => ({ p, index })).filter(({ p }) => {
    if (!isListed(p, ctx)) return false;
    if (query.categories.length && !query.categories.includes(p.category)) return false;
    const dollars = p.day.price / 100;
    if (dollars < query.min || dollars > query.max) return false;
    if (!terms.length) return true;
    const cat = CATEGORIES.find((c) => c.id === p.category);
    const copy = ctx.haunted ? p.haunted : p.day;
    const hay = normalize([copy.name, copy.blurb, ctx.haunted ? cat?.haunted : cat?.day].join(' '));
    return terms.every((t) => hay.includes(t));
  });
  const cmp: Record<SortKey, (a: (typeof rows)[number], b: (typeof rows)[number]) => number> = {
    featured: (a, b) => a.index - b.index,
    'price-asc': (a, b) => a.p.day.price - b.p.day.price || a.index - b.index,
    'price-desc': (a, b) => b.p.day.price - a.p.day.price || a.index - b.index,
    rating: (a, b) => b.p.rating - a.p.rating || b.p.reviews - a.p.reviews || a.index - b.index,
  };
  return rows.sort(cmp[query.sort]).map((r) => r.p);
}

export const GIFT_WRAP_CENTS = 499;

export interface CartLine {
  product: ProductMeta;
  qty: number;
  /** Unit price in the current state's terms: cents by day, hours after the Reveal. */
  unit: number;
  total: number;
}

export function cartLines(cart: Cart, haunted: boolean): CartLine[] {
  const lines: CartLine[] = [];
  for (const p of CATALOG) {
    const qty = cart[p.id] ?? 0;
    if (qty <= 0) continue;
    const unit = haunted ? p.haunted.hours : p.day.price;
    lines.push({ product: p, qty, unit, total: unit * qty });
  }
  return lines;
}

export function cartTotal(lines: readonly CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.total, 0);
}

export function cartCount(cart: Cart): number {
  return Object.values(cart).reduce<number>((n, q) => n + (q ?? 0), 0);
}

export { productById };
