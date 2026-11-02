import { createConsoleStore } from './base.ts';

/** The Mons screen's list-pane tab (03-direction.md: Mons · Eggs · Integrity). */
export type MonsTab = 'mons' | 'eggs' | 'integrity';

export const useMonsStore = createConsoleStore<{ tab: MonsTab; setTab: (tab: MonsTab) => void }>(
  (set) => ({ tab: 'mons', setTab: (tab) => set({ tab }) }),
);
