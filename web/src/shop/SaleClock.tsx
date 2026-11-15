import { useEffect, useState } from 'react';
import { useHaunted, useStory } from '../store';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Seconds until local midnight: the fake "sale ends" countdown the receipt later names. */
function secondsToMidnight(now: Date): number {
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  return Math.max(0, Math.round((end.getTime() - now.getTime()) / 1000));
}

function hms(total: number): string {
  const s = ((total % 86400) + 86400) % 86400;
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/**
 * The shop clock (Requirement 1.4). By day it counts down to midnight. After the pocket
 * watch is carted it runs in reverse (Requirement 14.4): the countdown climbs back up.
 */
export function SaleClock() {
  const haunted = useHaunted();
  const direction = useStory((s) => s.story.clockDirection);
  const [value, setValue] = useState(() => secondsToMidnight(new Date()));

  useEffect(() => {
    const id = setInterval(() => {
      setValue((v) => (direction === 1 ? secondsToMidnight(new Date()) : v + 1));
    }, 1000);
    return () => clearInterval(id);
  }, [direction]);

  return (
    <div className="sale-bar" data-testid="sale-bar">
      <span className="sale-bar-text">
        {haunted ? 'Final sale. Everything must go.' : 'Christmas Homecoming Sale: up to 40% off'}
      </span>
      <span className="sale-bar-clock">
        <span>{haunted ? 'Closing in' : 'Sale ends in'}</span>{' '}
        <time className="clock-digits" data-testid="shop-clock" data-direction={direction} aria-label={haunted ? 'Time until closing' : 'Time until the sale ends'}>
          {hms(value)}
        </time>
      </span>
    </div>
  );
}
