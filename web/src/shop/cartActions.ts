import type { ProductId } from '../core/ids';
import { productById } from '../products/catalog';
import { dispatch, useStory, useUi } from '../store';
import { cartCount } from './query';

/** Adds to the cart and announces it (Requirement 6.1). */
export function addToCart(id: ProductId, qty = 1) {
  dispatch({ type: 'ADD_TO_CART', id, qty });
  const { story } = useStory.getState();
  const haunted = story.phase !== 'day' && story.phase !== 'catching';
  const p = productById(id);
  const name = haunted ? p.haunted.name : p.day.name;
  const n = cartCount(story.cart);
  useUi.getState().announce(`Added ${qty} × ${name} to your cart. ${n} ${n === 1 ? 'item' : 'items'} in cart.`);
}
