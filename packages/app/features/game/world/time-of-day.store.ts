// The physically lit city's time-of-day pick (G2: four presets, twilight by
// default). Graphics settings write it; city-scene re-lights when the
// scene params' `preset` changes.
// - JS path: GameScreen's params read `preset` from this store, and a change
//   invalidates the on-demand canvas so the next draw picks it up.
// - Worklet path: the render runtime never reads this store. worklet-host
//   packs the pick into the render snapshot (render-snapshot.ts `preset`
//   slot) and writes a new snapshot on change; game-render's params read it
//   back from there.
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { DEFAULT_PHYSICAL_PRESET, PHYSICAL_PRESET_IDS, type PhysicalPresetId } from './physical-look.ts';

export interface TimeOfDayState {
  preset: PhysicalPresetId;
  setPreset: (preset: PhysicalPresetId) => void;
}

export function createTimeOfDayStore(initial: PhysicalPresetId = DEFAULT_PHYSICAL_PRESET) {
  return createStore<TimeOfDayState>((set) => ({
    preset: initial,
    setPreset: (preset) => {
      if (!(PHYSICAL_PRESET_IDS as readonly string[]).includes(preset)) return;
      set({ preset });
    },
  }));
}

export const timeOfDayStore = createTimeOfDayStore();

/**
 * Calls `listener` when the preset changes, not on every write: a repeat
 * pick of the same preset redraws nothing. Returns the unsubscribe.
 */
export function onTimeOfDayChange(
  store: ReturnType<typeof createTimeOfDayStore>,
  listener: (preset: PhysicalPresetId) => void,
): () => void {
  return store.subscribe((state, prior) => {
    if (state.preset !== prior.preset) listener(state.preset);
  });
}

export function useTimeOfDay<T>(selector: (state: TimeOfDayState) => T): T {
  return useStore(timeOfDayStore, selector);
}
