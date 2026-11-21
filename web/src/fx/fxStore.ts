import { create } from 'zustand';
import type { Print } from '../director/footprints';

export type CatchStep = 'none' | 'grab' | 'turn' | 'lunge' | 'dark' | 'release';
export type ClosingStep = 'none' | 'power' | 'eyes' | 'sheets' | 'turn' | 'ghost' | 'after';

/** Transient effect state that does not belong in the persisted story. */
interface FxStore {
  mains: number;
  catchStep: CatchStep;
  closingStep: ClosingStep;
  /** Day bat perch id (a `data-perch` value) and whether it is flying. */
  batPerch: string;
  batFlying: boolean;
  batHover: boolean;
  /** Where the bat was when caught (viewport px) and its width; the lunge starts there. */
  catchFrom: { x: number; y: number; w: number } | null;
  /** Where the skeletal hand closed. */
  catchHand: { x: number; y: number } | null;
  /** Early sign currently showing in the Day state. */
  sign: 'none' | 'bulb' | 'tilt' | 'shadow';
  prints: Print[];
  cartRinging: boolean;
  flyPerch: string | null;
  /** Product id whose card is playing its Consequence right now. */
  playing: string | null;
  /** Generic short-lived flags (e.g. 'watch-shudder', 'roll-call', 'freeze'). */
  flags: Record<string, number>;
  tremor: boolean;
  quiet: boolean;
  acceptedShown: boolean;
  set: (patch: Partial<Omit<FxStore, 'set' | 'flag' | 'unflag'>>) => void;
  flag: (name: string) => void;
  unflag: (name: string) => void;
}

export const useFx = create<FxStore>((set) => ({
  mains: 1,
  catchStep: 'none',
  closingStep: 'none',
  batPerch: 'hero-lantern',
  batFlying: false,
  batHover: false,
  catchFrom: null,
  catchHand: null,
  sign: 'none',
  prints: [],
  cartRinging: false,
  flyPerch: null,
  playing: null,
  flags: {},
  tremor: false,
  quiet: false,
  acceptedShown: false,
  set: (patch) => set(patch),
  flag: (name) => set((s) => ({ flags: { ...s.flags, [name]: Date.now() } })),
  unflag: (name) =>
    set((s) => {
      const next = { ...s.flags };
      delete next[name];
      return { flags: next };
    }),
}));

export const fx = () => useFx.getState();
