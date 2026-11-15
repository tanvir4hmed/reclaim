import { Link } from 'react-router';
import { useHaunted } from '../store';

/** Filled red circle, crescent and star by day; hollow and grey after the Reveal (design direction). */
export function Logo() {
  const haunted = useHaunted();
  const fill = haunted ? 'none' : 'var(--berry)';
  const stroke = haunted ? 'var(--muted)' : 'var(--berry)';
  const gold = haunted ? 'var(--muted)' : 'var(--gold)';
  return (
    <Link to="/" className="logo" aria-label="Reclaim and Co. Holiday Market, home">
      <svg width="54" height="22" viewBox="0 0 54 22" aria-hidden="true" focusable="false">
        <circle cx="10" cy="11" r="8" fill={fill} stroke={stroke} strokeWidth="1.6" />
        <path d="M30 3.5a7.5 7.5 0 1 0 0 15 6 6 0 1 1 0-15Z" fill={fill} stroke={stroke} strokeWidth="1.4" />
        <path
          d="m46 4 1.6 4.6 4.6 1.6-4.6 1.6L46 16.4l-1.6-4.6-4.6-1.6 4.6-1.6Z"
          fill={haunted ? 'none' : gold}
          stroke={gold}
          strokeWidth="1.2"
        />
      </svg>
      <span className="logo-text">
        <span className="logo-name">Reclaim &amp; Co.</span>
        <span className="logo-tag">{haunted ? 'Nothing is returned' : 'Pre-loved gifts, new memories'}</span>
      </span>
    </Link>
  );
}
