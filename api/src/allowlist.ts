/**
 * Product and condition ids the Echo service accepts (Requirement 24.4). Kept in step with
 * web/src/core/ids.ts; the API test checks the two lists match.
 */
export const PRODUCTS = [
  'shoes',
  'pocket-watch',
  'doll',
  'letter',
  'typewriter',
  'mirror',
  'photo-frame',
  'cake',
  'telephone',
  'advent-calendar',
  'tin-soldier',
  'valve-radio',
  'instant-camera',
  'unopened-gift',
  'rocking-chair',
  'snow-globe',
  'chocolate-box',
  'music-box',
  'glass-ornament',
  'candle',
  'teddy-bear',
  'childs-drawing',
] as const;

export const CONDITIONS = ['haunted', 'taken'] as const;
