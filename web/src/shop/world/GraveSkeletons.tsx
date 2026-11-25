import { useEffect, useRef, type RefObject } from 'react';
import { BONE, BONE_FAR, BONE_LINE, Curve, Forearm, HOLLOW, Hand, LongBone, SkullFront, SkullSide, Spine, heading, joint, r1, type Pt } from './bones';
import { useStill } from './useStill';

/** Both figures are drawn 1.2 times their own units, on the front of the graveyard's ground. */
const SCALE = 1.2;
const PULL_Y = 396;
const CRAWL_Y = 400;

/* ---------------------------------------------------------------------------------------
 * The exhumation: one skeleton kneels at an open grave and hauls another up by the arm.
 * Local units, ground at y = 0, the grave's mouth centred near x = -6.
 * ------------------------------------------------------------------------------------- */

/** The kneeling one's hip, and how far back its body leans when at rest (degrees). */
const HIP: Pt = [66, -34];
const LEAN = 13;

/** A point in the grave's units, in the kneeling one's torso frame (origin at the hip, upright). */
function torso(p: Pt): Pt {
  const a = (-LEAN * Math.PI) / 180;
  const x = p[0] - HIP[0];
  const y = p[1] - HIP[1];
  return [r1(x * Math.cos(a) - y * Math.sin(a)), r1(x * Math.sin(a) + y * Math.cos(a))];
}

// The buried one's raised arm: shoulder, elbow, wrist (in the grave's units).
const B_SHOULDER: Pt = [7, -17];
const B_ELBOW: Pt = [21, -31];
const B_WRIST: Pt = [34, -43];

// The kneeling one's arms, in its torso frame; both hands close round the buried one's wrist.
const K_SHOULDER_NEAR: Pt = [-3, -45];
const K_SHOULDER_FAR: Pt = [-0.5, -46.5];
const K_HAND_NEAR = torso([34, -42]);
const K_HAND_FAR = torso([36.5, -45]);
const K_ELBOW_NEAR = joint(K_SHOULDER_NEAR, K_HAND_NEAR, 27, 27, -1);
const K_ELBOW_FAR = joint(K_SHOULDER_FAR, K_HAND_FAR, 27, 27, -1);

/** Side-view ribs hanging from the spine and curving round to the breastbone at the front. */
const K_RIBS = Array.from({ length: 7 }, (_, i) => {
  const y = -46 + i * 3.3;
  return i < 5
    ? `M-1.4 ${r1(y)}C-6 ${r1(y - 2.5)} -15.5 ${r1(y + 0.5)} ${r1(-14.5 + i * 0.7)} ${r1(y + 7 + i * 0.3)}`
    : `M-1.4 ${r1(y)}C-5 ${r1(y - 1.5)} -10 ${r1(y + 1)} -9.5 ${r1(y + 5)}`;
}).join('');

/** Front-view ribs of the buried one, mostly still under the earth. */
const B_RIBS = Array.from({ length: 4 }, (_, i) => {
  const y = -9 + i * 4.5;
  return `M-13 ${y}Q-25 ${y - 3} -29 ${y + 5}M-13 ${y}Q-2 ${y - 5} 3 ${y + 3}`;
}).join('');

/** Earth knocked loose as it comes up: where each clod starts, its drift, and when it falls. */
const CLODS: { x: number; y: number; dx: number; delay: number; rx: number }[] = [
  { x: -4, y: -15, dx: -2, delay: 1.5, rx: 1.8 },
  { x: 6, y: -18, dx: 3, delay: 1.8, rx: 1.4 },
  { x: -24, y: -8, dx: -1, delay: 4.0, rx: 1.6 },
  { x: 12, y: -11, dx: 2, delay: 4.3, rx: 1.2 },
  { x: -15, y: -21, dx: -1.5, delay: 4.6, rx: 1 },
];

function Buried() {
  return (
    <g>
      <Curve d={B_RIBS} w={1.5} tone={BONE_FAR} />
      <Curve d="M-13-12L-13 8" w={2.2} tone={BONE_FAR} />
      <Spine d="M-13-12L-15.5-23" w={2.6} />
      <Curve d="M-13-13Q-22-12-31-7M-13-13Q-3-16 6-17.5" w={1.8} />
      <circle cx={-32} cy={-6} r={2.4} fill={BONE_FAR} stroke={BONE_LINE} strokeWidth={0.8} />
      {/* its skull, tipped towards the one pulling, jaw hanging */}
      <g transform="translate(-15 -30) rotate(16) scale(0.8)">
        <SkullFront gape={4} />
      </g>
      {/* the arm held up out of the grave */}
      <g className="gs-reach">
        <LongBone a={B_SHOULDER} b={B_ELBOW} w={3} />
        <Forearm a={B_ELBOW} b={B_WRIST} w={2.4} />
        <Hand at={B_WRIST} dir={heading(B_ELBOW, B_WRIST)} len={7} spread={0.5} curl={0.55} w={0.9} />
        <circle cx={B_SHOULDER[0]} cy={B_SHOULDER[1]} r={2.4} fill={BONE} stroke={BONE_LINE} strokeWidth={0.8} />
      </g>
    </g>
  );
}

