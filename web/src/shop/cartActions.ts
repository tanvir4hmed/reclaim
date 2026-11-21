import { MAX_QTY } from '../core';
import type { ProductId } from '../core/ids';
import { productById } from '../products/catalog';
import { dispatch, useStory, useUi } from '../store';
import { cartCount } from './query';

function isHaunted(): boolean {
  const p = useStory.getState().story.phase;
  return p !== 'day' && p !== 'catching';
}

/**
 * How many of a product can be in the cart. By day: the stock badge, if any. After the Reveal
 * every object belonged to one person, so there is only one of each.
 */
export function limitFor(id: ProductId, haunted = isHaunted()): number {
  if (haunted) return 1;
  return productById(id).day.stock ?? MAX_QTY;
}

const DAY_GREEDY = [
  'That’s every one we have. Santa’s list just got a little longer.',
  'Only so many to go around. Leave one for someone else?',
];
const HAUNTED_GREEDY = [
  'You’re so greedy. There was only ever one.',
  'You already have it. It already has you.',
  'Greedy. They only owned one.',
];

function greedy(name: string, haunted: boolean) {
  const lines = haunted ? HAUNTED_GREEDY : DAY_GREEDY;
  const body = lines[Math.floor(Math.random() * lines.length)] ?? lines[0] ?? '';
  useUi.getState().showToast({
    kind: 'greedy',
    title: haunted ? 'No more.' : `Sold out: ${name}`,
    body,
    product: null,
  });
  useUi.getState().announce(`${haunted ? 'No more.' : 'No more in stock.'} ${body}`);
}

/**
 * Adds to the cart within the stock limit, then confirms it with a toast and the live region
 * (Requirement 6.1). Asking for more than exists gets a "greedy" message instead.
 */
export function addToCart(id: ProductId, qty = 1) {
  const haunted = isHaunted();
  const p = productById(id);
  const name = haunted ? p.haunted.name : p.day.name;
  const have = useStory.getState().story.cart[id] ?? 0;
  const room = Math.max(0, limitFor(id, haunted) - have);
  if (room === 0) return greedy(name, haunted);
  const add = Math.min(qty, room);
  dispatch({ type: 'ADD_TO_CART', id, qty: add });
  const n = cartCount(useStory.getState().story.cart);
  useUi.getState().showToast({
    kind: 'added',
    title: haunted ? 'It’s yours now.' : 'Added to your cart',
    body: `${add} × ${name}`,
    product: id,
  });
  useUi.getState().announce(`Added ${add} × ${name} to your cart. ${n} ${n === 1 ? 'item' : 'items'} in cart.`);
  if (add < qty) setTimeout(() => greedy(name, haunted), 1600);
}

/** Changes a cart line's quantity, refusing to go past the limit. */
export function setCartQty(id: ProductId, qty: number) {
  const haunted = isHaunted();
  if (qty > limitFor(id, haunted)) {
    const p = productById(id);
    return greedy(haunted ? p.haunted.name : p.day.name, haunted);
  }
  dispatch({ type: 'SET_QTY', id, qty });
}
