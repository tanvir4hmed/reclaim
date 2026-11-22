import type { ProductId } from '../core';
import { fx } from '../fx/fxStore';
import { dispatch, useStory, useUi } from '../store';
import { nav } from './bridge';
import { footprintPath, seeded, type Print } from './footprints';
import { pageCenter, playLight, reducedMotion, wait } from './runtime';

const cartedAt: Partial<Record<ProductId, number>> = {};

/** When a product's Consequence last played this session (the typewriter's last line). */
export function cartedTime(id: ProductId): number | null {
  return cartedAt[id] ?? null;
}

let markSeq = 0;
function mark(kind: string, x: number, y: number, rotation = 0, scale = 1, product: ProductId | null = null) {
  markSeq += 1;
  dispatch({ type: 'MARK_ADDED', mark: { id: `${kind}-${Date.now()}-${markSeq}`, kind, x, y, rotation, scale, product } });
}

function card(id: ProductId): HTMLElement | null {
  return document.querySelector(`.card[data-product="${id}"]`);
}

async function flag(name: string, ms: number) {
  fx().flag(name);
  await wait(ms);
  fx().unflag(name);
}

/** A wandering walk across the visible page: from `start` through random points, never resting. */
function wanderPath(start: { x: number; y: number }, rand: () => number, legs: number): Print[] {
  const prints: Print[] = [];
  let from = start;
  for (let i = 0; i < legs; i++) {
    const to = {
      x: window.scrollX + 60 + rand() * (window.innerWidth - 120),
      y: window.scrollY + 90 + rand() * (window.innerHeight - 160),
    };
    // Big prints, a child's stride.
    prints.push(...footprintPath(from, to, rand, 64, 15));
    from = to;
  }
  return prints;
}

let shoesWalking = false;

/**
 * Shoes (Requirement 13.3–13.4, revised): the moment they are taken, bloody prints walk out of
 * the card and wander the page, turning at random. Long after, they start again from where
 * they stopped, now and then, for as long as the shop is haunted.
 */
async function shoes() {
  const from = card('shoes');
  if (!from) return;
  const rand = seeded(Date.now() & 0xffff);
  let prints = wanderPath(pageCenter(from), rand, 3);
  fx().set({ prints: reducedMotion() ? prints.slice(-6) : prints });
  // Hold the Stage while they first walk; the prints fade on their own afterwards.
  await wait(Math.min(9000, prints.length * 220) + 600);
  for (const p of prints.slice(-2)) mark(p.foot === 'left' ? 'footprint' : 'footprint-r', p.x, p.y, p.angle, 1, 'shoes');
  if (shoesWalking || reducedMotion()) return;
  shoesWalking = true;
  void (async () => {
    while (useStory.getState().story.phase === 'haunted') {
      await wait(14000 + rand() * 18000);
      if (useStory.getState().story.phase !== 'haunted') break;
      const last = prints[prints.length - 1];
      const start = last && Math.abs(last.y - (window.scrollY + window.innerHeight / 2)) < window.innerHeight ? last : { x: window.scrollX + window.innerWidth * rand(), y: window.scrollY + window.innerHeight * 0.9 };
      prints = wanderPath(start, rand, 2);
      fx().set({ prints });
    }
    shoesWalking = false;
  })();
}

async function telephone() {
  fx().set({ cartRinging: true });
  document.documentElement.classList.add('tags-tremble');
  await wait(3500);
  document.documentElement.classList.remove('tags-tremble');
  await wait(16500);
  fx().set({ cartRinging: false });
}

async function teddy() {
  const c = card('teddy-bear');
  const footer = document.querySelector('.site-footer');
  if (!c || !footer) return;
  await flag('stuffing-fall', reducedMotion() ? 400 : 2600);
  const f = footer.getBoundingClientRect();
  for (let i = 0; i < 6; i++) {
    mark('stuffing', f.left + window.scrollX + 40 + i * (f.width / 7) + (i % 2) * 20, f.top + window.scrollY + 4, 0, 0.8 + (i % 3) * 0.3, 'teddy-bear');
  }
}

async function advent() {
  // Every door slams shut, and every open drawer or quick view with it (Tier A).
  useUi.getState().setCartOpen(false);
  useUi.getState().setFiltersOpen(false);
  if (window.location.pathname.startsWith('/product/')) nav.go(`/${window.location.search}`);
  await flag('doors-slam', 2200);
}

async function camera() {
  if (!reducedMotion()) await playLight([{ t: 0, level: 1 }, { t: 40, level: 0.15 }, { t: 900, level: 1 }]);
  await flag('camera-flash', 600);
}

