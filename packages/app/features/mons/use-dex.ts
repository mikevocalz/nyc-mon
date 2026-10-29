'use client';

import { useMemo } from 'react';
import { useMonStore } from '../mon/mon.store';
import { dexIndex, seenSpeciesIds, type DexEntry } from './dex-model';

/** What the Caller has seen (from the save) and the full index in Dex order. Recomputed only when the save changes. */
export function useDex(): { readonly seen: ReadonlySet<string>; readonly index: readonly DexEntry[] } {
  const save = useMonStore((s) => s.save);
  return useMemo(() => {
    const seen = seenSpeciesIds(save);
    return { seen, index: dexIndex(seen) };
  }, [save]);
}
