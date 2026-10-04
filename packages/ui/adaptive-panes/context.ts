'use client';
// React plumbing for the per-instance store: the host owns a store created in
// a ref and provides it here; panes, the divider and the back hook read it
// through these hooks. Split from `store.ts` so the store factory stays free
// of React and runs under plain `node --test`.
// SOT: ./store.ts
// SOT-KEYWORDS: adaptive panes context provider hook selection scoped store
import { createContext, use } from 'react';
import { useStore } from 'zustand';
import {
  createAdaptivePanesStore,
  type AdaptivePanesState,
  type AdaptivePanesStore,
} from './store.ts';

// A frozen store for the no-host case, so hook order stays stable. Never
// written to; its selection is permanently null.
const FALLBACK_STORE = createAdaptivePanesStore();

export const AdaptivePanesContext = createContext<AdaptivePanesStore | null>(null);

/**
 * Read one slice of the host's store. Throws outside a host: every consumer
 * (divider, back hook, toggles) is rendered by the host by construction, so a
 * null here is a wiring bug to surface, not a state to soldier through.
 */
export function useAdaptivePanesStore<T>(selector: (state: AdaptivePanesState) => T): T {
  const store = use(AdaptivePanesContext);
  if (store === null) {
    throw new Error('useAdaptivePanesStore must be used inside <AdaptivePanes>.');
  }
  return useStore(store, selector);
}

/**
 * Selection for pane CONTENT — null-safe, unlike `useAdaptivePanesStore`,
 * because screens like the reports list render both inside a host (expanded
 * widths) and as a plain single-column screen (compact routes, web pages).
 * Outside a host it reports no selection and a `select` that is `null`, which
 * is also how a screen detects it should navigate instead of select.
 */
export function useAdaptivePaneSelection(): {
  selectedId: string | null;
  select: ((id: string | null) => void) | null;
} {
  const store = use(AdaptivePanesContext);
  // Subscribing conditionally would change hook order; useStore needs a store.
  // A throwaway never-updating selector is not worth a second code path — read
  // the snapshot directly when a host is present.
  const selectedId = useStore(
    store ?? FALLBACK_STORE,
    (state) => state.selectedId,
  );
  if (store === null) return { selectedId: null, select: null };
  return { selectedId, select: store.getState().select };
}
