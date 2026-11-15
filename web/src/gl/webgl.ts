let cached: boolean | null = null;

/** WebGL2 check for the live objects; false in jsdom and on old devices (Requirement 27.5). */
export function hasWebGL2(): boolean {
  if (cached !== null) return cached;
  try {
    if (typeof document === 'undefined') return (cached = false);
    if (new URLSearchParams(window.location.search).has('nogl')) return (cached = false);
    const c = document.createElement('canvas');
    cached = !!c.getContext('webgl2');
  } catch {
    cached = false;
  }
  return cached;
}
