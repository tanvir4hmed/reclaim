import { useHaunted } from '../store';
import { scrollToGrid } from './Header';

const BULBS = 14;

/** The family photo that hangs in the hero; the same photo is the photo-frame product (Req 19.3). */
function GroupPhoto({ haunted }: { haunted: boolean }) {
  // Five figures, the middle one missing after the Reveal (Req 19.2).
  const figures = [0, 1, 2, 3, 4];
  return (
    <div className="hero-photo" data-perch="hero-photo" data-group-photo aria-hidden="true">
      <svg viewBox="0 0 120 84" width="100%" height="100%">
        <rect x="0" y="0" width="120" height="84" fill={haunted ? '#2a2620' : '#efe2c9'} />
        {figures.map((i) => {
          if (haunted && i === 2) return null;
          const x = 14 + i * 23;
          const tall = i === 2 ? 1 : i % 2 ? 0.86 : 0.94;
          return (
            <g key={i} transform={`translate(${x} ${84 - 70 * tall})`} opacity={haunted ? 0.75 : 1}>
              <circle cx="0" cy="10" r="7" fill={haunted ? '#5d564b' : '#8a5a44'} />
              <path d={`M-10 ${70 * tall} Q-11 22 0 19 Q11 22 10 ${70 * tall}Z`} fill={haunted ? '#3d3830' : i % 2 ? '#9b1b24' : '#3c5a3a'} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function Hero() {
  const haunted = useHaunted();
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-scene" aria-hidden="true">
        <ul className="bulbs">
          {Array.from({ length: BULBS }, (_, i) => (
            <li key={i} className="bulb" data-bulb={i} style={{ ['--i' as string]: i }} />
          ))}
        </ul>
        <div className="hero-tree" data-perch="hero-tree" />
        <div className="hero-lantern" data-perch="hero-lantern" />
        <GroupPhoto haunted={haunted} />
        <div className="hero-globe" data-perch="hero-globe">
          <div className="globe-house" />
        </div>
        <div className="hero-gifts" />
        <div className="hero-echo" data-echo-slot />
      </div>
      <div className="hero-copy">
        <p className="eyebrow">{haunted ? 'Unclaimed since the war' : 'Christmas Homecoming Sale'}</p>
        <h1 id="hero-title">{haunted ? 'Everything Must Go' : 'Gifts for everyone coming home'}</h1>
        <p className="hero-sub">
          {haunted
            ? 'Every piece here belonged to someone. None of it was returned.'
            : 'Pre-loved treasures, wrapped and ready. Up to 40% off until midnight.'}
        </p>
        <button type="button" className="btn btn-primary" onClick={scrollToGrid}>
          {haunted ? 'See what is left' : 'Shop the sale'}
        </button>
      </div>
    </section>
  );
}
