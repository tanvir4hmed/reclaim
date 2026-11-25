import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { afterEach, describe, expect, it } from 'vitest';
import { CONDITIONS, PRODUCTS } from './allowlist.js';
import { buildApp } from './app.js';
import { EchoStore, KEEP } from './store.js';

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
async function make(writesPerMinute = 1000) {
  const app = await buildApp({ dbPath: ':memory:', writesPerMinute });
  apps.push(app);
  return app;
}
afterEach(async () => {
  while (apps.length) await apps.pop()?.close();
});

describe('Echo service', () => {
  it('answers the health check', async () => {
    const app = await make();
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('stores an echo and returns the newest first, with no identifiers (Req 24.1, 24.4)', async () => {
    const app = await make();
    await app.inject({ method: 'POST', url: '/api/echo', payload: { product: 'letter', condition: 'taken' } });
    const r = await app.inject({ method: 'POST', url: '/api/echo', payload: { product: 'shoes', condition: 'taken' } });
    expect(r.statusCode).toBe(201);
    const rows = (await app.inject({ method: 'GET', url: '/api/echo' })).json();
    expect(rows[0]).toEqual({ id: r.json().id, product: 'shoes', condition: 'taken' });
    expect(Object.keys(rows[0]).sort()).toEqual(['condition', 'id', 'product']);
  });

  it('rejects anything outside the allowlists (Req 24.4, 24.5)', async () => {
    const app = await make();
    const product = fc.string({ maxLength: 40 }).filter((s) => !(PRODUCTS as readonly string[]).includes(s));
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.record({ product, condition: fc.constantFrom(...CONDITIONS) }),
          fc.record({ product: fc.constantFrom(...PRODUCTS), condition: fc.string({ maxLength: 10 }).filter((s) => !(CONDITIONS as readonly string[]).includes(s)) }),
          fc.record({ product: fc.constantFrom(...PRODUCTS), condition: fc.constantFrom(...CONDITIONS), extra: fc.string() }),
          fc.anything(),
        ),
        async (body) => {
          const res = await app.inject({ method: 'POST', url: '/api/echo', payload: body as object });
          expect(res.statusCode).toBeGreaterThanOrEqual(400);
          expect(res.statusCode).toBeLessThan(500);
        },
      ),
      { numRuns: 120 },
    );
    expect((await app.inject({ method: 'GET', url: '/api/echo' })).json()).toEqual([]);
  });

  it('rejects oversized bodies', async () => {
    const app = await make();
    const res = await app.inject({
      method: 'POST',
      url: '/api/echo',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ product: 'letter', condition: 'taken', pad: 'x'.repeat(2000) }),
    });
    expect(res.statusCode).toBe(413);
  });

  it('rate-limits writes (Req 24.5)', async () => {
    const app = await make(3);
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) {
      codes.push((await app.inject({ method: 'POST', url: '/api/echo', payload: { product: 'candle', condition: 'taken' } })).statusCode);
    }
    expect(codes).toEqual([201, 201, 201, 429, 429]);
  });

  it('keeps only the newest rows', () => {
    const store = new EchoStore(':memory:');
    for (let i = 0; i < KEEP + 25; i++) store.add('candle', 'taken', i);
    expect(store.count()).toBe(KEEP);
    expect(store.latest(1)[0]?.product).toBe('candle');
    store.close();
  });

  it('accepts exactly the product ids the Shop knows', () => {
    const web = readFileSync(new URL('../../web/src/core/ids.ts', import.meta.url), 'utf8');
    for (const id of PRODUCTS) expect(web).toContain(`'${id}'`);
  });
});
