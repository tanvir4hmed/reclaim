import { CONSEQUENCE_IDS, isFeatured, isProductId, type ProductId } from './ids';
import { isValidPayment } from './payment';
import type { Act, Cart, Cue, EchoRef, StepResult, StoryEvent, StoryState } from './types';

export const MAX_QTY = 9;
export const MAX_MARKS = 300;

export function initialState(echo: EchoRef | null = null, settings?: StoryState['settings']): StoryState {
  return {
    version: 1,
    phase: 'day',
    act: 0,
    cart: {},
    carted: [],
    taken: [],
    played: {},
    closingPlayed: false,
    checkout: { payment: null, agreed: false, giftWrap: true },
    marks: [],
    clockDirection: 1,
    extras: [],
    leftBehind: null,
    echo,
    settings: settings ?? { motion: 'system', sound: false },
  };
}

export function weightOf(state: StoryState): number {
  return state.taken.length;
}

export function isHauntedPhase(phase: StoryState['phase']): boolean {
  return phase === 'haunted' || phase === 'closing' || phase === 'checkout';
}

/** The act a state would be in on its own; the stored act never goes below its previous value. */
export function deriveAct(state: StoryState): Act {
  switch (state.phase) {
    case 'day':
    case 'catching':
      return 0;
    case 'accepted':
      return 4;
    case 'closing':
    case 'checkout':
      return 3;
    case 'haunted': {
      const w = weightOf(state);
      if (w >= 5 || state.closingPlayed) return 3;
      if (w >= 2) return 2;
      return 1;
    }
  }
}

function clampQty(qty: number): number {
  if (!Number.isFinite(qty)) return 0;
  return Math.max(0, Math.min(MAX_QTY, Math.trunc(qty)));
}

function withQty(cart: Cart, id: ProductId, qty: number): Cart {
  const next: Cart = { ...cart };
  if (qty <= 0) delete next[id];
  else next[id] = qty;
  return next;
}

function touchCarted(carted: ProductId[], id: ProductId): ProductId[] {
  return [...carted.filter((x) => x !== id), id];
}

/** Bookkeeping shared by every "the visitor took more of this" path in the Haunted state. */
function takeInHaunted(state: StoryState, id: ProductId, cues: Cue[]): StoryState {
  let next = state;
  if (!next.taken.includes(id)) next = { ...next, taken: [...next.taken, id] };
  if (CONSEQUENCE_IDS.has(id)) {
    if (next.played[id]) {
      cues.push({ type: 'reminder', id });
    } else {
      cues.push({ type: 'consequence', id });
      next = { ...next, played: { ...next.played, [id]: true } };
      if (id === 'pocket-watch') next = { ...next, clockDirection: -1 };
    }
  }
  return next;
}

function chooseLeftBehind(state: StoryState): EchoRef | null {
  const inCart = state.carted.filter((id) => (state.cart[id] ?? 0) > 0);
  const featured = [...inCart].reverse().find((id) => isFeatured(id));
  const pick = featured ?? inCart[inCart.length - 1];
  return pick ? { product: pick, condition: 'taken' } : null;
}

function cartIsEmpty(cart: Cart): boolean {
  return Object.values(cart).every((q) => !q);
}

