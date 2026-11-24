import type { ProductId } from '../core/ids';

export type CategoryId = 'gifts' | 'toys' | 'sweets' | 'letters' | 'keepsakes';

export interface Category {
  id: CategoryId;
  day: string;
  haunted: string;
}

/** Day names on top, Haunted names below (Requirement 40: renamed menu). */
export const CATEGORIES: readonly Category[] = [
  { id: 'gifts', day: 'Gifts', haunted: 'Belongings' },
  { id: 'toys', day: 'Toys', haunted: "Children's" },
  { id: 'sweets', day: 'Sweets', haunted: 'Leftovers' },
  { id: 'letters', day: 'Letters', haunted: 'Unsent' },
  { id: 'keepsakes', day: 'Keepsakes', haunted: 'Unclaimed' },
];

export interface DayCopy {
  name: string;
  blurb: string;
  /** Price in US cents. */
  price: number;
  /** Struck-through "was" price in cents, for the starburst discount. */
  was?: number;
  /** False scarcity badge, e.g. "Only 1 left" (named on the receipt). */
  stock?: number;
}

export interface HauntedCopy {
  name: string;
  blurb: string;
  /** What it costs now, in words (Requirement 2.4). */
  price: string;
  /** The same cost in hours of the buyer's life, so cart totals add up. */
  hours: number;
}

export interface ProductMeta {
  id: ProductId;
  category: CategoryId;
  /** Hidden from the Day catalog; joins only through the haunted search (Requirement 32.8). */
  hiddenByDay?: boolean;
  rating: number;
  reviews: number;
  day: DayCopy;
  haunted: HauntedCopy;
}

/**
 * Catalog order is the "Featured" sort and the grid's stable order (Requirement 4.5).
 * Day copy must read as ordinary sales copy with a phrase that turns after the Reveal (Requirement 2.2).
 */
