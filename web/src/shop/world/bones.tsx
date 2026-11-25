/**
 * Bones for the skeletons in the haunted graveyard (GraveSkeletons) and the charms on the
 * scarecrow (Scarecrow), drawn as SVG in code. Each piece is drawn twice, a dark outline and
 * then the bone on top, so it reads against black earth.
 */

/** #d8cfbf dimmed for the night; limbs on the far side a step darker. */
export const BONE = '#bdb4a4';
export const BONE_FAR = '#8f8778';
export const BONE_LINE = '#120d0b';
export const HOLLOW = '#060404';

export type Pt = readonly [number, number];

/** Rounds to one decimal so the path data stays short. */
export const r1 = (v: number) => Math.round(v * 10) / 10;

/** The elbow or knee of a limb from `a` to `c` with bones `l1` and `l2`; `side` picks the bend. */
export function joint(a: Pt, c: Pt, l1: number, l2: number, side: 1 | -1): Pt {
  const dx = c[0] - a[0];
  const dy = c[1] - a[1];
  const real = Math.hypot(dx, dy) || 1;
  const d = Math.min(l1 + l2 - 0.01, real);
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const off = Math.sqrt(Math.max(0, l1 * l1 - along * along)) * side;
  const ux = dx / real;
  const uy = dy / real;
  return [r1(a[0] + ux * along - uy * off), r1(a[1] + uy * along + ux * off)];
}

/** Direction from `a` to `b`, in radians. */
export const heading = (a: Pt, b: Pt) => Math.atan2(b[1] - a[1], b[0] - a[0]);

/** A long bone from `a` to `b`: a narrow shaft with a double knob at each end. */
export function LongBone({ a, b, w = 3, tone = BONE }: { a: Pt; b: Pt; w?: number; tone?: string }) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * w * 0.34;
  const ny = (dx / len) * w * 0.34;
  const r = w * 0.5;
  const ends: Pt[] = [
    [a[0] + nx, a[1] + ny],
    [a[0] - nx, a[1] - ny],
    [b[0] + nx, b[1] + ny],
    [b[0] - nx, b[1] - ny],
  ];
  const shaft = `M${r1(a[0])} ${r1(a[1])}L${r1(b[0])} ${r1(b[1])}`;
  const shade = `M${r1(a[0] + nx * 0.5)} ${r1(a[1] + ny * 0.5)}L${r1(b[0] + nx * 0.5)} ${r1(b[1] + ny * 0.5)}`;
  return (
    <g>
      <path d={shaft} stroke={BONE_LINE} strokeWidth={r1(w * 0.6 + 1.4)} strokeLinecap="round" />
      {ends.map(([x, y], i) => (
        <circle key={`o${i}`} cx={r1(x)} cy={r1(y)} r={r1(r + 0.7)} fill={BONE_LINE} />
      ))}
      <path d={shaft} stroke={tone} strokeWidth={r1(w * 0.6)} strokeLinecap="round" />
      {ends.map(([x, y], i) => (
        <circle key={`b${i}`} cx={r1(x)} cy={r1(y)} r={r1(r)} fill={tone} />
      ))}
      <path d={shade} stroke={BONE_LINE} strokeOpacity={0.3} strokeWidth={r1(w * 0.16)} strokeLinecap="round" />
    </g>
  );
}

/** The two bones of a forearm (or shin) side by side, from elbow `a` to wrist `b`. */
export function Forearm({ a, b, w = 2.4, tone = BONE }: { a: Pt; b: Pt; w?: number; tone?: string }) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * w * 0.3;
  const ny = (dx / len) * w * 0.3;
  return (
    <g>
      <LongBone a={[a[0] + nx, a[1] + ny]} b={[b[0] + nx * 0.5, b[1] + ny * 0.5]} w={w * 0.62} tone={tone} />
      <LongBone a={[a[0] - nx, a[1] - ny]} b={[b[0] - nx * 0.5, b[1] - ny * 0.5]} w={w * 0.55} tone={tone} />
    </g>
  );
}

