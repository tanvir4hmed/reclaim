import { useEffect, useState } from 'react';
import type { ProductId } from '../core';
import { useHaunted, useStory } from '../store';
import { useFx } from './fxStore';

const OWNERS: Partial<Record<ProductId, string>> = {
  shoes: 'Tomas, 1931',
  'pocket-watch': 'Josef, 1902',
  doll: 'Ellie, 1934',
  letter: 'Margaret, 1912',
  typewriter: 'Iris, 1909',
  mirror: 'Ana, 1898',
  'photo-frame': 'The Hale family',
  telephone: 'Lena, 1915',
};

/** "Customers also bought" becomes "Previous owners"; the newest review is dated tomorrow (Req 40). */
export function HauntedProductNotes({ id }: { id: ProductId }) {
  const haunted = useHaunted();
  const [tomorrow] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  });
  if (!haunted) {
    return (
      <div className="pv-notes">
        <p className="review">
          <strong>★★★★★ Verified buyer</strong> “Perfect gift, arrived beautifully wrapped.” <span className="muted small">Dec 2</span>
        </p>
      </div>
    );
  }
  return (
    <div className="pv-notes">
      <p className="muted small">Previous owner: {OWNERS[id] ?? 'Unknown'}</p>
      <p className="review">
        <strong>Verified owner</strong> “I put it in my cart even though I knew whose it was.”{' '}
        <span className="muted small">{tomorrow}</span>
      </p>
      {/* Hidden text: only selecting the space between lines shows it (Req 40). */}
      <p className="hidden-ink" aria-hidden="true">
        It was never yours to take.
      </p>
    </div>
  );
}

/** Support chat that types forever, then speaks from aisle 3. Preset replies only (Req 40). */
export function SupportChat() {
  const haunted = useHaunted();
  const act = useStory((s) => s.story.act);
  const [open, setOpen] = useState(false);
  const [line, setLine] = useState<string | null>(null);
  const [typing, setTyping] = useState(true);
  useEffect(() => {
    if (!open || !haunted) return;
    const t = setTimeout(() => {
      setTyping(false);
      setLine('I’m still here. Aisle 3.');
    }, 9000);
    return () => clearTimeout(t);
  }, [open, haunted]);
  if (haunted && act < 2) return null;
  return (
    <div className="chat">
      {open && (
        <div className="chat-panel" role="dialog" aria-label="Support chat">
          <p className="chat-from">{haunted ? 'Holly' : 'Holly, Reclaim & Co.'}</p>
          {!haunted && <p>Hi! Need help finding the perfect gift?</p>}
          {haunted && typing && <p className="typing" aria-label="Holly is typing">Holly is typing…</p>}
          {haunted && line && <p>{line}</p>}
          <div className="chat-replies">
            {(haunted ? ['Who is this?', 'I want to leave'] : ['Track my order', 'Gift ideas']).map((r) => (
              <button key={r} type="button" className="btn btn-quiet" onClick={() => setLine(haunted ? 'You can’t leave until you pay.' : 'Our elves are busy. Try again soon!')}>
                {r}
              </button>
            ))}
          </div>
        </div>
      )}
      <button type="button" className="chat-bubble" aria-expanded={open} aria-label="Support chat" onClick={() => setOpen((v) => !v)}>
        {haunted ? '…' : '?'}
      </button>
    </div>
  );
}

/** Truffles disappear one by one each time you look away; the badge counts down (Req 32.2). */
export function useChocolateCountdown(id: ProductId) {
  const haunted = useHaunted();
  const missing = useFx((s) => s.flags['choc-missing'] ?? 0);
  const set = useFx((s) => s.set);
  if (id !== 'chocolate-box' || !haunted) return { left: null as number | null, onLeave: undefined };
  return {
    left: Math.max(0, 24 - missing),
    onLeave: () => {
      const f = useFx.getState().flags;
      set({ flags: { ...f, 'choc-missing': Math.min(24, (f['choc-missing'] ?? 0) + 1) } });
    },
  };
}
