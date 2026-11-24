import type { ProductId } from '../core';
import { fx } from '../fx/fxStore';
import { reducedMotion, wait } from './runtime';
import { markWatchTaken } from '../products/pocket-watch/watchClock';
import { CAMERA } from '../products/small/cameraTiming';

const cartedAt: Partial<Record<ProductId, number>> = {};

/** When a product's Consequence last played this session (the typewriter's last line). */
export function cartedTime(id: ProductId): number | null {
  return cartedAt[id] ?? null;
}

async function flag(name: string, ms: number) {
  fx().flag(name);
  await wait(ms);
  fx().unflag(name);
}

/** Shoes: the prints are drawn in the shoe picture itself (fx/ShoePrints); hold the Stage while they walk. */
const shoes = () => (reducedMotion() ? Promise.resolve() : wait(6200));

async function telephone() {
  fx().set({ cartRinging: true });
  document.documentElement.classList.add('tags-tremble');
  await wait(3500);
  document.documentElement.classList.remove('tags-tremble');
  await wait(16500);
  fx().set({ cartRinging: false });
}

/** The candle goes out: its smoke rises into a ghost and is gone (in the model); the light dims. */
async function candle() {
  const inView = () => document.querySelector('dialog[open]') !== null;
  // Taken in the product view: the view stays dim until it is closed. On the shelf the card
  // dims for good instead (ObjectBox). The smoke ghost is in the model.
  if (inView()) {
    fx().flag('candle-dark');
    void (async () => {
      while (inView()) await wait(150);
      fx().unflag('candle-dark');
    })();
  }
  await wait(reducedMotion() ? 0 : 5000);
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
  // long enough for the skull to leave its spring (0.45 s) and fly past you (1.4 s more)
  await scare('music-box', 2100);
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
  // Shoes: blood seeps from under them and seven prints walk off, inside their own picture.
  shoes,
  // The watch whips its hands backward, hours in a second, then runs backward for good.
  // Every hand whips back to ten to three; from then on it runs backward (in the model).
  'pocket-watch': () => {
    markWatchTaken();
    return flag('watch-shudder', 1600);
  },
  doll: () => flag('doll-look', 2000),
  mirror: () => flag('mirror-face', 4000),
  // The seal breaks, the flap opens; the letter rises with her photograph and "REMEMBER ME?" (in the model).
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
  // It goes out; its smoke becomes a ghost and drifts away; the light it gave is gone.
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
