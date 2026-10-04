import { createStore, type StoreApi } from 'zustand/vanilla';
import { clampPrimaryWidth } from './resize.ts';
import type { SplitNavigableColumn } from './types';

/**
 * Per-instance layout + selection state for one AdaptivePanes host.
 *
 * PER-INSTANCE, NOT MODULE-LEVEL — the old singleton could not scope state per
 * surface: two screens that each mount a host would share one `selectedId`,
 * leaking a selection from one into the other. The host
 * creates this store in a ref (the kit's `useInstanceStore` pattern:
 * vanilla `createStore`, never React useState) and provides it via context
 * (`context.tsx`); policy stays pure in this file so `node --test` covers it
 * without React.
 *
 * Store state rather than component state so it survives the remount a
 * configuration change can trigger (rotation, fold, multi-window resize):
 * compact -> expanded -> compact returns to the same column and the same
 * selected record.
 *
 * `column: null` means "not yet navigated", so the component can fall back to
 * the `topColumnForCollapsing` prop without writing to the store during render.
 *
 * SOT-KEYWORDS: adaptive panes store selection column primary width scoped instance
 */
export interface AdaptivePanesState {
  column: SplitNavigableColumn | null;
  setColumn: (column: SplitNavigableColumn) => void;
  /** User-resized primary width in dp; null keeps the token width. */
  primaryWidth: number | null;
  setPrimaryWidth: (width: number) => void;
  resetPrimaryWidth: () => void;
  /** The selected record — what the detail pane is showing, `null` for none. */
  selectedId: string | null;
  select: (id: string | null) => void;
}

export type AdaptivePanesStore = StoreApi<AdaptivePanesState>;

export function createAdaptivePanesStore(): AdaptivePanesStore {
  return createStore<AdaptivePanesState>((set) => ({
    column: null,
    /*
      No `direction` any more, and nothing lost with it. It existed to tell the
      collapsed branch which way to slide a pane in, and the collapsed branch is
      gone: every pane now sits in one row in leading-to-trailing order, so a
      pane opening while its neighbour closes already travels the right way.
      The rank the direction was derived from IS the row order.
    */
    setColumn: (column) => set({ column }),

    primaryWidth: null,
    setPrimaryWidth: (width) => set({ primaryWidth: clampPrimaryWidth(width) }),
    resetPrimaryWidth: () => set({ primaryWidth: null }),

    // Selection is NOT cleared on column or width changes: surviving the fold
    // is the point. Only an explicit select(null) empties the detail pane.
    selectedId: null,
    select: (id) => set({ selectedId: id }),
  }));
}
