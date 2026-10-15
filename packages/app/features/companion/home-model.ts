import { DEFAULT_CARE_TUNING, deriveMonMood, listUnmetNeeds } from '@acme/core/sim';
import type { CareNeed, CareState } from '@acme/core/types';
import { companionCopy, type CompanionCopyId } from './copy.ts';

/** The status-row tones M13 uses (a subset of the kit's `StatusRowTone`). */
export type HomeStatusTone = 'neutral' | 'request';

/** True below the needs-you line (draws the ring's low notch). */
export function isLow(value: number): boolean {
  return value < DEFAULT_CARE_TUNING.needsAttentionBelow;
}

export const NEED_RING: Record<CareNeed, CompanionCopyId> = {
  energy: 'm13.ring.energy',
  fullness: 'm13.ring.fullness',
  social: 'm13.ring.social',
};

/** Where M13's trackpad tap goes ("answer the ask", first match wins). `undefined` = say hi. */
export function askRoute(care: CareState): '/(home)/feed' | '/(home)/rest' | '/(home)/social' | undefined {
  const unmet = listUnmetNeeds(care);
  if (care.pendingRequest !== null || unmet.includes('fullness')) return '/(home)/feed';
  if (care.activity.kind === 'asleep') return '/(home)/rest';
  if (unmet.includes('energy')) return '/(home)/rest';
  if (unmet.includes('social')) return '/(home)/social';
  return undefined;
}

/** The status chip's text and tone for a care state (M13 "States"). Never blame, never elapsed time. */
export function homeStatus(care: CareState): { text: string; tone: HomeStatusTone; hint: CompanionCopyId } {
  const mood = deriveMonMood(care);
  const unmet = listUnmetNeeds(care);
  if (mood === 'asleep') {
    return { text: companionCopy('m13.status.asleep'), tone: unmet.length > 0 ? 'request' : 'neutral', hint: 'm13.trackpad.hint.energy' };
  }
  if (mood === 'sluggish') return { text: companionCopy('m13.status.sluggish'), tone: 'neutral', hint: 'm13.trackpad.hint.idle' };
  const asks: CareNeed[] = [...unmet];
  if (care.pendingRequest !== null && !asks.includes('fullness')) asks.push('fullness');
  if (asks.length > 1) {
    const list = asks.map((n) => companionCopy(NEED_RING[n])).join(', ');
    return { text: companionCopy('m13.status.many', { list }), tone: 'request', hint: hintFor(asks[0]) };
  }
  if (asks[0] === 'fullness') return { text: companionCopy('m13.status.food'), tone: 'request', hint: 'm13.trackpad.hint.food' };
  if (asks[0] === 'energy') return { text: companionCopy('m13.status.energy'), tone: 'request', hint: 'm13.trackpad.hint.energy' };
  if (asks[0] === 'social') return { text: companionCopy('m13.status.social'), tone: 'request', hint: 'm13.trackpad.hint.social' };
  return { text: companionCopy('m13.status.content'), tone: 'neutral', hint: 'm13.trackpad.hint.idle' };
}

function hintFor(need: CareNeed | undefined): CompanionCopyId {
  if (need === 'fullness') return 'm13.trackpad.hint.food';
  if (need === 'energy') return 'm13.trackpad.hint.energy';
  if (need === 'social') return 'm13.trackpad.hint.social';
  return 'm13.trackpad.hint.idle';
}

