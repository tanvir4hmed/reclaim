const KEY = 'reclaim:ended';

/** Whether this device has completed at least one run (kept outside the story so the reset keeps it). */
export function hasEnded(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function markEnded(): void {
  try {
    window.localStorage.setItem(KEY, '1');
  } catch {
    // ignore
  }
}
