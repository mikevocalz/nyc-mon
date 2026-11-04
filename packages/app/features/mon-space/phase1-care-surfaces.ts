import { advanceCare, listUnmetNeeds } from '@acme/core/sim';
import type { MonLingo } from '@acme/content/voice';
import { watchPresentation } from './watch-presentation.ts';
import type { CareState, MonInstance, SaveCurrent } from '@acme/core/types';
import { CARE_HORIZON_MS, type PredictedCall } from './care-notification-plan.ts';
import type { MonCareSurfacesInput } from './publish-mon-care.ts';
import { careConsentAllowed } from './care-surface-owner.ts';

/** The save's Caller identity is independent of its authentication user ID. */
export function careSurfacesFromSave(
  save: SaveCurrent | undefined, activeMonInstanceId: string | undefined, now: number, name: (mon: MonInstance) => string,
  lingo?: MonLingo,
): MonCareSurfacesInput | null {
  const mon = save?.mons.find((entry) => entry.monInstanceId === activeMonInstanceId);
  const care = save?.care.find((entry) => entry.monInstanceId === activeMonInstanceId);
  if (!careConsentAllowed(save) || !mon || !care || mon.callerId !== save?.caller?.callerId) return null;
  return phase1CareSurfaces(mon, care, name(mon), now, lingo);
}

/** The current companion simulation owns these meters and attention events.
 * It has no illness, waste, false calls, bedtime or pause model. Those fields
 * stay inactive here until the simulation supports them; no new care rules
 * or persisted state are introduced by the widget adapter.
 */
export function phase1CareSurfaces(mon: MonInstance, care: CareState, name: string, now: number, lingo?: MonLingo): MonCareSurfacesInput {
  const current = advanceCare({ mon, care }, now).state;
  const future = advanceCare(current, now + CARE_HORIZON_MS);
  const predictions: PredictedCall[] = [];
  const first = new Set<string>();
  // A single advance reports events in meter-processing order, not time
  // order (fullness's lower threshold may precede its food request in the
  // array). Schedule the earliest event for each need.
  for (const event of [...future.events].sort((a, b) => a.at - b.at)) {
    const kind = event.type === 'food-requested' ? 'hunger'
      : event.type === 'needs-attention' ? event.need === 'fullness' ? 'hunger' : event.need
        : null;
    // Fullness's needs-you crossing must not repeat its earlier food request.
    if (kind === null || first.has(kind) || (kind === 'hunger' && current.care.pendingRequest !== null)) continue;
    if (event.at <= now) continue;
    first.add(kind);
    predictions.push({ kind, at: event.at });
  }
  const hearts = (value: number): 0 | 1 | 2 | 3 | 4 => Math.max(0, Math.min(4, Math.ceil(value * 4))) as 0 | 1 | 2 | 3 | 4;
  return {
    watch: watchPresentation(mon, current.care, now, lingo),
    monInstanceId: mon.monInstanceId,
    monName: name,
    now,
    predictions,
    view: {
      hearts: { fullness: hearts(current.care.fullness), energy: hearts(current.care.energy), social: hearts(current.care.social) },
      attention: current.care.pendingRequest !== null || listUnmetNeeds(current.care).length > 0 ? 'call' : 'none',
      asleep: current.care.activity.kind === 'asleep',
      paused: false,
      cold: null,
      poop: 0,
    },
  };
}
