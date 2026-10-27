// The physically lit city's time-of-day pick (G2: four presets, twilight by
// default). Graphics settings write it; the Game screen passes
// `preset` into the scene params, where city-scene re-lights on change.
// The render runtime never reads this store. The worklet snapshot does not
// carry the pick yet, so that path renders the default until it does.
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

export function useTimeOfDay<T>(selector: (state: TimeOfDayState) => T): T {
  return useStore(timeOfDayStore, selector);
}
