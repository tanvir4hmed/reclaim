import { useNavigate } from 'react-router';
import { dispatch, useHaunted, useStory, useUi } from '../store';
import { Dialog } from './Dialog';
import { totalLabel } from './format';
import { CartIcon, CloseIcon, TrashIcon } from './icons';
import { ObjectBox } from './ObjectBox';
import { cartLines, cartTotal } from './query';
import { Stepper } from './Stepper';
import { CallPanel } from '../fx/CallPanel';

export function CartDrawer() {
  const haunted = useHaunted();
  const open = useUi((s) => s.cartOpen);
  const setOpen = useUi((s) => s.setCartOpen);
  const announce = useUi((s) => s.announce);
  const cart = useStory((s) => s.story.cart);
  const navigate = useNavigate();
  const lines = cartLines(cart, haunted);
  const total = cartTotal(lines);

  function checkout() {
    setOpen(false);
    if (haunted) dispatch({ type: 'OPEN_CHECKOUT' });
    navigate('/checkout');
  }

  return (
    <Dialog open={open} onClose={() => setOpen(false)} labelledBy="cart-title" className="sheet sheet-right cart" testId="cart-drawer">
      <div className="sheet-head">
        <h2 id="cart-title" className="sheet-title">
          <CartIcon /> {haunted ? 'What you are carrying' : 'Your cart'}
        </h2>
        <button type="button" className="icon-button" aria-label="Close cart" onClick={() => setOpen(false)}>
          <CloseIcon />
        </button>
      </div>
      <CallPanel />
      {lines.length === 0 ? (
        <p className="empty">{haunted ? 'Your hands are empty. For now.' : 'Your cart is empty.'}</p>
      ) : (
        <>
          <ul className="cart-lines">
            {lines.map(({ product: p, qty }) => {
              const name = haunted ? p.haunted.name : p.day.name;
              return (
                <li key={p.id} className="cart-line" data-testid={`line-${p.id}`}>
                  <ObjectBox id={p.id} size="thumb" />
                  <div className="cart-line-info">
                    <p className="cart-line-name">{name}</p>
                    <p className="cart-line-price">{haunted ? p.haunted.price : totalLabel(p.day.price, false)}</p>
                    <Stepper value={qty} onChange={(n) => dispatch({ type: 'SET_QTY', id: p.id, qty: n })} label={`Quantity for ${name}`} />
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove ${name}`}
                    onClick={() => {
                      dispatch({ type: 'REMOVE', id: p.id });
                      announce(`${name} removed from your cart.`);
                    }}
                  >
                    <TrashIcon />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="cart-foot">
            <p className="cart-total">
              <span>{haunted ? 'It will cost you' : 'Subtotal'}</span>
              <strong data-testid="cart-total">{totalLabel(total, haunted)}</strong>
            </p>
            <button type="button" className="btn btn-primary btn-block" data-testid="checkout" onClick={checkout}>
              {haunted ? 'Pay for it' : 'Checkout'}
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}
