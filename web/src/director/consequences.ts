import type { ProductId } from '../core';
import { fx } from '../fx/fxStore';
import { dispatch, useUi } from '../store';
import { nav } from './bridge';
import { footprintPath, seeded } from './footprints';
import { pageCenter, playLight, reducedMotion, wait } from './runtime';

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
  const prints = footprintPath(a, { x: b.x, y: b.y + 18 }, seeded(Date.now() & 0xffff));
  if (reducedMotion()) {
    fx().set({ prints: prints.slice(-6) });
  } else {
    fx().set({ prints });
  }
  await wait(Math.min(9000, prints.length * 220) + 1500);
  const last = prints.slice(-2);
  for (const p of last) mark(p.foot === 'left' ? 'footprint' : 'footprint-r', p.x, p.y, p.angle, 1, 'shoes');
  await wait(8000);
  fx().set({ prints: [] });
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

const CONSEQUENCES: Partial<Record<ProductId, () => Promise<void>>> = {
  shoes,
  'pocket-watch': () => flag('watch-shudder', 1600),
  doll: () => flag('doll-look', 2000),
  letter: () => flag('letter-carted', 2500),
  typewriter: () => flag('typewriter-carted', 3000),
  mirror: () => flag('mirror-face', 4000),
  'photo-frame': () => flag('photo-shift', 3000),
  cake: async () => {
    fx().set({ flyPerch: '#site-search' });
    await flag('fly-takeoff', 1800);
  },
  telephone,
  'advent-calendar': advent,
  'tin-soldier': () => flag('soldiers-march', reducedMotion() ? 800 : 7000),
  'valve-radio': () => flag('roll-call', 3000),
  'instant-camera': camera,
  'unopened-gift': () => flag('gift-heavy', 1500),
  mittens: () => flag('mitten-gone', 1500),
  'music-box': musicBox,
  'teddy-bear': teddy,
};

export async function playConsequence(id: ProductId): Promise<void> {
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