function applyEvent(state: StoryState, event: StoryEvent, cues: Cue[]): StoryState {
  switch (event.type) {
    case 'BAT_CAUGHT':
      if (state.phase !== 'day') return state;
      cues.push({ type: 'reveal' });
      return { ...state, phase: 'catching' };

    case 'REVEAL_DONE':
      if (state.phase !== 'catching') return state;
      return { ...state, phase: 'haunted' };

    case 'ADD_TO_CART': {
      if (state.phase !== 'day' && state.phase !== 'haunted') return state;
      const add = clampQty(event.qty ?? 1);
      if (add <= 0) return state;
      const current = state.cart[event.id] ?? 0;
      const qty = clampQty(current + add);
      if (qty === current) return state;
      let next: StoryState = {
        ...state,
        cart: withQty(state.cart, event.id, qty),
        carted: touchCarted(state.carted, event.id),
      };
      if (state.phase === 'haunted') next = takeInHaunted(next, event.id, cues);
      return next;
    }

    case 'SET_QTY': {
      if (state.phase !== 'day' && state.phase !== 'haunted') return state;
      const current = state.cart[event.id] ?? 0;
      const qty = clampQty(event.qty);
      if (qty === current) return state;
      let next: StoryState = { ...state, cart: withQty(state.cart, event.id, qty) };
      if (qty > current) {
        next = { ...next, carted: touchCarted(next.carted, event.id) };
        if (state.phase === 'haunted') next = takeInHaunted(next, event.id, cues);
      }
      return next;
    }

    case 'REMOVE':
      if (state.phase !== 'day' && state.phase !== 'haunted') return state;
      if (!(event.id in state.cart)) return state;
      // Requirement 37.4: what was taken stays taken. Only the cart changes.
      return { ...state, cart: withQty(state.cart, event.id, 0) };

    case 'SNEAK_INTO_CART': {
      if (state.phase !== 'haunted' || (state.cart[event.id] ?? 0) > 0) return state;
      return { ...state, cart: withQty(state.cart, event.id, 1) };
    }

    case 'CATALOG_EXTRA':
      if (!isHauntedPhase(state.phase) || state.extras.includes(event.id)) return state;
      return { ...state, extras: [...state.extras, event.id] };

    case 'OPEN_CHECKOUT':
      if (state.phase !== 'haunted' || cartIsEmpty(state.cart)) return state;
      if (!state.closingPlayed) {
        cues.push({ type: 'closing' });
        return { ...state, phase: 'closing' };
      }
      return { ...state, phase: 'checkout' };

    case 'CLOSING_DONE':
      if (state.phase !== 'closing') return state;
      return { ...state, phase: 'checkout', closingPlayed: true };

    case 'SET_PAYMENT':
      if (state.phase !== 'checkout') return state;
      if (event.payment !== null && !isValidPayment(event.payment)) return state;
      return { ...state, checkout: { ...state.checkout, payment: event.payment } };

    case 'SET_AGREEMENT':
      if (state.phase !== 'checkout') return state;
      return { ...state, checkout: { ...state.checkout, agreed: event.agreed } };

    case 'SET_GIFT_WRAP':
      return { ...state, checkout: { ...state.checkout, giftWrap: event.on } };

    case 'DECLINE':
      if (state.phase !== 'checkout') return state;
      return { ...state, phase: 'haunted', checkout: { ...state.checkout, agreed: false } };

    case 'ACCEPT': {
      if (state.phase !== 'checkout') return state;
      if (!state.checkout.agreed || !isValidPayment(state.checkout.payment)) return state;
      if (cartIsEmpty(state.cart)) return state;
      cues.push({ type: 'accepted' });
      return { ...state, phase: 'accepted', leftBehind: chooseLeftBehind(state) };
    }

    case 'RETURN_DONE':
      if (state.phase !== 'accepted') return state;
      cues.push({ type: 'returned' });
      return initialState(state.leftBehind ?? state.echo, state.settings);

    case 'MARK_ADDED': {
      if (state.phase === 'day' || state.phase === 'accepted') return state;
      if (state.marks.some((m) => m.id === event.mark.id)) return state;
      const marks = [...state.marks, event.mark];
      return { ...state, marks: marks.length > MAX_MARKS ? marks.slice(-MAX_MARKS) : marks };
    }

    case 'ECHO_LOADED':
      if (event.echo !== null && !isProductId(event.echo.product)) return state;
      return { ...state, echo: event.echo };

    case 'SETTINGS':
      return { ...state, settings: { ...state.settings, ...event.settings } };
  }
}

/** Pure transition: the new state plus the cues the Director should play. */
export function step(state: StoryState, event: StoryEvent): StepResult {
  const cues: Cue[] = [];
  let next = applyEvent(state, event, cues);
  if (next !== state && next.phase !== 'day') {
    const derived = deriveAct(next);
    const act = (next.phase === 'accepted' ? 4 : Math.max(state.act, derived)) as Act;
    if (act !== next.act) {
      next = { ...next, act };
      if (act !== state.act && act >= 2 && act <= 3) cues.push({ type: 'act', act });
    }
  }
  return { state: next, cues };
}

export function reduce(state: StoryState, event: StoryEvent): StoryState {
  return step(state, event).state;
}
