/** The confession the typewriter types, dated tomorrow (Requirement 17.1–17.2). Pure for tests. */
export function confession(now: Date, cartedAt: Date | null): string[] {
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const date = tomorrow.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const last = cartedAt
    ? `At ${cartedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} I put the typewriter in my cart.`
    : 'I have not decided what to take yet.';
  return [date, '', 'I came in for a present.', 'I knew whose things these were.', 'I took them anyway.', last];
}

export const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

/** Which key (row, index) types a character, or null for spaces and punctuation. */
export function keyFor(ch: string): [number, number] | null {
  const c = ch.toUpperCase();
  for (let r = 0; r < KEY_ROWS.length; r++) {
    const i = (KEY_ROWS[r] as string).indexOf(c);
    if (i >= 0) return [r, i];
  }
  return null;
}
