'use client';
// Pane-override persistence: the store factory over whatever synchronous
// key-value storage it is handed (localStorage on web, in memory on native
// until the host app configures MMKV). Synchronous is the requirement: the first
// render must already know the answer, or a pane flashes open and then closes
// once an async read resolves.
// SOT: ./README.md (Pane visibility: automatic policy vs manual overrides)
// SOT-KEYWORDS: pane overrides store shared storage persistence zustand factory
import { create } from 'zustand';
import type { WindowSizeClass } from './constants.ts';
import {
  clearPaneOverrides,
  togglePaneOverride,
  type PaneOverrides,
  type TogglablePane,
} from './pane-overrides.ts';

export const STORAGE_KEY = 'pane-overrides';

/**
 * The three synchronous operations pane overrides need. An MMKV instance has
 * this shape; web adapts localStorage.
 *
 * @see {@linkcode configurePaneOverrideStorage}
 */
export interface PaneOverrideStorage {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
  remove: (key: string) => void;
}

export function readOverrides(storage: PaneOverrideStorage): PaneOverrides {
  const raw = storage.getString(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as PaneOverrides;
  } catch {
    // A malformed blob means a partial write or a shape change across versions.
    // Automatic behaviour is always a safe layout, so drop it rather than
    // leaving the user with panes that will not open.
    storage.remove(STORAGE_KEY);
    return {};
  }
}

export interface PaneOverrideState {
  overrides: PaneOverrides;
  /** Toggle one pane for one size class. `visible` is what is on screen NOW. */
  toggle: (sizeClass: WindowSizeClass, pane: TogglablePane, visible: boolean) => void;
  /** Return one size class to automatic behaviour. */
  reset: (sizeClass: WindowSizeClass) => void;
}

/**
 * Overrides stay module-level (unlike the per-instance layout store): they are
 * a device-wide preference persisted across process death, not per-surface
 * state — hiding the sidebar on a tablet is a choice about the tablet.
 *
 * The storage is swappable. The kit declares no persistence library, so the
 * native fork starts in memory and the host app hands in a synchronous store
 * (MMKV in apps/mobile) through `configurePaneOverrideStorage` before its first
 * render; the swap re-reads the saved map so the first frame is already right.
 */
export function createPaneOverrideStore(initialStorage: PaneOverrideStorage) {
  let storage = initialStorage;

  const store = create<PaneOverrideState>((set, get) => ({
    overrides: readOverrides(storage),

    toggle: (sizeClass, pane, visible) => {
      const overrides = togglePaneOverride(get().overrides, sizeClass, pane, visible);
      storage.set(STORAGE_KEY, JSON.stringify(overrides));
      set({ overrides });
    },

    reset: (sizeClass) => {
      const overrides = clearPaneOverrides(get().overrides, sizeClass);
      storage.set(STORAGE_KEY, JSON.stringify(overrides));
      set({ overrides });
    },
  }));

  function configureStorage(next: PaneOverrideStorage): void {
    storage = next;
    store.setState({ overrides: readOverrides(next) });
  }

  return { store, configureStorage };
}

/** A storage that keeps the map for the life of the process only. */
export function createMemoryPaneOverrideStorage(): PaneOverrideStorage {
  const values = new Map<string, string>();
  return {
    getString: (key) => values.get(key),
    set: (key, value) => {
      values.set(key, value);
    },
    remove: (key) => {
      values.delete(key);
    },
  };
}
