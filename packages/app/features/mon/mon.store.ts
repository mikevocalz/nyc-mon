'use client';

import { saveIO } from '../onboarding/save-store';
import { createMonStore } from './create-mon-store';

/**
 * The app's one Mon store, bound to the MMKV save (`nyc-mon-save`). Every
 * screen and renderer reads the Mon through this hook and its selectors.
 */
export const useMonStore = createMonStore(saveIO);

/** Loads the save into the Mon store. Call at app start, next to `hydrateOnboarding`. */
export function hydrateMon(): void {
  useMonStore.getState().hydrate();
}

export {
  type EvolutionProgress,
  type LastSeen,
  localDayKey,
  type MonStoreOptions,
  type MonStoreState,
  type PendingEgg,
  selectActiveCare,
  selectActiveMon,
  selectCallerIsUnder13,
  selectCareNow,
  selectDaysTogether,
  selectEvolutionProgress,
  selectJournal,
  selectLastSeen,
  selectPendingEgg,
  selectSceneInput,
  selectStage,
  selectStarterBloodlineId,
} from './create-mon-store';
export { parseReadyNotificationData, type ReadyNotificationParse } from './ready-notification';
