import { isProductId, type EchoRef } from '../core';
import { dispatch } from '../store';

const OWN = 'reclaim:echo-own';

async function withTimeout(input: string, init: RequestInit = {}, ms = 1500): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Sends what this player left behind (Requirement 24.1). Silent on failure. */
export async function sendEcho(echo: EchoRef): Promise<void> {
  try {
    const res = await withTimeout('/api/echo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ product: echo.product, condition: echo.condition }),
    });
    if (!res.ok) return;
    const body = (await res.json()) as { id?: unknown };
    if (typeof body.id === 'number') localStorage.setItem(OWN, String(body.id));
  } catch {
    // The local echo in the story state is the fallback (Requirement 24.3).
  }
}

/** Loads the newest echo left by someone else and puts it in the hero (Requirement 24.2). */
export async function loadEcho(): Promise<void> {
  try {
    const res = await withTimeout('/api/echo');
    if (!res.ok) return;
    const rows = (await res.json()) as { id: number; product: string; condition: string }[];
    const own = Number(localStorage.getItem(OWN) ?? NaN);
    const pick = Array.isArray(rows) ? rows.find((r) => r.id !== own && isProductId(r.product)) : undefined;
    if (pick && isProductId(pick.product)) {
      dispatch({ type: 'ECHO_LOADED', echo: { product: pick.product, condition: pick.condition === 'haunted' ? 'haunted' : 'taken' } });
    }
  } catch {
    // Keep whatever echo the device already has, or none.
  }
}
