/**
 * How long (ms) the Take of each newer piece lasts in its model, so the Director holds the
 * Stage for exactly that long (director/consequences). Each model keeps its own beat timings
 * inside this span.
 */
export const TAKE_MS = {
  candle: 8000,
  television: 2500,
  hourglass: 6000,
  sleigh: 3200,
  'oil-lamp': 6500,
  'jack-in-the-box': 5000,
  nutcracker: 4200,
} as const;
