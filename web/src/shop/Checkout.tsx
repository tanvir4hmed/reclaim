import { Link, useNavigate } from 'react-router';
import { PAYMENT_OPTIONS, isValidPayment, type PaymentKind } from '../core';
import { dispatch, useHaunted, useStory } from '../store';
import { money, totalLabel } from './format';
import { GIFT_WRAP_CENTS, cartLines, cartTotal } from './query';

const KIND_LABEL: Record<PaymentKind, string> = { time: 'Pay with time', age: 'Pay with age', memory: 'Pay with a memory' };

const OPTION_LABEL: Record<string, string> = {
  'one-hour-every-night': 'One hour, every night, for the rest of your life',
  'every-christmas-morning': 'Every Christmas morning from now on',
  'the-last-minute-of-each-year': 'The last minute of each year',
  'one-year': 'One year',
  'seven-years': 'Seven years',
  'the-age-you-were-happiest': 'The age you were happiest',
  'your-first-snow': 'Your first snow',
  'a-voice-you-no-longer-hear': 'A voice you no longer hear',
  'the-way-home': 'The way home',
};

function Summary({ haunted }: { haunted: boolean }) {
  const cart = useStory((s) => s.story.cart);
  const giftWrap = useStory((s) => s.story.checkout.giftWrap);
  const lines = cartLines(cart, haunted);
  const total = cartTotal(lines) + (!haunted && giftWrap ? GIFT_WRAP_CENTS : 0);
  return (
    <section className="checkout-card" aria-labelledby="sum-title">
      <h2 id="sum-title">{haunted ? 'What you are taking' : 'Order summary'}</h2>
      <ul className="summary-lines">
        {lines.map((l) => (
          <li key={l.product.id}>
            <span>
              {l.qty} × {haunted ? l.product.haunted.name : l.product.day.name}
            </span>
            <span>{haunted ? l.product.haunted.price : money(l.total)}</span>
          </li>
        ))}
      </ul>
      {/* Pre-checked add-on, named on the receipt (Requirement 22.6). */}
      <label className="check addon">
        <input type="checkbox" checked={giftWrap} onChange={(e) => dispatch({ type: 'SET_GIFT_WRAP', on: e.target.checked })} />
        <span>{haunted ? 'Wrap it the way they wrapped it' : `Luxury gift wrap (+${money(GIFT_WRAP_CENTS)})`}</span>
      </label>
      <p className="summary-total">
        <span>Total</span>
        <strong>{totalLabel(total, haunted)}</strong>
      </p>
    </section>
  );
}

function DayPayment() {
  return (
    <section className="checkout-card" aria-labelledby="pay-title" data-perch="checkout-pay">
      <h2 id="pay-title">Payment</h2>
      <p className="notice" role="status">
        Payments are paused for the holiday rush. Your basket is saved. Please keep browsing while we catch up.
      </p>
      <button type="button" className="btn btn-primary btn-block" disabled>
        Place order
      </button>
    </section>
  );
}

function HauntedPayment() {
  const navigate = useNavigate();
  const { payment, agreed } = useStory((s) => s.story.checkout);
  const ready = agreed && isValidPayment(payment);
  return (
    <section className="checkout-card" aria-labelledby="pay-title">
      <h2 id="pay-title">How will you pay?</h2>
      <p className="muted">We do not take money here.</p>
      {(Object.keys(PAYMENT_OPTIONS) as PaymentKind[]).map((kind) => (
        <fieldset key={kind} className="pay-group">
          <legend>{KIND_LABEL[kind]}</legend>
          {PAYMENT_OPTIONS[kind].map((option) => (
            <label key={option} className="radio">
              <input
                type="radio"
                name="payment"
                checked={payment?.kind === kind && payment.option === option}
                onChange={() => dispatch({ type: 'SET_PAYMENT', payment: { kind, option } })}
              />
              <span>{OPTION_LABEL[option] ?? option}</span>
            </label>
          ))}
        </fieldset>
      ))}
      <div className="terms">
        <p>
          <strong>Terms of sale.</strong> What you give is not returned. What you take is yours to keep, and you are
          now theirs to keep. The shop will remember you.
        </p>
        <label className="check">
          <input type="checkbox" data-testid="agree" checked={agreed} onChange={(e) => dispatch({ type: 'SET_AGREEMENT', agreed: e.target.checked })} />
          <span>I understand, and I agree.</span>
        </label>
      </div>
      <button type="button" className="btn btn-primary btn-block" data-testid="accept" disabled={!ready} onClick={() => dispatch({ type: 'ACCEPT' })}>
        Accept
      </button>
      <button
        type="button"
        className="btn btn-quiet btn-block"
        data-testid="decline"
        onClick={() => {
          dispatch({ type: 'DECLINE' });
          navigate('/');
        }}
      >
        No, I’ll spend Christmas alone
      </button>
    </section>
  );
}

export function Checkout() {
  const haunted = useHaunted();
  const phase = useStory((s) => s.story.phase);
  const empty = useStory((s) => Object.keys(s.story.cart).length === 0);

  return (
    <main className="checkout" id="main">
      <p>
        <Link to="/" className="back-link">
          ← {haunted ? 'Back to the shelves' : 'Continue shopping'}
        </Link>
      </p>
      <h1>{haunted ? 'Final sale' : 'Checkout'}</h1>
      {empty && phase !== 'accepted' ? (
        <p className="empty">{haunted ? 'You have taken nothing yet.' : 'Your cart is empty.'}</p>
      ) : (
        <div className="checkout-grid">
          <Summary haunted={haunted} />
          {!haunted && <DayPayment />}
          {haunted && phase === 'checkout' && <HauntedPayment />}
          {haunted && phase === 'haunted' && (
            <section className="checkout-card">
              <button type="button" className="btn btn-primary btn-block" onClick={() => dispatch({ type: 'OPEN_CHECKOUT' })}>
                Continue to payment
              </button>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
