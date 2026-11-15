import { create } from 'zustand';
import {
  initialState,
  isHauntedPhase,
  load,
  save,
  step,
  type Cue,
  type KeyValueStore,
  type StoryEvent,
  type StoryState,
} from './core';

type CueListener = (cues: Cue[], state: StoryState) => void;

const cueListeners = new Set<CueListener>();

function browserStore(): KeyValueStore | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleSave(state: StoryState) {
  const store = browserStore();
  if (!store) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => save(store, state), 150);
}

interface StoryStore {
  story: StoryState;
  dispatch: (event: StoryEvent) => Cue[];
}

/** The one place that holds the story. UI and Director both dispatch events here. */
export const useStory = create<StoryStore>((set, get) => {
  const store = browserStore();
  return {
    story: store ? load(store) : initialState(),
    dispatch(event) {
      const before = get().story;
      const { state, cues } = step(before, event);
      if (state !== before) {
        set({ story: state });
        scheduleSave(state);
      }
      if (cues.length) for (const l of cueListeners) l(cues, state);
      return cues;
    },
  };
});

export function onCues(listener: CueListener): () => void {
  cueListeners.add(listener);
  return () => cueListeners.delete(listener);
}

export function dispatch(event: StoryEvent): Cue[] {
  return useStory.getState().dispatch(event);
}

/** True once the Reveal has completed, through checkout and the accepted order. */
export function useHaunted(): boolean {
  return useStory((s) => isHauntedPhase(s.story.phase) || s.story.phase === 'accepted');
}

interface UiStore {
  cartOpen: boolean;
  filtersOpen: boolean;
  announcement: string;
  wishlist: string[];
  setCartOpen: (open: boolean) => void;
  setFiltersOpen: (open: boolean) => void;
  announce: (text: string) => void;
  toggleWish: (id: string) => void;
}

export const useUi = create<UiStore>((set) => ({
  cartOpen: false,
  filtersOpen: false,
  announcement: '',
  wishlist: [],
  setCartOpen: (cartOpen) => set({ cartOpen }),
  setFiltersOpen: (filtersOpen) => set({ filtersOpen }),
  // Clearing first makes screen readers repeat identical messages.
  announce: (text) => {
    set({ announcement: '' });
    setTimeout(() => set({ announcement: text }), 30);
  },
  toggleWish: (id) =>
    set((s) => ({
      wishlist: s.wishlist.includes(id) ? s.wishlist.filter((x) => x !== id) : [...s.wishlist, id],
    })),
}));