export const CATALOG: readonly ProductMeta[] = [
  {
    id: 'pocket-watch',
    category: 'keepsakes',
    rating: 5,
    reviews: 214,
    day: {
      name: 'Heirloom Pocket Watch',
      blurb: 'Wind it once and it keeps his time for good. Engraved case, ready for a name.',
      price: 12900,
      was: 18900,
      stock: 1,
    },
    haunted: {
      name: 'Stopped Pocket Watch',
      blurb: 'It still keeps your time, to the second. The engraving has been scratched out.',
      price: 'One hour, every night',
      hours: 365,
    },
  },
  {
    id: 'doll',
    category: 'toys',
    rating: 5,
    reviews: 188,
    day: {
      name: 'Porcelain Christmas Doll',
      blurb: 'Dressed in red velvet, she waits under the tree and never takes her eyes off the door.',
      price: 7400,
    },
    haunted: {
      name: 'The Doll Who Waited',
      blurb: 'Half her stitches are gone. She is still watching for the girl in the photo.',
      price: 'The year you stopped playing',
      hours: 120,
    },
  },
  {
    id: 'letter',
    category: 'letters',
    rating: 5,
    reviews: 96,
    day: {
      name: 'Sealed Holiday Letter Set',
      blurb: 'Cream paper, a red wax seal, and room for the words you never got around to saying.',
      price: 2400,
      stock: 1,
    },
    haunted: {
      name: 'Unsent Letter',
      blurb: 'Addressed, sealed, never sent. One word is underlined twice.',
      price: 'Everything you meant to say',
      hours: 40,
    },
  },
  {
    id: 'cake',
    category: 'sweets',
    rating: 5,
    reviews: 301,
    day: {
      name: 'Christmas Cream Cake',
      blurb: 'Baked this morning for the table everyone comes home to. Fresh berries, whipped cream.',
      price: 4200,
      was: 5200,
    },
    haunted: {
      name: 'The Last Cake',
      blurb: 'Nobody came home to eat it. Something else did.',
      price: 'One Christmas dinner',
      hours: 6,
    },
  },
  {
    id: 'shoes',
    category: 'gifts',
    rating: 5,
    reviews: 142,
    day: {
      name: 'First Steps Leather Shoes',
      blurb: 'Hand-stitched for little feet that never stop. They will walk anywhere to get home.',
      price: 6400,
    },
    haunted: {
      name: 'Size 31, Found Near the Station',
      blurb: 'They walked all the way. Scorched at the toe, the laces still in a double knot.',
      price: 'Every step home',
      hours: 72,
    },
  },
  {
    id: 'mirror',
    category: 'keepsakes',
    rating: 5,
    reviews: 77,
    day: {
      name: 'Gilded Hall Mirror',
      blurb: 'Hang it by the front door so you always see who is coming home.',
      price: 15800,
      was: 21000,
    },
    haunted: {
      name: 'Hall Mirror, Occupied',
      blurb: 'Someone is still standing in it, facing the door.',
      price: 'Your reflection',
      hours: 200,
    },
  },
  {
    id: 'photo-frame',
    category: 'keepsakes',
    rating: 5,
    reviews: 263,
    day: {
      name: 'Family Portrait Frame',
      blurb: 'Room for everyone you love, and then some. Holds a 5×7 and a lifetime.',
      price: 3800,
    },
    haunted: {
      name: 'Family Portrait, One Missing',
      blurb: 'Same pose, same smiles. The middle is empty, and they have kept the space.',
      price: 'A place in the picture',
      hours: 500,
    },
  },
  {
    id: 'typewriter',
    category: 'keepsakes',
    rating: 5,
    reviews: 58,
    day: {
      name: 'Vintage Typewriter',
      blurb: 'Every key strikes true. Write tomorrow’s holiday letters in ink that never fades.',
      price: 21900,
      stock: 1,
    },
    haunted: {
      name: 'The Confessing Typewriter',
      blurb: 'It types on its own now. Always tomorrow’s date.',
      price: 'The truth, in your words',
      hours: 90,
    },
  },
  {
    id: 'telephone',
    category: 'keepsakes',
    rating: 5,
    reviews: 119,
    day: {
      name: 'Rotary Holiday Telephone',
      blurb: 'Call the ones far away. It rings loud enough to wake the whole house.',
      price: 9900,
      was: 12900,
    },
    haunted: {
      name: 'The Phone That Still Rings',
      blurb: 'It rings at the same time every night. Nobody on this side picks up.',
      price: 'One call you never returned',
      hours: 24,
    },
  },
  {
    id: 'advent-calendar',
    category: 'sweets',
    rating: 5,
    reviews: 174,
    day: {
      name: 'Wooden Advent Calendar',
      blurb: 'Twenty-four little doors, one treat each morning until everyone is home.',
      price: 4600,
    },
    haunted: {
      name: 'Advent Calendar, Day 25',
      blurb: 'Every door is a date. The last one opens from the inside.',
      price: 'Twenty-four mornings',
      hours: 24,
    },
  },
  {
    id: 'tin-soldier',
    category: 'toys',
    rating: 5,
    reviews: 91,
    day: {
      name: 'Wind-Up Tin Soldier',
      blurb: 'Marches proudly across any mantel. Brave, loyal and never, ever tired.',
      price: 2800,
      stock: 1,
    },
    haunted: {
      name: 'Tin Soldier, Fallen',
      blurb: 'Wound too tight. He marched straight off the edge.',
      price: 'One brave year',
      hours: 8760,
    },
  },
  {
    id: 'valve-radio',
    category: 'keepsakes',
    rating: 5,
    reviews: 66,
    day: {
      name: 'Walnut Valve Radio',
      blurb: 'Warm carols from a warm glow. Picks up stations nobody else can.',
      price: 17500,
    },
    haunted: {
      name: 'The Radio Reading Names',
      blurb: 'It only broadcasts one programme now. It is a list.',
      price: 'Your name, read aloud',
      hours: 1,
    },
  },
  {
    id: 'instant-camera',
    category: 'keepsakes',
    rating: 5,
    reviews: 132,
    day: {
      name: 'Instant Holiday Camera',
      blurb: 'Point, click, and watch the moment develop in your hands. Everyone fits in the shot.',
      price: 8900,
      was: 10900,
    },
    haunted: {
      name: 'Instant Camera, Last Roll',
      blurb: 'The prints keep developing. Each time, there are more people in them.',
      price: 'One moment, kept',
      hours: 2,
    },
  },
  {
    id: 'unopened-gift',
    category: 'gifts',
    rating: 5,
    reviews: 245,
    day: {
      name: 'Wrapped Gift: “To Dad”',
      blurb: 'Pre-wrapped with gold ribbon. Just add a name and a reason to come home.',
      price: 3500,
    },
    haunted: {
      name: 'Gift, Never Opened',
      blurb: 'The tag still says “To: Dad”. The “From” has been burned away.',
      price: 'The reason to come home',
      hours: 48,
    },
  },
  {
    id: 'rocking-chair',
    category: 'gifts',
    rating: 5,
    reviews: 207,
    day: {
      name: 'Heirloom Oak Rocking Chair',
      blurb: 'Grandmother’s rocker, waxed and ready for one more generation of bedtime stories.',
      price: 18900,
      was: 24000,
      stock: 1,
    },
    haunted: {
      name: 'The Chair That Still Rocks',
      blurb: 'No one has sat in it since that night. It has never once stopped.',
      price: 'Every night, rocking her to sleep',
      hours: 60,
    },
  },
  {
    id: 'snow-globe',
    category: 'gifts',
    rating: 5,
    reviews: 158,
    day: {
      name: 'Snow Globe: The Little House',
      blurb: 'Shake it and it snows over a little house with all the lights on.',
      price: 3200,
    },
    haunted: {
      name: 'Snow Globe: Ash',
      blurb: 'Shake it. It is not snow.',
      price: 'The house with the lights on',
      hours: 60,
    },
  },
  {
    id: 'chocolate-box',
    category: 'sweets',
    rating: 5,
    reviews: 389,
    day: {
      name: 'Festive Truffle Box, 24',
      blurb: 'Twenty-four handmade truffles. Hurry, they are almost gone.',
      price: 2900,
      was: 3900,
      stock: 3,
    },
    haunted: {
      name: 'Truffle Box, Emptying',
      blurb: 'Every time you look away, there is one fewer.',
      price: 'One sweet thing a day',
      hours: 12,
    },
  },
  {
    id: 'music-box',
    category: 'toys',
    rating: 5,
    reviews: 84,
    day: {
      name: 'Ballerina Music Box',
      blurb: 'She dances whenever the lid is opened, and turns to see who opened it.',
      price: 5600,
    },
    haunted: {
      name: 'Music Box, Still Dancing',
      blurb: 'She stops facing whoever let her out.',
      price: 'The tune you hum without knowing why',
      hours: 18,
    },
  },
  {
    id: 'glass-ornament',
    category: 'gifts',
    rating: 5,
    reviews: 122,
    day: {
      name: 'Hand-Blown Glass Ornament',
      blurb: 'Catches every light on the tree and everyone gathered around it.',
      price: 1800,
    },
    haunted: {
      name: 'Cracked Ornament',
      blurb: 'It shows the room a moment late. Look behind you in it.',
      price: 'A glance over your shoulder',
      hours: 3,
    },
  },
  {
    id: 'candle',
    category: 'gifts',
    rating: 5,
    reviews: 276,
    day: {
      name: 'Cinnamon Pillar Candle',
      blurb: 'Fills the house with the smell of coming home. Burns for eighty hours.',
      price: 1600,
    },
    haunted: {
      name: 'Candle for the Window',
      blurb: 'Left burning so someone could find the way back. It is still lit.',
      price: 'Eighty hours of waiting',
      hours: 80,
    },
  },
  {
    id: 'teddy-bear',
    category: 'toys',
    rating: 5,
    reviews: 330,
    day: {
      name: 'Christmas Teddy Bear',
      blurb: 'Soft, stitched by hand, and made to be held tight all night.',
      price: 3400,
    },
    haunted: {
      name: 'Teddy, Unstitched',
      blurb: 'Held too tight, for too long.',
      price: 'Every night you could not sleep',
      hours: 400,
    },
  },
  {
    id: 'childs-drawing',
    category: 'letters',
    hiddenByDay: true,
    rating: 5,
    reviews: 1,
    day: {
      name: 'A Child’s Drawing',
      blurb: 'Not for sale.',
      price: 0,
    },
    haunted: {
      name: 'A Child’s Drawing of Home',
      blurb: 'Crayon on paper. Everyone is in it, standing outside the house. It was never for sale.',
      price: 'Nothing. Take it home.',
      hours: 0,
    },
  },
];

const byId = new Map(CATALOG.map((p) => [p.id, p]));

export function productById(id: ProductId): ProductMeta {
  const p = byId.get(id);
  if (!p) throw new Error(`Unknown product: ${id}`);
  return p;
}

export function categoryById(id: CategoryId): Category {
  const c = CATEGORIES.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown category: ${id}`);
  return c;
}
