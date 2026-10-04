'use client';
// PLATFORM FORK — localStorage behind MMKV's shape, absent during SSR. Empty
// overrides on the server are correct: automatic pane policy is always a safe
// layout, and the saved map applies on hydration.
// SOT: ./pane-overrides.store.shared.ts · ./README.md
// SOT-KEYWORDS: pane overrides web localstorage fork persistence ssr
import {
  createPaneOverrideStore,
  type PaneOverrideStorage,
} from './pane-overrides.store.shared.ts';

const { store, configureStorage } = createPaneOverrideStore({
  getString: (key) => globalThis.localStorage?.getItem(key) ?? undefined,
  set: (key, value) => globalThis.localStorage?.setItem(key, value),
  remove: (key) => globalThis.localStorage?.removeItem(key),
});

export const usePaneOverrideStore = store;

/**
 * Persist pane overrides in `storage` instead of localStorage and load
 * whatever it already holds. Call once at module scope, before the first
 * `AdaptivePanes` renders.
 */
export function configurePaneOverrideStorage(storage: PaneOverrideStorage): void {
  configureStorage(storage);
}

export type { PaneOverrideStorage };