/** Thin curved bones (ribs, collarbones), all in one path `d`. */
export function Curve({ d, w = 1.6, tone = BONE }: { d: string; w?: number; tone?: string }) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke={BONE_LINE} strokeWidth={r1(w + 1.3)} />
      <path d={d} stroke={tone} strokeWidth={w} />
    </g>
  );
}

/** A run of vertebrae along `d`: a bone column cut into segments by dark gaps. */
export function Spine({ d, w = 3, tone = BONE }: { d: string; w?: number; tone?: string }) {
  return (
    <g fill="none" strokeLinejoin="round">
      <path d={d} stroke={BONE_LINE} strokeWidth={r1(w + 1.4)} strokeLinecap="round" />
      <path d={d} stroke={tone} strokeWidth={w} strokeLinecap="round" />
      <path d={d} stroke={BONE_LINE} strokeWidth={r1(w + 0.2)} strokeDasharray="0.6 2.2" />
    </g>
  );
}

/**
 * A hand (or foot) of finger bones fanning out from the wrist `at` towards `dir` (radians).
 * `curl` bends each finger joint; `thumb` picks the side the thumb sits on.
 */
export function Hand({
  at,
  dir,
  len = 8,
  spread = 0.5,
  curl = 0.3,
  w = 1,
  tone = BONE,
  thumb = 1,
}: {
  at: Pt;
  dir: number;
  len?: number;
  spread?: number;
  curl?: number;
  w?: number;
  tone?: string;
  thumb?: 1 | -1;
}) {
  const knuckles: Pt[] = [];
  let d = '';
  const digit = (a0: number, segs: number[], bend: number) => {
    let x = at[0];
    let y = at[1];
    let a = a0;
    d += `M${r1(x)} ${r1(y)}`;
    segs.forEach((s, j) => {
      x += Math.cos(a) * s;
      y += Math.sin(a) * s;
      d += `L${r1(x)} ${r1(y)}`;
      if (j < segs.length - 1) knuckles.push([r1(x), r1(y)]);
      a += bend;
    });
  };
  for (let i = 0; i < 4; i++) {
    const t = i / 3 - 0.5;
    const k = 1 - Math.abs(t) * 0.35;
    digit(dir + t * spread, [len * 0.42, len * 0.3 * k, len * 0.2 * k], curl);
  }
  digit(dir - thumb * (spread * 0.5 + 0.7), [len * 0.3, len * 0.22, len * 0.16], curl * 0.6);
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke={BONE_LINE} strokeWidth={r1(w + 1.1)} />
      <path d={d} stroke={tone} strokeWidth={w} />
      {knuckles.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={r1(w * 0.55)} fill={tone} />
      ))}
      <circle cx={r1(at[0])} cy={r1(at[1])} r={r1(w * 1.3)} fill={tone} stroke={BONE_LINE} strokeWidth={0.6} />
    </g>
  );
}

/**
 * A skull in profile facing left, about 25 units from crown to chin, centred near (0, 0);
 * the back of its base, where the neck meets it, is near (4, 5). `gape` drops the jaw (degrees).
 */
