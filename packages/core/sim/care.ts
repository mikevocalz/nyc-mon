import type { CareAction, CareNeed, CareState } from '../types/index.ts';
import { assertNever } from './assert-never.ts';
import type { ActivitySpan, CareEvent, SimState } from './state.ts';
import { type CareTuning, type DecayCurve, DEFAULT_CARE_TUNING, HATCHLING_CARE } from './tuning.ts';

const HOUR_MS = 3_600_000;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

function decay(value: number, curve: DecayCurve, dtMs: number, speed: number): number {
  const hours = (dtMs / HOUR_MS) * speed;
  switch (curve.kind) {
    case 'linear':
      return clamp01(value - curve.perHour * hours);
    case 'exponential':
      return clamp01(value * 2 ** (-hours / curve.halfLifeHours));
    default:
      return assertNever(curve);
  }
}

/** Ms until `value` decays to `threshold`, or null if it never does in this segment. */
function msUntil(value: number, threshold: number, curve: DecayCurve, speed: number): number | null {
  if (value < threshold) return null;
  switch (curve.kind) {
    case 'linear':
      return curve.perHour > 0 ? ((value - threshold) / (curve.perHour * speed)) * HOUR_MS : null;
    case 'exponential':
      return threshold > 0 ? ((curve.halfLifeHours * Math.log2(value / threshold)) / speed) * HOUR_MS : null;
    default:
      return assertNever(curve);
  }
}

function isSluggishAt(care: CareState, t: number): boolean {
  return care.sluggishUntil !== null && care.sluggishUntil > t;
}

/** Keeps the invariant: awake and Fullness below the request line ⇒ a pending food request. */
function ensureFoodRequest(care: CareState, t: number, tuning: CareTuning, events: CareEvent[]): CareState {
  if (care.activity.kind !== 'awake' || care.pendingRequest !== null) return care;
  if (care.fullness >= tuning.foodRequestBelow) return care;
  const at = Math.ceil(t);
  events.push({ type: 'food-requested', at });
  return { ...care, pendingRequest: { need: 'fullness', since: at } };
}

function curveFor(care: CareState, need: CareNeed, tuning: CareTuning): DecayCurve | null {
  if (care.activity.kind === 'awake') return tuning.awakeDecay[need];
  return need === 'energy' ? null : tuning.asleepDecay[need];
}

/** Advances one segment of constant activity and sluggishness from `t` to `end`. */
function advanceSegment(
  care: CareState,
  t: number,
  end: number,
  tuning: CareTuning,
  events: CareEvent[],
): CareState {
  const dt = end - t;
  const sluggish = isSluggishAt(care, t);
  const next: Record<CareNeed, number> = { energy: care.energy, fullness: care.fullness, social: care.social };
  for (const need of ['energy', 'fullness', 'social'] as const) {
    const start = care[need];
    const curve = curveFor(care, need, tuning);
    if (curve === null) {
      next[need] = clamp01(start + (tuning.energyRecoveryPerHourAsleep * dt) / HOUR_MS);
      continue;
    }
    const speed = need === 'energy' && sluggish ? tuning.sluggishEnergyDecayMultiplier : 1;
    const value = decay(start, curve, dt, speed);
    next[need] = value;
    const crossAt = (threshold: number): number => {
      const ms = msUntil(start, threshold, curve, speed);
      return Math.min(Math.ceil(end), Math.ceil(t + (ms ?? 0)));
    };
    if (start >= tuning.needsAttentionBelow && value < tuning.needsAttentionBelow) {
      events.push({ type: 'needs-attention', need, at: crossAt(tuning.needsAttentionBelow) });
    }
    if (
      need === 'fullness' &&
      care.activity.kind === 'awake' &&
      care.pendingRequest === null &&
      start >= tuning.foodRequestBelow &&
      value < tuning.foodRequestBelow
    ) {
      const at = crossAt(tuning.foodRequestBelow);
      events.push({ type: 'food-requested', at });
      care = { ...care, pendingRequest: { need: 'fullness', since: at } };
    }
  }
  return { ...care, ...next };
}

export interface AdvanceResult {
  readonly state: SimState;
  readonly events: readonly CareEvent[];
  readonly timeline: readonly ActivitySpan[];
}

/**
 * Moves care forward to `now`. Pure; never reads the clock. A `now` at or before
 * `care.updatedAt` returns the state unchanged (time never runs backwards).
 * Advancing to b in one call equals advancing to a then b (split invariance).
 */
export function advanceCare(state: SimState, now: number, tuning: CareTuning = DEFAULT_CARE_TUNING): AdvanceResult {
  const events: CareEvent[] = [];
  const timeline: ActivitySpan[] = [];
  let care = state.care;
  let t = care.updatedAt;
  if (now <= t) return { state, events, timeline };
  care = ensureFoodRequest(care, t, tuning, events);
  while (t < now) {
    let end = now;
    let wakes = false;
    if (care.activity.kind === 'asleep' && tuning.energyRecoveryPerHourAsleep > 0) {
      const wakeAt = t + ((1 - care.energy) / tuning.energyRecoveryPerHourAsleep) * HOUR_MS;
      if (wakeAt <= end) {
        end = wakeAt;
        wakes = true;
      }
    }
    if (care.sluggishUntil !== null && care.sluggishUntil > t && care.sluggishUntil < end) {
      end = care.sluggishUntil;
      wakes = false;
    }
    const activity = care.activity.kind;
    care = advanceSegment(care, t, end, tuning, events);
    pushSpan(timeline, { from: t, to: end, activity });
    t = end;
    if (wakes) {
      care = { ...care, energy: 1, activity: { kind: 'awake' } };
      events.push({ type: 'woke', cause: 'rested', at: Math.ceil(t) });
    }
    if (care.sluggishUntil !== null && care.sluggishUntil <= t) {
      events.push({ type: 'sluggish-ended', at: care.sluggishUntil });
      care = { ...care, sluggishUntil: null };
    }
    care = ensureFoodRequest(care, t, tuning, events);
  }
  return { state: { mon: state.mon, care: { ...care, updatedAt: now } }, events, timeline };
}