function Kneeler() {
  return (
    <g>
      {/* far leg: knee on the ground, shin and toes behind */}
      <LongBone a={[68, -31]} b={[80, -4]} w={3.4} tone={BONE_FAR} />
      <LongBone a={[80, -4]} b={[100, -4]} w={3} tone={BONE_FAR} />
      <Hand at={[100, -4]} dir={0.35} len={7} spread={0.3} curl={0.15} w={0.9} tone={BONE_FAR} />
      {/* the pelvis, side on */}
      <path
        d="M60-33C57-40 61-47 69-47C74-46 77-41 74-35C72-32 69-30 66-29L62-27L60-30Z"
        fill={BONE}
        stroke={BONE_LINE}
        strokeWidth={1}
        strokeLinejoin="round"
      />
      <path d="M62-27.5L61-24L66-25" fill="none" stroke={BONE_LINE} strokeWidth={0.8} />
      <circle cx={65} cy={-32} r={1.8} fill={HOLLOW} />
      {/* near leg: knee up, foot planted at the grave's edge */}
      <LongBone a={[64, -32]} b={[44, -34]} w={3.6} />
      <LongBone a={[44, -34]} b={[42, -5]} w={3.2} />
      <circle cx={42.4} cy={-34.6} r={2} fill={BONE} stroke={BONE_LINE} strokeWidth={0.7} />
      <LongBone a={[44.5, -3.5]} b={[38, -2]} w={2.6} />
      <Hand at={[38, -2]} dir={Math.PI - 0.08} len={7} spread={0.35} curl={-0.12} w={0.9} thumb={-1} />
      {/* the body leans back from the hips and heaves */}
      <g transform={`translate(${HIP[0]} ${HIP[1]}) rotate(${LEAN})`}>
        <g className="gs-heave">
          <LongBone a={K_SHOULDER_FAR} b={K_ELBOW_FAR} w={2.8} tone={BONE_FAR} />
          <Forearm a={K_ELBOW_FAR} b={K_HAND_FAR} w={2.2} tone={BONE_FAR} />
          <Hand at={K_HAND_FAR} dir={heading(K_ELBOW_FAR, K_HAND_FAR)} len={7.5} spread={0.45} curl={0.6} w={0.9} tone={BONE_FAR} />
          <path d="M0.5-48L6-43L3-34Z" fill={BONE_FAR} stroke={BONE_LINE} strokeWidth={0.8} strokeLinejoin="round" />
          <Spine d="M0-2C1.6-12 0.6-22-1-30S-2.6-44-1-51" w={3.2} />
          <Curve d={K_RIBS} w={1.5} />
          <Curve d="M-15-43L-13.6-31" w={2.2} />
          <Curve d="M-1.5-49L-6-46" w={1.6} />
          {/* the skull bows towards the grave and tips back with each heave */}
          <g className="gs-strain">
            <Spine d="M-1-51L-2-57.5" w={2.4} />
            <g transform="translate(-6 -60.5) rotate(-18) scale(0.85)">
              <SkullSide gape={6} />
            </g>
          </g>
          <circle cx={K_SHOULDER_NEAR[0]} cy={K_SHOULDER_NEAR[1]} r={2.3} fill={BONE} stroke={BONE_LINE} strokeWidth={0.8} />
          <LongBone a={K_SHOULDER_NEAR} b={K_ELBOW_NEAR} w={3} />
          <Forearm a={K_ELBOW_NEAR} b={K_HAND_NEAR} w={2.4} />
          <Hand at={K_HAND_NEAR} dir={heading(K_ELBOW_NEAR, K_HAND_NEAR)} len={7.5} spread={0.45} curl={0.6} w={0.95} />
        </g>
      </g>
    </g>
  );
}