export function SkullSide({ tone = BONE, gape = 0 }: { tone?: string; gape?: number }) {
  return (
    <g strokeLinejoin="round">
      <g transform={gape ? `rotate(${-gape} 1.6 4.6)` : undefined}>
        <path
          d="M1.6 4.2L2.2 6C2.6 9 1.6 11-1 11.4L-10.2 11.6C-11.6 11.2-11.8 9.4-11.2 7.4L-5.8 7.4L-2.8 7.6L-0.6 6.8Z"
          fill={tone}
          stroke={BONE_LINE}
          strokeWidth={1}
        />
        <path d="M-10.6 7.5V8.7M-9.4 7.5V8.8M-8.2 7.5V8.8M-7 7.5V8.6" stroke={BONE_LINE} strokeWidth={0.45} />
      </g>
      <path
        d="M7.5 3.5C11 0 11-8 5-11C0-13.5-7-12-9.5-6.5C-10.5-4.5-10.2-3-10.8-2L-10-0.5L-12.2 3.2L-11.4 4.2L-11.6 6.4L-5.5 6.8L-3.5 4.8L1 4.6C3 6.5 5.5 6 7.5 3.5Z"
        fill={tone}
        stroke={BONE_LINE}
        strokeWidth={1}
      />
      {/* the shadowed back of the skull */}
      <path d="M7.5 3.5C10 0 10.6-6 7-9.5C9-4 7.6 0.6 3.6 4.6Z" fill={BONE_LINE} opacity={0.28} />
      {/* eye socket, nose, ear hole, cheekbone, teeth */}
      <path d="M-8.9-2.4C-8.8-4.8-5.6-5.6-3.8-3.6C-3-2.2-3.6-0.4-5.4 0C-7.4 0.2-9-0.6-8.9-2.4Z" fill={HOLLOW} />
      <path d="M-10.2 0.6L-11.4 3.4L-9.4 3.6Z" fill={HOLLOW} />
      <circle cx={2.6} cy={3} r={0.9} fill={HOLLOW} />
      <path d="M-7.4 2.2Q-4.6 3.4-1 2.6M-3-1.6Q0-6.4 5-4.4" fill="none" stroke={BONE_LINE} strokeWidth={0.5} opacity={0.7} />
      <path d="M-11 5.2V6.6M-9.8 5.2V6.7M-8.6 5.3V6.7M-7.4 5.3V6.7M-6.2 5.4V6.7" stroke={BONE_LINE} strokeWidth={0.45} />
    </g>
  );
}

/** A skull seen from the front, about 27 units from crown to chin, centred near (0, 0). */
export function SkullFront({ tone = BONE, gape = 0 }: { tone?: string; gape?: number }) {
  return (
    <g strokeLinejoin="round">
      <g transform={gape ? `translate(0 ${r1(gape * 0.4)})` : undefined}>
        <path d="M-6.2 8.4L6.2 8.4L6.6 11.2Q4.8 14.2 0 14.4Q-4.8 14.2-6.6 11.2Z" fill={tone} stroke={BONE_LINE} strokeWidth={1} />
        <path d="M-3.3 8.6V10M-2.2 8.6V10.1M-1.1 8.6V10.2M0 8.6V10.2M1.1 8.6V10.2M2.2 8.6V10.1M3.3 8.6V10" stroke={BONE_LINE} strokeWidth={0.45} />
      </g>
      <path
        d="M-9.5 0.5C-10.5-8-6-12.5 0-12.5C6-12.5 10.5-8 9.5 0.5C9.2 3 7.8 4 7 5.2L5.8 8.6L-5.8 8.6L-7 5.2C-7.8 4-9.2 3-9.5 0.5Z"
        fill={tone}
        stroke={BONE_LINE}
        strokeWidth={1}
      />
      {/* shading down one side of the cranium */}
      <path d="M9.5 0.5C10.5-8 6-12.5 0-12.5C5-11 8.2-6 7.6 1.6C7.2 3.4 6.4 4.4 5.8 6Z" fill={BONE_LINE} opacity={0.25} />
      {/* two eye sockets, never quite the same size, and the nose */}
      <path d="M-7.2-1.6C-6.8-4.2-2.6-4.4-1.6-2.2C-1.2 0.4-3 2.2-4.6 2C-6.6 1.8-7.6 0.6-7.2-1.6Z" fill={HOLLOW} />
      <path d="M7-1.2C6.6-4.4 2.4-4.2 1.6-1.8C1.3 0.8 3 2.6 4.8 2.3C6.8 1.9 7.4 0.6 7-1.2Z" fill={HOLLOW} />
      <path d="M0 2.6L-1.6 5.8Q0 6.6 1.6 5.8Z" fill={HOLLOW} />
      <path d="M-8.5 3Q-6.5 4.6-4.8 4M8.5 3Q6.5 4.6 4.8 4M-3.2-9Q0-10.4 3.2-9" fill="none" stroke={BONE_LINE} strokeWidth={0.5} opacity={0.6} />
      <path d="M-3.3 7V8.6M-2.2 7V8.6M-1.1 7V8.6M0 7V8.6M1.1 7V8.6M2.2 7V8.6M3.3 7V8.6" stroke={BONE_LINE} strokeWidth={0.45} />
    </g>
  );
}
