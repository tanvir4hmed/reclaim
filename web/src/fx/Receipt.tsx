import { Link } from 'react-router';
import { hasEnded } from './ended';

/** Only patterns that actually appear in the Shop (Requirement 25.2). */
const PATTERNS: { name: string; what: string; where: string }[] = [
  { name: 'Fake countdown', what: 'A timer that creates urgency but resets and never really ends the sale.', where: '"Sale ends in" bar at the top of every page' },
  { name: 'False scarcity', what: 'Claims of low stock or rival buyers to rush you.', where: '"Only 1 left" badges on cards and product pages' },
  { name: 'Anchored discounts', what: 'A crossed-out "was" price that makes any price look like a bargain.', where: 'Starburst badges and struck-through prices' },
  { name: 'Pre-checked add-on', what: 'An extra you must notice and untick, or pay for.', where: 'Luxury gift wrap at checkout' },
  { name: 'Confirmshaming', what: 'Wording that shames you for saying no.', where: '"No, I\u2019ll spend Christmas alone"' },
  { name: 'Sneak into basket', what: 'An item added to your cart that you did not choose.', where: 'The item that appeared in your cart after the lights changed' },
  { name: 'Social proof pressure', what: 'Invented viewers or buyers to make you act now.', where: '"9 people have this in their basket" on product pages' },
  { name: 'Tab-away nagging', what: 'The page title begs you to return when you look elsewhere.', where: '"Your cart misses you" in your browser tab' },
  { name: 'Exit-intent plea', what: 'A last-moment offer when your pointer heads for the close button.', where: 'The discount that appeared as you moved to leave' },
];

/** The receipt after the ending (Requirement 25). It never appears before the ending. */
export function Receipt() {
  if (!hasEnded()) {
    return (
      <main className="receipt-page" id="main">
        <p className="empty">There is no receipt yet.</p>
        <Link to="/" className="back-link">← Back to the shop</Link>
      </main>
    );
  }
  return (
    <main className="receipt-page" id="main">
      <article className="receipt" aria-labelledby="receipt-title">
        <h1 id="receipt-title">Receipt</h1>
        <p className="muted">Reclaim &amp; Co. used these tricks on you. Real shops use them every holiday season.</p>
        <ol className="receipt-lines">
          {PATTERNS.map((p) => (
            <li key={p.name}>
              <h2>{p.name}</h2>
              <p>{p.what}</p>
              <p className="muted small">Here: {p.where}</p>
            </li>
          ))}
        </ol>
        <p className="receipt-foot">
          We never sent your time, your device details or anything you chose anywhere. Real shops can. Learn to spot
          these patterns at{' '}
          <a href="https://www.deceptive.design/types" rel="noopener noreferrer" target="_blank">
            deceptive.design
          </a>
          .
        </p>
        <Link to="/" className="back-link">← Back to the shop</Link>
      </article>
    </main>
  );
}
