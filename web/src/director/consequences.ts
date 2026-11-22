import type { ProductId } from '../core';
import { fx } from '../fx/fxStore';
import { dispatch, useUi } from '../store';
import { nav } from './bridge';
import { footprintPath, seeded } from './footprints';
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

function cartIcon(): HTMLElement | null {
  return document.querySelector('[data-testid="cart-icon"]');
}

async function flag(name: string, ms: number) {
  fx().flag(name);
  await wait(ms);
  fx().unflag(name);
}

/** Shoes: an invisible walker's prints from the card to the cart (Requirement 13.3–13.4). */
async function shoes() {
  const from = card('shoes');
  const to = cartIcon();
  if (!from || !to) return;
  const a = pageCenter(from);
  const b = pageCenter(to);
  // Big prints, a child's stride, walking right up to your cart.
  const prints = footprintPath(a, { x: b.x, y: b.y + 30 }, seeded(Date.now() & 0xffff), 64, 15);
  if (reducedMotion()) {
    fx().set({ prints: prints.slice(-6) });
  } else {
    fx().set({ prints });
  }
  // Hold the Stage only while the walker is walking; the prints fade on their own afterwards.
  await wait(Math.min(6000, prints.length * 220) + 600);
  const last = prints.slice(-2);
  for (const p of last) mark(p.foot === 'left' ? 'footprint' : 'footprint-r', p.x, p.y, p.angle, 1, 'shoes');
  void wait(9000).then(() => fx().set({ prints: [] }));
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

const CONSEQUENCES: Partial<Record<ProductId, () => Promise<void>>> = {
  // Shoes: the prints walk to your cart; then the steps stop right behind you.
  shoes: async () => {
    await shoes();
    await scare('shoes', 3600);
  },
  'pocket-watch': withScare('pocket-watch', 4000, () => flag('watch-shudder', 1600)),
  // The doll and the mirror already do it in their models.
  doll: () => flag('doll-look', 2000),
  mirror: () => flag('mirror-face', 4000),
  letter: withScare('letter', 4200, () => flag('letter-carted', 2500)),
  typewriter: withScare('typewriter', 4600, () => flag('typewriter-carted', 3000)),
  'photo-frame': withScare('photo-frame', 3600, () => flag('photo-shift', 3000)),
  cake: withScare('cake', 3000, async () => {
    fx().set({ flyPerch: '#site-search' });
    await flag('fly-takeoff', 1800);
  }),
  // The phone rings in the cart for a long time; the scare is only its first moment.
  telephone: async () => {
    void scare('telephone', 2200);
    await telephone();
  },
  'advent-calendar': withScare('advent-calendar', 3400, advent),
  'tin-soldier': withScare('tin-soldier', 3400, () => flag('soldiers-march', reducedMotion() ? 800 : 7000)),
  'valve-radio': withScare('valve-radio', 4400, () => flag('roll-call', 3000)),
  'instant-camera': withScare('instant-camera', 4000, camera),
  'unopened-gift': withScare('unopened-gift', 3000, () => flag('gift-heavy', 1500)),
  mittens: withScare('mittens', 3600, () => flag('mitten-gone', 1500)),
  'music-box': withScare('music-box', 3600, musicBox),
  'teddy-bear': withScare('teddy-bear', 4000, teddy),
  'glass-ornament': withScare('glass-ornament', 3400),
  candle: withScare('candle', 3400),
  'snow-globe': withScare('snow-globe', 3400),
  'childs-drawing': withScare('childs-drawing', 3800),
  'chocolate-box': withScare('chocolate-box', 3200),
};

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
