/** Small bridge so non-React code (Director, GSAP timelines) can ask the canvases to redraw. */
export const glBus: { invalidate: () => void; revealing: boolean } = {
  invalidate: () => {},
  revealing: false,
};