async function musicBox() {
  fx().set({ quiet: true });
  await wait(1300);
  fx().set({ quiet: false });
}

/** Shows the product's Take scare (fx/scares) for `ms`, alongside its lasting effect. */
function scare(id: ProductId, ms: number) {
  return flag(`scare-${id}`, ms);
}

/** Runs the lasting effect and the scare together; the Stage is held until both end. */
function withScare(id: ProductId, ms: number, run?: () => Promise<void>): () => Promise<void> {
  return async () => {
    await Promise.all([run ? run() : Promise.resolve(), scare(id, ms)]);
  };
}

/** Centre of a product's object on screen (the card's picture, or the product view if open). */
function objectCentre(id: ProductId): { x: number; y: number } | null {
  let best: DOMRect | null = null;
  for (const el of document.querySelectorAll<HTMLElement>(`[data-object="${id}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width < 80 || r.bottom < 0 || r.top > window.innerHeight) continue;
    if (!best || r.width > best.width) best = r;
  }
  return best ? { x: best.left + best.width / 2, y: best.top + best.height / 2 } : null;
}

/**
 * The instant a product is taken after the Reveal, something happens to the object itself, in
 * its own picture (the model reacts to `played`, see each products/<id>/Model). These are the
 * parts that reach beyond the picture: footprints, the dark, the bat that gets out.
 */
const CONSEQUENCES: Partial<Record<ProductId, () => Promise<void>>> = {
  // Shoes: bloody prints walk out of the card and keep wandering the page.
  shoes,
  // The watch whips its hands backward, hours in a second, then runs backward for good.
  'pocket-watch': () => flag('watch-shudder', 1600),
  doll: () => flag('doll-look', 2000),
  mirror: () => flag('mirror-face', 4000),
  // The envelope opens; her photograph and "YOU KILLED ME" slide out (in the model).
  letter: () => flag('letter-carted', 2500),
  // It stops typing; KILL ME seeps into the paper in blood (in the model).
  typewriter: () => flag('typewriter-carted', 3000),
  // She is standing in the middle of the family (in the model).
  'photo-frame': () => flag('photo-shift', 3000),
  // One bite, far too wide; the fly leaves for the search bar.
  cake: async () => {
    fx().set({ flyPerch: '#site-search' });
    await flag('fly-takeoff', 1800);
  },
  telephone,
  // Today is crossed out on the calendar (in the model); every door slams shut.
  'advent-calendar': advent,
  // He snaps in two at 90 degrees (in the model); the others march off the footer.
  'tin-soldier': () => flag('soldiers-march', reducedMotion() ? 800 : 7000),
  // Someone unseen tunes it, station by station, to the red mark (in the model); roll call.
  'valve-radio': () => flag('roll-call', 4000),
  'instant-camera': withScare('instant-camera', 4000, camera),
  // The lid blows off: a skull with burning eyes; the bat shut in with it gets out.
  'unopened-gift': giftBat,
  // It starts rocking on its own and never stops (in the model).
  'rocking-chair': () => flag('chair-rock', 1500),
  // It bursts: springs and gears fly out like fireworks (in the model).
  'music-box': musicBox,
  // Blood soaks out of its belly and runs down (in the model); stuffing falls to the footer.
  'teddy-bear': teddy,
  // Her reflection is in it the instant you take it.
  'glass-ornament': withScare('glass-ornament', 3400),
  // It goes out, and so does everything else: only the candle is left, barely.
  candle: () => flag('candle-dark', reducedMotion() ? 3000 : 7000),
  // A black ghost is trapped inside, throwing itself at the glass (in the model).
  'snow-globe': () => flag('globe-ghost', 1500),
  'childs-drawing': withScare('childs-drawing', 3800),
  // Every truffle is a small head now (in the model).
  'chocolate-box': () => flag('heads', 1500),
};

/** The gift: the lid blows off and a bat that was shut in the box bursts out of the card. */
async function giftBat() {
  const at = objectCentre('unopened-gift');
  if (at && !reducedMotion()) fx().set({ freeBat: { ...at, id: Date.now() } });
  await wait(2600);
  fx().set({ freeBat: null });
}

export async function playConsequence(id: ProductId): Promise<void> {
  cartedAt[id] = Date.now();
  const run = CONSEQUENCES[id];
  fx().set({ playing: id });
  try {
    if (run) await run();
  } finally {
    fx().set({ playing: null });
  }
}

/** A short reminder when a lasting Consequence was already played (Requirement 12.4). */
export async function playReminder(id: ProductId): Promise<void> {
  await flag(`remind-${id}`, 900);
}