function pushSpan(timeline: ActivitySpan[], span: ActivitySpan): void {
  const last = timeline[timeline.length - 1];
  if (last !== undefined && last.activity === span.activity && last.to === span.from) {
    timeline[timeline.length - 1] = { ...last, to: span.to };
    return;
  }
  timeline.push(span);
}

export type CareOutcome =
  | { readonly kind: 'eaten' }
  | { readonly kind: 'overfed'; readonly sluggishUntil: number }
  | { readonly kind: 'fell-asleep' }
  | { readonly kind: 'woke'; readonly early: boolean }
  | { readonly kind: 'played' }
  | {
      readonly kind: 'declined';
      readonly reason: 'asleep' | 'sluggish' | 'already-asleep' | 'already-awake' | 'too-tired';
    };

export interface ActResult extends AdvanceResult {
  readonly outcome: CareOutcome;
}

/**
 * Applies one Caller action at time `at` (advancing first). An `at` earlier than
 * `care.updatedAt` is applied at `care.updatedAt`.
 */
export function applyCareAction(
  state: SimState,
  action: CareAction,
  at: number,
  tuning: CareTuning = DEFAULT_CARE_TUNING,
): ActResult {
  const advanced = advanceCare(state, at, tuning);
  const events = [...advanced.events];
  const { mon } = advanced.state;
  const care = advanced.state.care;
  const t = care.updatedAt;
  const done = (next: SimState, outcome: CareOutcome): ActResult => ({
    state: { mon: next.mon, care: ensureFoodRequest(next.care, t, tuning, events) },
    events,
    timeline: advanced.timeline,
    outcome,
  });
  const decline = (reason: Extract<CareOutcome, { kind: 'declined' }>['reason']): ActResult =>
    done(advanced.state, { kind: 'declined', reason });

  switch (action.kind) {
    case 'feed': {
      if (care.activity.kind === 'asleep') return decline('asleep');
      if (isSluggishAt(care, t)) return decline('sluggish');
      const answered = care.pendingRequest !== null;
      const overfed = care.fullness >= tuning.overfeedAtOrAbove;
      const bond = clamp01(mon.bond + tuning.feedBondGain + (answered ? tuning.answeredRequestBondGain : 0));
      const sluggishUntil = overfed ? t + tuning.sluggishDurationMs : null;
      if (sluggishUntil !== null) events.push({ type: 'became-sluggish', until: sluggishUntil, at: t });
      return done(
        {
          mon: { ...mon, bond },
          care: {
            ...care,
            fullness: clamp01(care.fullness + action.nutrition),
            lastFedAt: t,
            pendingRequest: null,
            sluggishUntil,
          },
        },
        sluggishUntil === null ? { kind: 'eaten' } : { kind: 'overfed', sluggishUntil },
      );
    }
    case 'rest': {
      if (care.activity.kind === 'asleep') return decline('already-asleep');
      events.push({ type: 'fell-asleep', at: t });
      return done(
        { mon, care: { ...care, activity: { kind: 'asleep', since: t }, lastRestedAt: t } },
        { kind: 'fell-asleep' },
      );
    }
    case 'wake': {
      if (care.activity.kind === 'awake') return decline('already-awake');
      const early = care.energy < tuning.earlyWakeEnergyBelow;
      events.push({ type: 'woke', cause: 'caller', at: t });
      const social = early ? clamp01(care.social - tuning.earlyWakeSocialCost) : care.social;
      return done({ mon, care: { ...care, social, activity: { kind: 'awake' } } }, { kind: 'woke', early });
    }
    case 'play': {
      if (care.activity.kind === 'asleep') return decline('asleep');
      if (care.energy < tuning.playMinEnergy) return decline('too-tired');
      return done(
        {
          mon: { ...mon, bond: clamp01(mon.bond + tuning.playBondGain * action.quality) },
          care: {
            ...care,
            social: clamp01(care.social + tuning.playSocialGain * action.quality),
            energy: clamp01(care.energy - tuning.playEnergyCost),
            lastSocialAt: t,
          },
        },
        { kind: 'played' },
      );
    }
    default:
      return assertNever(action);
  }
}

/** Fresh care state for a just-hatched individual. */
export function createInitialCareState(monInstanceId: string, at: number): CareState {
  return {
    monInstanceId,
    ...HATCHLING_CARE,
    updatedAt: at,
    lastFedAt: null,
    lastRestedAt: null,
    lastSocialAt: null,
    activity: { kind: 'awake' },
    sluggishUntil: null,
    pendingRequest: null,
  };
}

/** Needs below the "needs you" line, in meter order. Drives the M13 needs-you state. */
export function listUnmetNeeds(care: CareState, tuning: CareTuning = DEFAULT_CARE_TUNING): CareNeed[] {
  return (['energy', 'fullness', 'social'] as const).filter((need) => care[need] < tuning.needsAttentionBelow);
}
