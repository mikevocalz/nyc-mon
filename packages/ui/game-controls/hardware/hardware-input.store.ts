// What the rest of the kit reads about hardware input: which devices are
// attached and which source last produced input. Module-level vanilla
// Zustand store with selector hooks, the kit pattern (repo rule: never
// useState; see use-adaptive-navigation-placement.ts). The touch overlay
// reads `activeSource` to hide itself while a gamepad or keyboard drives.
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { InputSource } from '../contract.ts';
import type { GamepadDevice } from '../../modules/nyc-gamepad-input/src/types/GamepadDevice';

export interface HardwareInputState {
  /** `false` until {@linkcode useHardwareInput} mounts and finds a platform source, and on platforms without one. */
  readonly isAvailable: boolean;
  /** Attached gamepads (and the hardware keyboard on native). Replaced wholesale on every change. */
  readonly connectedDevices: readonly GamepadDevice[];
  /**
   * The source of the most recent input, or `null` when nothing hardware
   * has spoken since the last disconnect, focus loss or background. The
   * touch lane may set `touch` here when a finger lands so the overlay
   * comes back.
   */
  readonly activeSource: InputSource | null;
}

export interface HardwareInputStore extends HardwareInputState {
  setAvailable(isAvailable: boolean): void;
  setConnectedDevices(devices: readonly GamepadDevice[]): void;
  setActiveSource(source: InputSource | null): void;
}

/** The one process-wide store. Read with {@linkcode useHardwareInputStore}; written by the adapter hook. */
export const hardwareInputStore = createStore<HardwareInputStore>((set, get) => ({
  isAvailable: false,
  connectedDevices: [],
  activeSource: null,
  setAvailable: (isAvailable) => {
    if (get().isAvailable !== isAvailable) set({ isAvailable });
  },
  setConnectedDevices: (connectedDevices) => set({ connectedDevices }),
  setActiveSource: (activeSource) => {
    if (get().activeSource !== activeSource) set({ activeSource });
  },
}));

/** Selector hook over {@linkcode hardwareInputStore}. */
export function useHardwareInputStore<T>(selector: (state: HardwareInputStore) => T): T {
  return useStore(hardwareInputStore, selector);
}

/** `true` while a gamepad or keyboard is the active source: the touch overlay hides (§10). */
export const selectIsHardwareSourceActive = (state: HardwareInputState): boolean =>
  state.activeSource === 'gamepad' || state.activeSource === 'keyboard';
