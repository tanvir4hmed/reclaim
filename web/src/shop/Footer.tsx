import { Link } from 'react-router';
import { hasEnded } from '../fx/ended';
import { FooterSoldiers, HiddenMitten } from '../fx/Extras';
import { dispatch, useHaunted, useStory } from '../store';

export function Footer() {
  const haunted = useHaunted();
  const motion = useStory((s) => s.story.settings.motion);
  // The receipt appears only after this visitor has finished a run (Requirement 25.4).
  const hasEchoed = useStory((s) => s.story.phase === 'day' && s.story.echo !== null) && hasEnded();
  return (
    <footer className="site-footer" data-perch="footer">
      <FooterSoldiers />
      <HiddenMitten />
      <div className="footer-inner">
        <p className="footer-brand">Reclaim &amp; Co. Holiday Market</p>
        <p className="muted">{haunted ? 'Open until the last one leaves.' : 'Open every day until Christmas Eve.'}</p>
        <label className="motion-toggle">
          <span>Motion</span>
          <select value={motion} onChange={(e) => dispatch({ type: 'SETTINGS', settings: { motion: e.target.value as 'system' | 'reduced' | 'full' } })}>
            <option value="system">Follow my device</option>
            <option value="reduced">Reduced</option>
            <option value="full">Full</option>
          </select>
        </label>
        {hasEchoed && !haunted && (
          <Link to="/receipt" className="receipt-link" data-testid="receipt-link">
            View receipt
          </Link>
        )}
        <p className="muted small">A Kiroween 2026 project. No real payments. No personal data.</p>
      </div>
    </footer>
  );
}
