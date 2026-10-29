'use client';

import { create } from 'zustand';
import { ALL_DEX, type DexQuery } from './dex-model.ts';

/**
 * What the Caller is browsing on MONS: the search and filters, and on
 * master/detail windows the entry open on the right. Module-level, so going
 * from the index to an entry and back keeps the list where it was.
 */
export interface DexBrowseState {
  readonly query: DexQuery;
  /** The entry the detail pane shows; null shows its empty state. */
  readonly selectedId: string | null;
  setQuery: (patch: Partial<DexQuery>) => void;
  clearQuery: () => void;
  select: (speciesId: string | null) => void;
}

export const useDexBrowse = create<DexBrowseState>()((set) => ({
  query: ALL_DEX,
  selectedId: null,
  setQuery: (patch) => set((s) => ({ query: { ...s.query, ...patch } })),
  clearQuery: () => set({ query: ALL_DEX }),
  select: (speciesId) => set({ selectedId: speciesId }),
}));
