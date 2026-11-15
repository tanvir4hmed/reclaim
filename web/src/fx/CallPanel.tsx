import { useEffect, useState } from 'react';
import { useFx } from './fxStore';

const LINES = [
  'Hello? Is this the shop?',
  'You have something of mine.',
  'No, keep it. I only wanted to hear someone answer.',
  'We will see you at checkout.',
];

/** The cart rings after the telephone is carted; answering shows the voice as subtitles (Req 21.2–21.4). */
export function CallPanel() {
  const ringing = useFx((s) => s.cartRinging);
  const setFx = useFx((s) => s.set);
  const [line, setLine] = useState(-1);

  useEffect(() => {
    if (line < 0 || line >= LINES.length) return;
    const t = setTimeout(() => setLine((n) => n + 1), 2600);
    return () => clearTimeout(t);
  }, [line]);

  if (line >= 0 && line < LINES.length) {
    return (
      <div className="call" role="status" aria-live="polite" data-testid="call-subtitles">
        <p className="call-who">Unknown caller</p>
        <p className="call-line">“{LINES[line]}”</p>
      </div>
    );
  }
  if (!ringing) return null;
  return (
    <div className="call call-ringing" data-testid="call-ringing">
      <p className="call-who">Incoming call: the other side of the sale</p>
      <button
        type="button"
        className="btn btn-primary"
        data-testid="answer"
        onClick={() => {
          setFx({ cartRinging: false });
          setLine(0);
        }}
      >
        Answer
      </button>
    </div>
  );
}
