import { useEffect } from 'react';
import { useUi } from '../store';
import { CartIcon, CloseIcon } from './icons';
import { ObjectBox } from './ObjectBox';
import { isProductId } from '../core/ids';

/** Visible confirmation after Add to cart, or a "greedy" refusal (Requirement 6.1). */
export function CartToast() {
  const toast = useUi((s) => s.toast);
  const hide = useUi((s) => s.hideToast);
  const openCart = useUi((s) => s.setCartOpen);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(hide, toast.kind === 'greedy' ? 4200 : 3200);
    return () => clearTimeout(t);
  }, [toast, hide]);

  if (!toast) return null;
  return (
    <div key={toast.id} className={`cart-toast cart-toast-${toast.kind}`} data-testid={`toast-${toast.kind}`} aria-hidden="true">
      {toast.product && isProductId(toast.product) ? <ObjectBox id={toast.product} size="thumb" /> : <span className="cart-toast-mark">!</span>}
      <div className="cart-toast-text">
        <p className="cart-toast-title">{toast.title}</p>
        <p className="cart-toast-body">{toast.body}</p>
      </div>
      {toast.kind === 'added' && (
        <button
          type="button"
          className="btn btn-primary cart-toast-view"
          tabIndex={-1}
          onClick={() => {
            hide();
            openCart(true);
          }}
        >
          <CartIcon size={16} /> View cart
        </button>
      )}
      <button type="button" className="icon-button" tabIndex={-1} aria-label="Dismiss" onClick={hide}>
        <CloseIcon size={16} />
      </button>
    </div>
  );
}