function Exhumation() {
  return (
    <g>
      {/* turned earth heaped behind the grave */}
      <path d="M-84-1C-80-14-62-20-46-14C-41-12-38-7-35-3C-44-1-64 1-84-1Z" fill="#170e0a" stroke="#0a0605" strokeWidth={0.8} />
      <path d="M-74-8l3-1M-62-15l2 0M-54-10l3 1M-44-9l2-1" stroke="#2a1a11" strokeWidth={1.4} strokeLinecap="round" />
      {/* the open grave: black inside, its far wall faintly lit */}
      <path d="M-46-2C-46-12.7 34-12.7 34-2C34 8.7-46 8.7-46-2Z" fill="#020101" />
      <path d="M-45-3.5C-44-11.5 33-11.5 33-3.5" fill="none" stroke="#1a100b" strokeWidth={1.6} />
      <g className="gs-risen">
        <Buried />
      </g>
      {CLODS.map((c, i) => (
        <ellipse
          key={i}
          className="gs-clod"
          cx={c.x}
          cy={c.y}
          rx={c.rx}
          ry={r1(c.rx * 0.75)}
          fill="#2a1a11"
          stroke="#0c0705"
          strokeWidth={0.4}
          style={{ animationDelay: `${c.delay}s`, ['--dx' as string]: `${c.dx}px` }}
        />
      ))}
      {/* the near lip of the grave, the colour of the ground, hides the rest of the body */}
      <path d="M-46-2C-46 8.7 34 8.7 34-2C37 6 30 16-6 17C-42 16-49 6-46-2Z" fill="#060404" />
      <path
        d="M-46-2C-46 8.7 34 8.7 34-2"
        fill="none"
        stroke="#25170f"
        strokeWidth={1.8}
        strokeDasharray="3 1.4 1.2 2"
        strokeLinecap="round"
      />
      <Kneeler />
    </g>
  );
}

/* ---------------------------------------------------------------------------------------
 * The crawler: a skeleton with no legs, pulling itself along on its elbows, face first.
 * Local units, ground at y = 0, facing left; the skull is near x = 0, the pelvis near x = 60.
 * ------------------------------------------------------------------------------------- */

const C_SHOULDER: Pt = [16, -16];
const C_ELBOW: Pt = [6, -2];
const C_WRIST: Pt = [-18, -2];

/** Ribs hanging from the spine down towards the ground; the last two are short. */
const C_RIBS = Array.from({ length: 7 }, (_, i) => {
  const x = 15 + i * 3.7;
  const y = -18 - Math.sin((i / 6) * Math.PI) * 1.2;
  return i < 5
    ? `M${r1(x)} ${r1(y)}C${r1(x + 3.5)} ${r1(y + 1)} ${r1(x + 2.5)} ${r1(y + 9)} ${r1(x - 2.5)} ${r1(y + (i === 3 ? 9 : 13))}`
    : `M${r1(x)} ${r1(y)}C${r1(x + 3)} ${r1(y + 1)} ${r1(x + 2.5)} ${r1(y + 6)} ${r1(x + 0.5)} ${r1(y + 8)}`;
}).join('');

/** One arm: the upper arm turns at the shoulder, the forearm at the elbow (see backdrop.css). */
function CrawlArm({ far }: { far?: boolean }) {
  const tone = far ? BONE_FAR : BONE;
  return (
    <g className={far ? 'gs-arm gs-arm-far' : 'gs-arm'} transform={far ? 'translate(3 -1.5)' : undefined}>
      <g className="gs-arm-upper">
        <LongBone a={C_SHOULDER} b={C_ELBOW} w={2.8} tone={tone} />
        <g className="gs-arm-fore">
          <Forearm a={C_ELBOW} b={C_WRIST} w={2.2} tone={tone} />
          <Hand at={C_WRIST} dir={Math.PI - 0.15} len={8} spread={0.5} curl={-0.3} w={0.9} tone={tone} thumb={-1} />
        </g>
        <circle cx={C_SHOULDER[0]} cy={C_SHOULDER[1]} r={2.2} fill={tone} stroke={BONE_LINE} strokeWidth={0.8} />
      </g>
    </g>
  );
}

