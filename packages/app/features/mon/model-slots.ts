import { starterBloodlines } from '@acme/content/starters';
import { emptyModelSlots } from '@acme/core/sim';
import type { MonModelSlot } from '@acme/core/types';

/**
 * One model slot per shipped bloodline × lifecycle stage. Phase 1 ships only
 * the three starters (F01, F02, F12; Law 7), so the other roster Bloodlines
 * get no slot until they ship. Every glb and clip is null until Mike delivers
 * the models; a renderer that finds null draws its placeholder.
 */
export const MON_MODEL_SLOTS: readonly MonModelSlot[] = emptyModelSlots(
  starterBloodlines.map(({ bloodline }) => bloodline.bloodlineId),
);
