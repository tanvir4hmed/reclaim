/** The nine Featured products (Requirements 13–21). */
export const FEATURED_IDS = [
  'shoes',
  'pocket-watch',
  'doll',
  'letter',
  'typewriter',
  'mirror',
  'photo-frame',
  'cake',
  'telephone',
] as const;

/** Tier A products from the creative direction (Requirement 39). */
export const TIER_A_IDS = [
  'advent-calendar',
  'tin-soldier',
  'valve-radio',
  'instant-camera',
  'unopened-gift',
  'mittens',
] as const;

/** Other shop products with anomalies (Requirement 32). */
export const AMBIENT_IDS = [
  'snow-globe',
  'chocolate-box',
  'music-box',
  'glass-ornament',
  'candle',
  'teddy-bear',
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
