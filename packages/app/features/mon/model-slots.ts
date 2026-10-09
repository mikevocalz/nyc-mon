import { bloodlines } from '@acme/content';
import { emptyModelSlots } from '@acme/core/sim';
import type { MonModelSlot } from '@acme/core/types';

/**
 * One model slot per shipped bloodline × lifecycle stage. Every glb and clip
 * is null until Mike delivers the models; a renderer that finds null draws
 * its placeholder.
 */
export const MON_MODEL_SLOTS: readonly MonModelSlot[] = emptyModelSlots(bloodlines.map((b) => b.bloodlineId));
