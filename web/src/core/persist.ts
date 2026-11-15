import { isProductId, type ProductId } from './ids';
import { isValidPayment } from './payment';
import { MAX_MARKS, MAX_QTY, initialState } from './reducer';
import type {
  Act,
  Cart,
  EchoRef,
  LastingMark,
  MotionSetting,
  Payment,
  PaymentKind,
  Phase,
  Settings,
  StoryState,
} from './types';

const PAYMENT_KINDS: readonly PaymentKind[] = ['time', 'age', 'memory'];

export const STORAGE_KEY = 'reclaim:v1';

/** The subset of the Web Storage API we use, so tests can pass a fake. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const PHASES: readonly Phase[] = ['day', 'catching', 'haunted', 'closing', 'checkout', 'accepted'];
const MOTION: readonly MotionSetting[] = ['system', 'reduced', 'full'];

type Json = Record<string, unknown>;

function isObject(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function ids(v: unknown): ProductId[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter(isProductId))];
}

function cart(v: unknown): Cart {
  const out: Cart = {};
  if (!isObject(v)) return out;
  for (const [k, q] of Object.entries(v)) {
    if (isProductId(k) && Number.isInteger(q) && (q as number) > 0) {
      out[k] = Math.min(MAX_QTY, q as number);
    }
  }
  return out;
}

function echo(v: unknown): EchoRef | null {
  if (!isObject(v) || !isProductId(v.product)) return null;
  return { product: v.product, condition: v.condition === 'haunted' ? 'haunted' : 'taken' };
}

function marks(v: unknown): LastingMark[] {
  if (!Array.isArray(v)) return [];
  const out: LastingMark[] = [];
  for (const m of v) {
    if (!isObject(m) || typeof m.id !== 'string' || typeof m.kind !== 'string') continue;
    const nums = [m.x, m.y, m.rotation, m.scale];
    if (!nums.every((n) => typeof n === 'number' && Number.isFinite(n))) continue;
    out.push({
      id: m.id,
      kind: m.kind,
      x: m.x as number,
      y: m.y as number,
      rotation: m.rotation as number,
      scale: m.scale as number,
      product: isProductId(m.product) ? m.product : null,
    });
  }
  return out.slice(-MAX_MARKS);
}

function settings(v: unknown): Settings {
  const base: Settings = { motion: 'system', sound: false };
  if (!isObject(v)) return base;
  return {
    motion: MOTION.includes(v.motion as MotionSetting) ? (v.motion as MotionSetting) : base.motion,
    sound: v.sound === true,
  };
}

/**
 * Rebuilds a StoryState from untrusted JSON. Anything unknown or malformed is
 * dropped; a wrong version or phase starts fresh (keeping settings and echo).
 */
export function sanitize(raw: unknown): StoryState | null {
  if (!isObject(raw) || raw.version !== 1) return null;
  if (!PHASES.includes(raw.phase as Phase)) return null;
  const phase = raw.phase as Phase;
  const act = [0, 1, 2, 3, 4].includes(raw.act as number) ? (raw.act as Act) : 0;

  const checkout = isObject(raw.checkout) ? raw.checkout : {};
  const rawPayment = isObject(checkout.payment) ? checkout.payment : null;
  const payment: Payment | null =
    rawPayment && PAYMENT_KINDS.includes(rawPayment.kind as PaymentKind) && typeof rawPayment.option === 'string'
      ? { kind: rawPayment.kind as PaymentKind, option: rawPayment.option }
      : null;
  const played: StoryState['played'] = {};
  if (isObject(raw.played)) {
    for (const [k, val] of Object.entries(raw.played)) if (isProductId(k) && val === true) played[k] = true;
  }

  const state: StoryState = {
    ...initialState(echo(raw.echo), settings(raw.settings)),
    // A reload mid-sequence resumes at a stable point (Requirement 10.5).
    phase: phase === 'catching' ? 'haunted' : phase === 'closing' ? 'checkout' : phase,
    act,
    cart: cart(raw.cart),
    carted: ids(raw.carted),
    taken: ids(raw.taken),
    played,
    closingPlayed: raw.closingPlayed === true || phase === 'closing',
    checkout: {
      payment: isValidPayment(payment) ? payment : null,
      agreed: checkout.agreed === true,
      giftWrap: checkout.giftWrap !== false,
    },
    marks: marks(raw.marks),
    clockDirection: raw.clockDirection === -1 ? -1 : 1,
    extras: ids(raw.extras),
    leftBehind: echo(raw.leftBehind),
  };
  return state;
}

export function load(store: KeyValueStore): StoryState {
  try {
    const text = store.getItem(STORAGE_KEY);
    if (!text) return initialState();
    return sanitize(JSON.parse(text)) ?? initialState();
  } catch {
    return initialState();
  }
}

export function save(store: KeyValueStore, state: StoryState): void {
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked (private mode): the Shop keeps working in memory.
  }
}
