/** The Featured products (Requirements 13–21); the last one carted is the one left behind. */
export const FEATURED_IDS = [
  'shoes',
  'pocket-watch',
  'doll',
  'letter',
  'typewriter',
  'mirror',
  'photo-frame',
  'telephone',
] as const;

/** Tier A products from the creative direction (Requirement 39). */
export const TIER_A_IDS = [
  'advent-calendar',
  'television',
  'instant-camera',
  'unopened-gift',
  'rocking-chair',
  'hourglass',
  'sleigh',
  'oil-lamp',
] as const;

/** Other shop products with anomalies (Requirement 32). */
export const AMBIENT_IDS = [
  'snow-globe',
  'chocolate-box',
  'music-box',
  'candle',
  'teddy-bear',
  'jack-in-the-box',
  'nutcracker',
] as const;

/** Products that only appear in the Haunted state (Requirement 32.8). */
export const EXTRA_IDS = ['childs-drawing'] as const;

export const PRODUCT_IDS = [...FEATURED_IDS, ...TIER_A_IDS, ...AMBIENT_IDS, ...EXTRA_IDS] as const;

export type ProductId = (typeof PRODUCT_IDS)[number];
export type FeaturedId = (typeof FEATURED_IDS)[number];

const productSet: ReadonlySet<string> = new Set(PRODUCT_IDS);
const featuredSet: ReadonlySet<string> = new Set(FEATURED_IDS);

export function isProductId(value: unknown): value is ProductId {
  return typeof value === 'string' && productSet.has(value);
}

export function isFeatured(id: ProductId): id is FeaturedId {
  return featuredSet.has(id);
}

/** Products whose Add to Cart in the Haunted state plays a Consequence: all of them. */
export const CONSEQUENCE_IDS: ReadonlySet<ProductId> = new Set<ProductId>(PRODUCT_IDS);
