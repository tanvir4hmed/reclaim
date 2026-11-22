import { useMemo } from 'react';
import { seeded } from '../../director/footprints';
import { Figure } from './Figure';

/** Cake: the flies come out of it, all at once, and crawl over the glass. */
export function CakeFlies() {
  const flies = useMemo(() => {
    const r = seeded(13);
    return Array.from({ length: 70 }, () => ({
      x: r() * 100,
      y: r() * 100,
      dx: (r() - 0.5) * 260,
      dy: (r() - 0.5) * 200,
      d: r() * 0.8,
      s: 0.6 + r() * 0.9,
      big: r() < 0.06,
    }));
  }, []);
  return (
    <div className="ts-full">
      {flies.map((f, i) => (
        <span
          key={i}
          className={`ts-fly${f.big ? ' ts-fly-big' : ''}`}
          style={{ left: `${f.x}%`, top: `${f.y}%`, animationDelay: `${f.d}s`, ['--dx' as string]: `${f.dx}px`, ['--dy' as string]: `${f.dy}px`, ['--s' as string]: f.s }}
        />
      ))}
    </div>
  );
}

/** Unopened gift: something in the box was alive. Its hand comes up from under the screen. */
export function GiftHand() {
  return (
    <div className="ts-full ts-dim">
      <svg className="ts-gift-hand" viewBox="0 0 200 300">
        <defs>
          <linearGradient id="rc-ts-arm" x1="0" x2="1">
            <stop offset="0" stopColor="#2a2a24" />
            <stop offset="0.5" stopColor="#7d8070" />
            <stop offset="1" stopColor="#2a2a24" />
          </linearGradient>
        </defs>
        <defs>
          <filter id="rc-ts-dead">
            <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="3" seed="6" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.12  0 0 0 0 0.14  0 0 0 0 0.1  0 0 0 0.9 0" result="mottle" />
            <feComposite in="mottle" in2="SourceGraphic" operator="in" result="m" />
            <feMerge>
              <feMergeNode in="SourceGraphic" />
              <feMergeNode in="m" />
            </feMerge>
          </filter>
        </defs>
        {/* a thin grey arm out of a torn, filthy sleeve */}
        <g filter="url(#rc-ts-dead)">
          <path fill="url(#rc-ts-arm)" d="M86 300 C 88 240, 90 196, 88 156 L112 156 C 110 196, 112 240, 114 300 Z" />
          {/* long, bony fingers, slightly too many joints, hooked toward you */}
          <path
            fill="url(#rc-ts-arm)"
            d="M86 166 C 80 146, 72 128, 66 112 C 58 92, 46 70, 50 58 C 54 52, 60 60, 66 78 C 64 58, 62 30, 68 20 C 74 14, 79 30, 80 62 C 82 32, 86 6, 94 4 C 102 6, 100 34, 98 64 C 102 38, 110 16, 118 20 C 126 24, 118 52, 112 80 C 120 70, 134 62, 140 68 C 144 76, 128 94, 120 116 C 116 136, 116 150, 116 166 Z"
          />
          <path d="M60 64 l-6 -6 M71 30 l-2 -8 M94 10 l0 -9 M115 26 l4 -8 M134 70 l8 -4" stroke="#0e0c0a" strokeWidth="3.4" strokeLinecap="round" />
          {/* tendons and the bones under the skin */}
          <path d="M92 160 C 88 130, 82 104, 74 84 M100 160 C 98 128, 96 100, 94 72 M108 160 C 108 132, 110 108, 112 86" stroke="#3a3730" strokeOpacity="0.6" strokeWidth="1.2" fill="none" />
        </g>
        <path fill="#151210" d="M70 300 C 72 270, 76 252, 84 244 L 92 258 L 98 240 L 104 256 L 112 242 L 118 254 L 126 246 C 130 260, 132 280, 132 300 Z" />
      </svg>
    </div>
  );
}

/** Advent calendar: door 25 opens from the inside. Something looks out, finds you, and shuts it. */
export function AdventEye() {
  return (
    <div className="ts-full ts-dim">
      <div className="ts-door-frame">
        <div className="ts-door-inside">
          <svg viewBox="0 0 100 60" className="ts-eye">
            <ellipse cx="50" cy="30" rx="44" ry="22" fill="#d8d2c4" />
            <path d="M8 30 q20 -6 34 -2 M58 28 q18 -4 34 2 M20 40 q14 2 24 -2" stroke="#8a1c1c" strokeOpacity="0.6" strokeWidth="0.8" fill="none" />
            <g className="ts-iris">
              <circle cx="50" cy="30" r="15" fill="#3a2a1e" />
              <circle cx="50" cy="30" r="6" fill="#050303" />
              <circle cx="46" cy="26" r="2" fill="#f4efe6" opacity="0.7" />
            </g>
            <path className="ts-lid" d="M0 0 H100 V30 Q50 -4 0 30 Z" fill="#050303" />
          </svg>
        </div>
        <div className="ts-door">
          <span>25</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Music box: the tiny dancer on the box is her now. She turns on the spindle, faster and
 * faster; her body spins, but her face never leaves you. Then the spring snaps and she stops,
 * looking at you.
 */
export function MusicBoxDancer() {
  return (
    <div className="ts-full ts-dim">
      <div className="ts-mbox">
        <div className="ts-mbox-spin">
          <Figure className="ts-mbox-her" />
        </div>
        <div className="ts-mbox-face">
          <svg viewBox="0 0 40 50">
            <ellipse cx="20" cy="24" rx="12" ry="16" fill="#cfc9be" />
            <ellipse cx="15" cy="22" rx="3.6" ry="4.6" fill="#050303" />
            <ellipse cx="25" cy="22" rx="3.6" ry="4.6" fill="#050303" />
            <ellipse cx="20" cy="34" rx="3" ry="5" fill="#050303" />
            <path d="M8 10 C 6 26, 7 38, 10 48 M32 10 C 34 26, 33 38, 30 48 M20 6 C 12 6, 8 12, 8 20 M20 6 C 28 6, 32 12, 32 20" stroke="#050404" strokeWidth="3" fill="none" />
          </svg>
        </div>
        <div className="ts-mbox-base" />
      </div>
      <p className="ts-whisper ts-late">She stops facing whoever let her out.</p>
    </div>
  );
}
