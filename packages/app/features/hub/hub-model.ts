// Pure decisions for HOME (the hub tab). No react-native import, so
// node --test covers it.
// SOT: docs/canon/GAMEPLAY_BIBLE_V12.md "Native navigation canon" (HOME)
// SOT-KEYWORDS: home hub care need hatch reminder continue game h-lynk
import type { CareState, EggRecord, HatchState } from '@acme/core/types';
import type { ResumeSummary } from '@acme/ui/lobby';
import { askRoute } from '../companion/home-model.ts';
import { companionCopy, type CompanionCopyId } from '../companion/copy.ts';
import { incubationView, timeLine } from '../hatch/incubation-model.ts';
import type { HubCopyId } from './copy.ts';

/** The ONE care need the hub shows: its status line (H-Lynk's words), the action and where it goes. */
export interface HubCareNeed {
  readonly status: string;
  readonly action: HubCopyId;
  readonly href: '/(home)/feed' | '/(home)/rest' | '/(home)/social' | '/(home)';
  /** True when the Mon is asking: the action takes the hot colour. */
  readonly asking: boolean;
}

/**
 * The single need now, first match wins (the same order as M13's trackpad,
 * `askRoute`): food, then sleep, then energy, then play. With nothing asked
 * the action is a hello on the H-Lynk.
 */
export function careNeedNow(care: CareState): HubCareNeed {
  const route = askRoute(care);
  const asleep = care.activity.kind === 'asleep';
  const status = (id: CompanionCopyId) => companionCopy(id);
  if (route === '/(home)/feed') return { status: status('m13.status.food'), action: 'hub.need.feed', href: route, asking: true };
  if (route === '/(home)/rest' && asleep) return { status: status('m13.status.asleep'), action: 'hub.need.asleep', href: route, asking: false };
  if (route === '/(home)/rest') return { status: status('m13.status.energy'), action: 'hub.need.rest', href: route, asking: true };
  if (route === '/(home)/social') return { status: status('m13.status.social'), action: 'hub.need.play', href: route, asking: true };
  return { status: status('m13.status.content'), action: 'hub.need.hi', href: '/(home)', asking: false };
}

/** The hatch reminder (M11 state), or null once the egg has hatched. */
export interface HubHatchReminder {
  readonly title: HubCopyId;
  readonly action: HubCopyId;
  /** M11's time line: "12 min left", "Ready to hatch", "Your egg started hatching". */
  readonly line: string;
  /** Ready or mid-hatch: the egg is waiting on the Caller. */
  readonly ready: boolean;
}

export function hatchReminder(hatch: HatchState, egg: EggRecord, nowMs: number): HubHatchReminder | null {
  // Entry is now: the hub has no latch, a minute tick re-derives it.
  const view = incubationView(hatch, egg, nowMs, nowMs, false);
  const line = timeLine(view, egg.incubationEndsAt, nowMs);
  switch (view) {
    case 'counting':
      return { title: 'hub.hatch.counting.title', action: 'hub.hatch.counting.action', line, ready: false };
    case 'ready':
    case 'overdue':
      return { title: 'hub.hatch.ready.title', action: 'hub.hatch.ready.action', line, ready: true };
    case 'resume':
      return { title: 'hub.hatch.resume.title', action: 'hub.hatch.resume.action', line, ready: true };
    case 'hatched':
      return null;
  }
}

/** The Game entry: Continue with a save, Start without one, Open when the save failed to load. */
export interface HubGameEntry {
  readonly title: HubCopyId;
  readonly kind: 'continue' | 'start' | 'failed';
  /** Epoch ms of the save Continue resumes; null otherwise. */
  readonly savedAtMs: number | null;
}

export function gameEntry(summary: ResumeSummary): HubGameEntry {
  switch (summary.kind) {
    case 'eligible':
    case 'offline':
      return { title: 'hub.game.continue', kind: 'continue', savedAtMs: summary.savedAtMs };
    case 'failed':
      return { title: 'hub.game.failed', kind: 'failed', savedAtMs: null };
    case 'none':
      return { title: 'hub.game.start', kind: 'start', savedAtMs: null };
  }
}
