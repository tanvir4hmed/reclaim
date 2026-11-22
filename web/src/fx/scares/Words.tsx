import { useEffect, useState } from 'react';

/** Text that types itself, one character at a time. */
function useTyped(text: string, cps: number, start = 0): string {
  const [n, setN] = useState(0);
  useEffect(() => {
    let i = 0;
    let id = 0;
    const first = window.setTimeout(() => {
      id = window.setInterval(() => {
        i += 1;
        setN(i);
        if (i >= text.length) window.clearInterval(id);
      }, 1000 / cps);
    }, start);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [text, cps, start]);
  return text.slice(0, n);
}

/** Pocket watch: it is counting down now. To what, it does not say. */
export function WatchCountdown() {
  const [left, setLeft] = useState(257);
  useEffect(() => {
    const id = window.setInterval(() => setLeft((v) => Math.max(0, v - 4)), 55);
    return () => window.clearInterval(id);
  }, []);
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');
  return (
    <div className="ts-full ts-dim">
      <div className={`ts-watch${left === 0 ? ' ts-zero' : ''}`}>
        {mm}:{ss}
      </div>
      <p className="ts-whisper">{left === 0 ? 'Now.' : 'This is how long you have.'}</p>
    </div>
  );
}

/** Typewriter: it types to you, with the real time on your device. */
export function TypewriterWall() {
  const [time] = useState(() => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
  const text = `IT IS ${time}.\nYOU ARE ALONE IN THE ROOM.\nYOU ARE NOT.`;
  const typed = useTyped(text, 26);
  return (
    <div className="ts-full ts-dim">
      <pre className="ts-typed">
        {typed}
        <span className="ts-caret">▌</span>
      </pre>
    </div>
  );
}

const NAMES = [
  'Ada Whitlock, 7',
  'Thomas Penn, 9',
  'Elsie Marrow, 6',
  'Jonah Vale, 11',
  'Mary Ashdown, 8',
  'Peter Holloway, 5',
  'Ruth Calder, 10',
  'Samuel Grey, 7',
];

/** Radio: the roll call of those who never came home. The last name is yours. */
export function RadioNames() {
  return (
    <div className="ts-full ts-dim ts-static">
      <ol className="ts-names">
        {NAMES.map((n, i) => (
          <li key={n} style={{ animationDelay: `${i * 0.32}s` }}>
            {n}
          </li>
        ))}
        <li className="ts-you" style={{ animationDelay: `${NAMES.length * 0.32 + 0.4}s` }}>
          …and the one listening.
        </li>
      </ol>
    </div>
  );
}

/** Letter: an unseen hand writes across your screen. */
export function LetterWriting() {
  return (
    <div className="ts-full ts-paper">
      <p className="ts-hand ts-hand-1">Why didn’t you come home?</p>
      <p className="ts-hand ts-hand-2">Don’t turn around.</p>
    </div>
  );
}
