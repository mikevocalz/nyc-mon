import { createConsoleStore } from './base.ts';

/** The consent queue's lanes (03-direction.md): one per status, plus everything. */
export type ConsentLane = 'pending' | 'approved' | 'denied' | 'expired' | 'all';

export const useConsentStore = createConsoleStore<{ lane: ConsentLane; setLane: (lane: ConsentLane) => void }>(
  (set) => ({ lane: 'pending', setLane: (lane) => set({ lane, selectedId: null }) }),
);
