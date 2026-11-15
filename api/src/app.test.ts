import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

describe('Echo service', () => {
  it('answers the health check', async () => {
    const app = await buildApp({ dbPath: ':memory:' });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    await app.close();
  });
});
