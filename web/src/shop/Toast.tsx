import { useEffect } from 'react';
import { useStory, useUi } from '../store';
import type { ProductId } from '../core/ids';

/**
 * The line under a product's Add button (Requirement 6.1). Right after a press it confirms the
 * add, or refuses a "greedy" request past the stock; otherwise, if the product is already in
 * the cart, it quietly says so. No popups: the cart badge already counts items.
 * The live region announces the same text, so this line is hidden from screen readers.
 */
export function CartNoteLine({ id, haunted }: { id: ProductId; haunted: boolean }) {
  const note = useUi((s) => (s.note?.product === id ? s.note : null));
  const hide = useUi((s) => s.hideNote);
  const inCart = useStory((s) => s.story.cart[id] ?? 0);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(hide, note.kind === 'greedy' ? 5000 : 4500);
    return () => clearTimeout(t);
  }, [note, hide]);

  if (note) {
    return (
      <p key={note.id} className={`cart-note cart-note-${note.kind}`} data-testid={`note-${note.kind}`} aria-hidden="true">
        {note.kind === 'added' ? '✓ ' : ''}
        {note.text}
      </p>
    );
  }
  if (inCart > 0) {
    return (
      <p className="cart-note cart-note-have" data-testid="note-have" aria-hidden="true">
        {haunted ? 'You already have it.' : `You have ${inCart} in your cart.`}
      </p>
    );
  }
  return null;
}
