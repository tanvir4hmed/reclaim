import type { ProductId } from '../core';
import { fx } from '../fx/fxStore';
import { dispatch } from '../store';
import { footprintPath, seeded, type Print } from './footprints';
import { reducedMotion, wait } from './runtime';
import { markWatchTaken } from '../products/pocket-watch/watchClock';
import { CAMERA } from '../products/small/cameraTiming';

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

/** A wandering walk inside `area` (page coordinates): from `start` through random points. */
function wanderPath(start: { x: number; y: number }, area: DOMRect, rand: () => number, legs: number, stride: number): Print[] {
  const prints: Print[] = [];
  let from = start;
  const pad = Math.min(50, area.width * 0.15);
  for (let i = 0; i < legs; i++) {
    const to = {
      x: area.left + window.scrollX + pad + rand() * (area.width - pad * 2),
      y: area.top + window.scrollY + pad + rand() * (area.height - pad * 2),
    };
    prints.push(...footprintPath(from, to, rand, stride, stride * 0.24));
    from = to;
  }
  // The walk jitters its heading, so a print can stray past the edge; keep every one (with
  // room for its heel and smear) inside the area. A print off the side of a phone screen
  // widens the page, and the whole haunted shop re-lays out and repaints.
  const m = Math.min(28, area.width / 4);
  const x0 = area.left + window.scrollX + m;
  const x1 = area.right + window.scrollX - m;
  const y0 = area.top + window.scrollY + m;
  const y1 = area.bottom + window.scrollY - m;
  return prints.map((p) => ({ ...p, x: Math.min(x1, Math.max(x0, p.x)), y: Math.min(y1, Math.max(y0, p.y)) }));
}

/** Time between one print and the next (kept in step with the `.print` animation delays). */
const PRINT_MS = 220;

/** The prints walked so far become lasting marks, exactly where they are. */
function keepPrints(prints: readonly Print[]) {
  for (const p of prints) mark(p.foot === 'left' ? 'footprint' : 'footprint-r', p.x, p.y, p.angle, 1, 'shoes');
  fx().set({ prints: [] });
}

/**
 * Shoes (Requirement 13.3–13.4, revised again): the moment they are taken, bloody prints walk
 * out of the boots, round and round inside the window they were taken in (the product view,
 * or the card on the shelf). Close the view and they stop where they are: what they walked
 * stays, exactly as far as it got, and no more appear.
 */
async function shoes() {
  const view = document.querySelector<HTMLDialogElement>('dialog.product-view[open]');
  const box = (view ?? card('shoes'))?.getBoundingClientRect();
  if (!box) return;
  const seen = objectCentre('shoes');
  const start = seen
    ? { x: seen.x + window.scrollX, y: seen.y + window.scrollY }
    : { x: box.left + box.width / 2 + window.scrollX, y: box.top + box.height / 2 + window.scrollY };
  const rand = seeded(Date.now() & 0xffff);
  const prints = view ? wanderPath(start, box, rand, 4, 60) : wanderPath(start, box, rand, 2, 40);
  fx().set({ prints });
  const t0 = performance.now();
  const walk = prints.length * PRINT_MS + 300;
  const shown = () => (reducedMotion() ? prints.length : Math.min(prints.length, Math.floor((performance.now() - t0) / PRINT_MS) + 1));
  // The Stage is held while they walk.
  while (performance.now() - t0 < walk && !reducedMotion()) {
    if (view && !view.open) {
      keepPrints(prints.slice(0, shown()));
      return;
    }
    await wait(120);
  }
  if (!view) {
    keepPrints(prints);
    return;
  }
  // Walked out, in the open view: they stay drawn over it until it closes, then stay on the page.
  void (async () => {
    while (view.open && view.isConnected) await wait(200);
    keepPrints(prints);
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

/**
 * The candle goes out and the window goes black; the flame is the pointer now. Taken in the
 * product view, it stays dark until that view is closed; taken from the shop, for a while.
 * Then the light comes back. The Stage is only held for the first seconds either way.
 */
async function candle() {
  const inView = () => document.querySelector('dialog[open]') !== null;
  const held = inView();
  fx().flag('candle-dark');
  const end = (async () => {
    if (held) while (inView()) await wait(150);
    else await wait(reducedMotion() ? 3000 : 7000);
    fx().unflag('candle-dark');
    await flag('candle-back', 900);
  })();
  await Promise.race([end, wait(reducedMotion() ? 3000 : 7000)]);
}

/** Every door on the shelves slams shut; the calendar's own view stays open to watch (Tier A). */
async function advent() {
  await flag('doors-slam', 2200);
}

/** The camera turns to you (in the model), then flashes once; the print comes out after. */
async function camera() {
  await wait(reducedMotion() ? 0 : CAMERA.flashAt * 1000);
  await Promise.all([flag('camera-flash', 600), scare('instant-camera', 600)]);
  await wait(reducedMotion() ? 0 : (CAMERA.printFrom + CAMERA.printFor - CAMERA.flashAt) * 1000 - 600);
}

/** The music stops dead; the skulls come out, and the biggest one comes at you. */
async function musicBox() {
  fx().set({ quiet: true });
  await scare('music-box', 1500);
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
  // Every hand whips back to ten to three; from then on it runs backward (in the model).
  'pocket-watch': () => {
    markWatchTaken();
    return flag('watch-shudder', 1600);
  },
  doll: () => flag('doll-look', 2000),
  mirror: () => flag('mirror-face', 4000),
  // The envelope opens; her photograph and "YOU KILLED ME" slide out (in the model).
  letter: () => flag('letter-carted', 3200),
  // It stops typing; "Please, Help!!" seeps into the paper in blood (in the model).
  typewriter: () => flag('typewriter-carted', 3000),
  // She is standing in the middle of the family (in the model).
  'photo-frame': () => flag('photo-shift', 3000),
  // One bite, far too wide; the fly leaves for the search bar.
  cake: async () => {
    fx().set({ flyPerch: '#site-search' });
    await flag('fly-takeoff', 2000);
  },
  telephone,
  // Today is crossed out on the calendar (in the model); every door slams shut.
  'advent-calendar': advent,
  // He snaps in two at 90 degrees (in the model); the others march off the footer.
  'tin-soldier': () => flag('soldiers-march', reducedMotion() ? 800 : 7000),
  // Someone unseen tunes it, station by station, to the red mark (in the model); roll call.
  'valve-radio': () => flag('roll-call', 4000),
  // It turns to look at you, flashes once, and prints the picture (in the model).
  'instant-camera': camera,
  // The lid blows off: a skull with burning eyes; the bat shut in with it gets out.
  'unopened-gift': giftBat,
  // It starts rocking on its own and never stops (in the model).
  'rocking-chair': () => flag('chair-rock', 1500),
  // It bursts: springs and gears fly out like fireworks (in the model).
  'music-box': musicBox,
  // A sword stroke flashes across the window; its head comes off and falls (in the model).
  'teddy-bear': withScare('teddy-bear', 2400),
  // She is inside the bauble the instant you take it (in the model).
  'glass-ornament': () => flag('ornament-ghost', 1500),
  // It goes out, and so does everything else: only the candle is left, barely.
  candle,
  // A black ghost is trapped inside, throwing itself at the glass (in the model).
  'snow-globe': () => flag('globe-ghost', 1500),
  'childs-drawing': withScare('childs-drawing', 3800),
  // Every truffle is a tiny skull now, face up in its cup, bloody (in the model).
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
