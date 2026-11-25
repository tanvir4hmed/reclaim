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
  'telephone',
  'advent-calendar',
  'valve-radio',
  'instant-camera',
  'unopened-gift',
  'rocking-chair',
  'hourglass',
  'sleigh',
  'oil-lamp',
  'snow-globe',
  'chocolate-box',
  'music-box',
  'candle',
  'teddy-bear',
  'jack-in-the-box',
  'nutcracker',
  'childs-drawing',
] as const;

export const CONDITIONS = ['haunted', 'taken'] as const;
