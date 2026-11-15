import { useUi } from '../store';

/** One polite live region for cart changes, the Reveal and the order result (Requirement 26.3). */
export function LiveRegion() {
  const text = useUi((s) => s.announcement);
  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="live-region">
      {text}
    </div>
  );
}
