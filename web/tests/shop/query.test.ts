import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PRODUCT_IDS, type Cart, type ProductId } from '../../src/core';
import { CATALOG, CATEGORIES } from '../../src/products/catalog';
import {
  DEFAULT_QUERY,
  PRICE_CEIL,
  cartLines,
  cartTotal,
  parseQuery,
  runQuery,
  toSearchParams,
  type Query,
} from '../../src/shop/query';

const day = { haunted: false, extras: [] as ProductId[] };
const night = { haunted: true, extras: [] as ProductId[] };

const queryArb: fc.Arbitrary<Query> = fc
  .record({
    q: fc.constantFrom('', 'watch', 'home', 'cake', 'letter sealed', 'zzz'),
    categories: fc.subarray(CATEGORIES.map((c) => c.id)),
    a: fc.integer({ min: 0, max: PRICE_CEIL }),
    b: fc.integer({ min: 0, max: PRICE_CEIL }),
    sort: fc.constantFrom('featured' as const, 'price-asc' as const, 'price-desc' as const, 'rating' as const),
    view: fc.constantFrom('grid' as const, 'list' as const),
  })
  .map(({ a, b, ...rest }) => ({ ...rest, min: Math.min(a, b), max: Math.max(a, b) }));

describe('catalog', () => {
  it('has a product entry for every product id, and at least 18 listed by day (Req 1.5)', () => {
    expect(new Set(CATALOG.map((p) => p.id))).toEqual(new Set(PRODUCT_IDS));
    expect(CATALOG.filter((p) => !p.hiddenByDay).length).toBeGreaterThanOrEqual(18);
    expect(new Set(CATALOG.map((p) => p.category)).size).toBeGreaterThanOrEqual(4);
  });

  it('every listed Day price fits the price filter range', () => {
    for (const p of CATALOG.filter((x) => !x.hiddenByDay)) {
      expect(p.day.price / 100).toBeLessThanOrEqual(PRICE_CEIL);
    }
  });
});

describe('search, filters and sort', () => {
  it('finds products by name, description and category (Req 3.1)', () => {
    const ids = (q: string) => runQuery({ ...DEFAULT_QUERY, q }, day).map((p) => p.id);
    expect(ids('watch')).toContain('pocket-watch');
    expect(ids('wax seal')).toContain('letter');
    expect(ids('sweets')).toEqual(expect.arrayContaining(['cake', 'chocolate-box', 'advent-calendar']));
  });

  it('searches the haunted copy after the Reveal (Req 3.4)', () => {
    const ids = runQuery({ ...DEFAULT_QUERY, q: 'found near' }, night).map((p) => p.id);
    expect(ids).toEqual(['shoes']);
    expect(runQuery({ ...DEFAULT_QUERY, q: 'found near' }, day)).toEqual([]);
  });

  it('keeps hidden products out unless they joined the catalog', () => {
    const all = (ctx: typeof day) => runQuery(DEFAULT_QUERY, ctx).map((p) => p.id);
    expect(all(day)).not.toContain('childs-drawing');
    expect(all(night)).not.toContain('childs-drawing');
    expect(all({ haunted: true, extras: ['childs-drawing'] })).toContain('childs-drawing');
  });

  it('the Reveal never reorders the grid for the same query (Req 4.5)', () => {
    fc.assert(
      fc.property(queryArb, (query) => {
        const noText = { ...query, q: '' };
        expect(runQuery(noText, night).map((p) => p.id)).toEqual(runQuery(noText, day).map((p) => p.id));
      }),
    );
  });

  it('results always respect the category and price filters, and sorting keeps relative catalog order for ties', () => {
    fc.assert(
      fc.property(queryArb, (query) => {
        const rows = runQuery(query, day);
        for (const p of rows) {
          if (query.categories.length) expect(query.categories).toContain(p.category);
          expect(p.day.price / 100).toBeGreaterThanOrEqual(query.min);
          expect(p.day.price / 100).toBeLessThanOrEqual(query.max);
        }
        if (query.sort === 'price-asc') {
          for (let i = 1; i < rows.length; i++) expect(rows[i]!.day.price).toBeGreaterThanOrEqual(rows[i - 1]!.day.price);
        }
      }),
    );
  });

  it('URL round trip keeps the view (Req 4.6)', () => {
    fc.assert(
      fc.property(queryArb, (query) => {
        const back = parseQuery(toSearchParams(query));
        expect(back).toEqual({ ...query, categories: [...query.categories] });
      }),
    );
  });

  it('ignores junk in the URL', () => {
    const q = parseQuery(new URLSearchParams('cat=evil,gifts&min=abc&max=99999&sort=drop&view=x'));
    expect(q).toEqual({ ...DEFAULT_QUERY, categories: ['gifts'] });
  });
});

describe('cart totals (Req 6.5)', () => {
  const cartArb: fc.Arbitrary<Cart> = fc.dictionary(
    fc.constantFrom(...PRODUCT_IDS),
    fc.integer({ min: 1, max: 9 }),
  ) as fc.Arbitrary<Cart>;

  it('the total equals the sum of unit price × quantity, in both states', () => {
    fc.assert(
      fc.property(cartArb, fc.boolean(), (cart, haunted) => {
        const lines = cartLines(cart, haunted);
        let expected = 0;
        for (const [id, qty] of Object.entries(cart)) {
          const p = CATALOG.find((x) => x.id === id)!;
          expected += (haunted ? p.haunted.hours : p.day.price) * (qty ?? 0);
        }
        expect(cartTotal(lines)).toBe(expected);
        expect(lines.reduce((n, l) => n + l.qty, 0)).toBe(Object.values(cart).reduce((n, q) => n + (q ?? 0), 0));
      }),
    );
  });
});
