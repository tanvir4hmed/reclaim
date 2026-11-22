/**
 * The shop's last resident, as a silhouette: tall, thin, long black hair hanging over a pale
 * face, arms too long. Reused by the Take scares that put "someone" in the room with you.
 * Drawn in a 100 × 260 box, feet at the bottom.
 */
export function Figure({ face = true, eyes = true, className }: { face?: boolean; eyes?: boolean; className?: string }) {
  return (
    <svg className={`scare-figure-svg ${className ?? ''}`} viewBox="0 0 100 260" aria-hidden="true">
      <defs>
        <radialGradient id="rc-fig-face" cx="50%" cy="40%" r="60%">
          <stop offset="0" stopColor="#cfc9be" />
          <stop offset="1" stopColor="#5d584f" />
        </radialGradient>
        <filter id="rc-fig-soft">
          <feGaussianBlur stdDeviation="0.8" />
        </filter>
      </defs>
      <g filter="url(#rc-fig-soft)">
        {/* gown and too-long arms hanging at the sides */}
        <path fill="#0b0a0a" d="M30 70 C 24 120, 20 180, 14 258 L86 258 C 80 180, 76 120, 70 70 Z" />
        <path fill="#0b0a0a" d="M30 74 C 20 110, 16 150, 14 196 L19 197 C 22 152, 27 114, 35 80 Z M70 74 C 80 110, 84 150, 86 196 L81 197 C 78 152, 73 114, 65 80 Z" />
        {/* fingers past the knees */}
        <path stroke="#7d776c" strokeWidth="1.2" fill="none" d="M14 196 l-2 12 M16 197 l0 13 M18 197 l2 12 M86 196 l2 12 M84 197 l0 13 M82 197 l-2 12" />
        {/* head */}
        {face && <ellipse cx="50" cy="42" rx="13" ry="17" fill="url(#rc-fig-face)" />}
        {face && eyes && (
          <g fill="#050404">
            <ellipse cx="45" cy="40" rx="3.2" ry="4" />
            <ellipse cx="55" cy="40" rx="3.2" ry="4" />
            <ellipse cx="50" cy="52" rx="2.6" ry="4.5" />
          </g>
        )}
        {/* hair: hanging straight down over the face and past the shoulders */}
        <path fill="#050404" d="M50 22 C 34 22, 32 36, 33 60 C 33 80, 30 100, 27 118 L37 116 C 39 96, 40 76, 42 56 C 44 40, 46 32, 50 30 C 54 32, 56 40, 58 56 C 60 76, 61 96, 63 116 L73 118 C 70 100, 67 80, 67 60 C 68 36, 66 22, 50 22 Z" />
        <path stroke="#050404" strokeWidth="1.2" fill="none" d="M47 30 C 46 44, 47 56, 45 70 M53 30 C 54 46, 53 58, 56 72" />
      </g>
    </svg>
  );
}
