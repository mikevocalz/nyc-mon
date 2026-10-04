'use client';
// PLATFORM FORK — native. In memory until the host app calls
// `configurePaneOverrideStorage` with a synchronous store: @acme/ui declares no
// persistence library, and apps/mobile already owns MMKV. Synchronous is the
// requirement: the first render must already know the saved layout, or a pane
// flashes open and then closes once an async read resolves.
// SOT: ./pane-overrides.store.shared.ts · ./README.md
// SOT-KEYWORDS: pane overrides native fork persistence configure storage
import {
  createMemoryPaneOverrideStorage,
  createPaneOverrideStore,
  type PaneOverrideStorage,
} from './pane-overrides.store.shared.ts';

const { store, configureStorage } = createPaneOverrideStore(createMemoryPaneOverrideStorage());

export const usePaneOverrideStore = store;

/**
 * Persist pane overrides in `storage` and load whatever it already holds.
 * Call once at module scope, before the first `AdaptivePanes` renders.
 */
export function configurePaneOverrideStorage(storage: PaneOverrideStorage): void {
  configureStorage(storage);
}

export type { PaneOverrideStorage };
