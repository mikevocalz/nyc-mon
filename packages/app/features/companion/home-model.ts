import { DEFAULT_CARE_TUNING, deriveAnimationIntent, deriveMonMood, listUnmetNeeds } from '@acme/core/sim';
import type { CareNeed, CareState } from '@acme/core/types';
import { companionCopy, type CompanionCopyId } from './copy.ts';
import { reactionClipsFor, type MonReactionIntent } from './mon-models.ts';

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

/** What a tap on the Baby or a return plays: a clip from its GLB, the glass's nudge, or nothing. */
export type HomeReaction =
  | { readonly kind: 'clip'; readonly intent: MonReactionIntent; readonly clips: readonly string[] }
  | { readonly kind: 'nudge' }
  | { readonly kind: 'none' };

/**
 * M13 "Motion": a tap plays `attention`, a return (background-resumed)
 * plays `approach`. Core's `deriveAnimationIntent` decides whether the
 * intent plays at all (a sleeping Mon plays neither: a tap never wakes it,
 * and a return finds it asleep); this table decides which clip. A form with
 * no such clip gets the existing nudge on a tap and nothing on a return,
 * so a return never jostles a Mon the Caller did not touch.
 */
export function homeReaction(dexId: number | null, care: CareState | undefined, trigger: 'tap' | 'resume', nowMs: number): HomeReaction {
  const intent: MonReactionIntent = trigger === 'tap' ? 'attention' : 'approach';
  const fallback: HomeReaction = trigger === 'tap' ? { kind: 'nudge' } : { kind: 'none' };
  if (care === undefined) return fallback;
  const plays = deriveAnimationIntent(care, trigger === 'tap'
    ? { nowMs, approachActive: false, cue: { intent: 'attention', untilMs: nowMs + 1 } }
    : { nowMs, approachActive: true, cue: null });
  if (plays !== intent) return fallback;
  const clips = reactionClipsFor(dexId, intent);
  return clips === null ? fallback : { kind: 'clip', intent, clips };
}

/**
 * How far the room pans either side, as a share of the glass width: the
 * renderer's documented range for `modelsOffset` (DeviceScreen, -0.3..0.3).
 * The glass draws no room yet, so panning slides the Baby across the glass,
 * opposite the drag, as a camera pan would.
 */
export const ROOM_PAN_BOUND = 0.3;
/** Trackpad drag, pt, that crosses the whole glass width. */
export const ROOM_PAN_PT_PER_GLASS = 320;

/** The room pan after a trackpad drag of `dxPt`, clamped to {@linkcode ROOM_PAN_BOUND}. */
export function panRoom(current: number, dxPt: number): number {
  const next = current - dxPt / ROOM_PAN_PT_PER_GLASS;
  return Math.max(-ROOM_PAN_BOUND, Math.min(ROOM_PAN_BOUND, next));
}