function Crawler() {
  return (
    <g className="gs-body">
      <CrawlArm far />
      {/* what is left below the ribs: the lower spine and the pelvis, dragged behind */}
      <g className="gs-drag">
        <Spine d="M40-17C46-16 51-14 56-12" w={3} />
        <path
          d="M51-13C50-21 57-25 64-22C68-20 68-14 65-10L58-7C55-8 52-10 51-13Z"
          fill={BONE}
          stroke={BONE_LINE}
          strokeWidth={1}
          strokeLinejoin="round"
        />
        <circle cx={60} cy={-9.5} r={1.7} fill={HOLLOW} />
        <Curve d="M58-7L61-2.5L67-3.5L65-9" w={1.5} />
        <Spine d="M64-14L69-10.5L73-8.5" w={1.8} />
      </g>
      <Spine d="M10-15.5C17-19 29-20 40-17" w={3.2} />
      <Curve d={C_RIBS} w={1.4} />
      <Curve d="M12-5C18-4.5 24-4.5 29-5.5" w={1.8} />
      <path d="M13-19L25-22.5L21-15.5Z" fill={BONE} stroke={BONE_LINE} strokeWidth={0.8} strokeLinejoin="round" />
      <g className="gs-crawl-head">
        <Spine d="M8.5-15L11-16" w={2.4} />
        <g transform="translate(5.5 -19) rotate(-6) scale(0.8)">
          <SkullSide gape={14} />
        </g>
      </g>
      <CrawlArm />
    </g>
  );
}

/** Where the figures go, in the graveyard canvas's own units. */
type Layout = { pull: number; from: number; to: number; show: boolean };

/**
 * The canvas is drawn right-aligned and cropped (object-fit: cover), so how much of it shows
 * depends on the window. The exhumation goes about a fifth of the way into what shows; the
 * crawler starts just short of the lantern and crosses a quarter of the width towards it.
 */
function place(box: DOMRect, lantern: DOMRect | null, w: number, h: number): Layout {
  const k = Math.max(box.width / w, box.height / h) || 1;
  const shown = Math.min(w, box.width / k);
  const pull = r1(w - shown + shown * 0.18);
  const lx = lantern ? w - (box.right - (lantern.left + lantern.width / 2)) / k : w * 0.82;
  const half = ((lantern ? lantern.width : 300) * 0.42) / k;
  const from = r1(Math.min(w - 100, lx - half - 110));
  const to = r1(Math.max(pull + 170, from - shown * 0.25));
  return { pull, from, to, show: from - to >= 120 };
}

/** The layout for a 1600-wide window, used until the real one is measured. */
const FIRST: Layout = { pull: 288, from: 1014, to: 614, show: true };

/**
 * Two skeletons among the graves at the bottom of the haunted shop, over the painted
 * graveyard: on the left one hauls another out of its grave by the arm, on the right one with
 * no legs drags itself along on its elbows. The SVG has the same box, viewBox and cropping as
 * the graveyard canvas, so they stay on its ground at any width. Decorative (aria-hidden).
 */
export function GraveSkeletons({ w, h, pumpkin }: { w: number; h: number; pumpkin: RefObject<HTMLDivElement | null> }) {
  const still = useStill();
  const svg = useRef<SVGSVGElement>(null);
  const pullAt = useRef<SVGGElement>(null);
  const crawl = useRef<SVGGElement>(null);
  useEffect(() => {
    const s = svg.current;
    if (!s) return;
    const apply = () => {
      const box = s.getBoundingClientRect();
      if (box.width === 0) return;
      const at = place(box, pumpkin.current?.getBoundingClientRect() ?? null, w, h);
      pullAt.current?.setAttribute('transform', `translate(${at.pull} ${PULL_Y}) scale(${SCALE})`);
      const c = crawl.current;
      if (!c) return;
      c.style.setProperty('--crawl-from', `${at.from}px`);
      c.style.setProperty('--crawl-to', `${at.to}px`);
      c.style.setProperty('--crawl-mid', `${r1((at.from + at.to) / 2)}px`);
      // On a phone there is no room for it between the grave and the lantern.
      c.style.display = at.show ? '' : 'none';
    };
    const frame = requestAnimationFrame(apply);
    let timer = 0;
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(apply, 250);
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }, [w, h, pumpkin]);
  return (
    <svg
      ref={svg}
      className="grave-bones"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMaxYMax slice"
      aria-hidden="true"
      focusable="false"
      data-still={still}
      data-testid="grave-bones"
    >
      <g ref={pullAt} transform={`translate(${FIRST.pull} ${PULL_Y}) scale(${SCALE})`}>
        <Exhumation />
      </g>
      <g transform={`translate(0 ${CRAWL_Y})`}>
        <g
          ref={crawl}
          className="gs-crawl"
          style={{
            ['--crawl-from' as string]: `${FIRST.from}px`,
            ['--crawl-to' as string]: `${FIRST.to}px`,
            ['--crawl-mid' as string]: `${(FIRST.from + FIRST.to) / 2}px`,
          }}
        >
          <g transform={`scale(${SCALE})`}>
            <Crawler />
          </g>
        </g>
      </g>
    </svg>
  );
}
