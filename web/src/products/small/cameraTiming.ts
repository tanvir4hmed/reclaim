/**
 * Seconds into the camera's Take: it turns to face you square on, the iris in its lens swings
 * open, it flashes once, then the print slides out of the slot and develops.
 * `closeAt` is when the old lens cover used to shut again; the iris now stays open, so the model
 * no longer uses it, but the key is kept for anything that still reads it.
 */
export const CAMERA = {
  turnFrom: 0.1,
  turnFor: 0.75,
  coverAt: 0.9,
  coverFor: 0.35,
  flashAt: 1.35,
  closeAt: 1.6,
  printFrom: 1.6,
  printFor: 2.0,
  developFor: 3.2,
};
