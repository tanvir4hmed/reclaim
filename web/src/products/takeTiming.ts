/**
 * How long (ms) the Take of each newer piece lasts in its model, so the Director holds the
 * Stage for exactly that long (director/consequences). Each model keeps its own beat timings
 * inside this span.
 */
export const TAKE_MS = {
  hourglass: 6000,
  sleigh: 5200,
  'oil-lamp': 6500,
  'jack-in-the-box': 5000,
  nutcracker: 4200,
  'spirit-board': 6800,
} as const;
