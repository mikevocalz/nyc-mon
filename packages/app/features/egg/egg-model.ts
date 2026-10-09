import { bloodlineLabel, type StarterEgg } from '@acme/content';
import type { Bloodline, BloodlineId, IncubationMinutes } from '@acme/core/types';

/**
 * Pure logic for M08 (egg choice) and M10 (incubation choice). No React, no
 * platform modules, so it runs under `node --test`.
 */

/** M11 and M13 both render at the `(home)` group index (M11 handoff "Route"). Lane 2 owns the route. */
export const MON_HOME_PATH = '/(home)' as const;
/** M08 (D-16a). */
export const MEET_PATH = '/(onboarding)/meet' as const;
/** M10, `?bloodline=F01|F02|F12`. */
export const INCUBATE_PATH = '/(onboarding)/incubate' as const;
/** M06 form sheet over M10. */
export const NOTIFY_SHEET_PATH = '/(onboarding)/notify' as const;

/** One egg as M08 and M10 show it. Every field comes from `@acme/content`; nothing is typed by hand. */
export interface EggView {
  readonly bloodlineId: BloodlineId;
  readonly eggName: string;
  readonly dexId: number;
  /** `dexId` zero-padded to three digits (`m08.card.number`). */
  readonly dexNumber: string;
  /** `bloodlineLabel` from `@acme/content` (Decision #11). */
  readonly bloodline: string;
  /** 1-based slot (`{index} of 3`). */
  readonly index: number;
}

/** The starter eggs in slot order, joined to their Bloodline label. Throws when a Bloodline is missing (content broken). */
export function buildEggViews(
  starterEggs: readonly StarterEgg[],
  allBloodlines: readonly Pick<Bloodline, 'bloodlineId' | 'bloodlineName'>[],
): readonly EggView[] {
  return starterEggs.map((egg, i) => {
    const line = allBloodlines.find((b) => b.bloodlineId === egg.bloodlineId);
    if (line === undefined) throw new Error(`No Bloodline ${egg.bloodlineId} in @acme/content`);
    return {
      bloodlineId: egg.bloodlineId,
      eggName: egg.eggName,
      dexId: egg.dexId,
      dexNumber: String(egg.dexId).padStart(3, '0'),
      bloodline: bloodlineLabel(line),
      index: i + 1,
    };
  });
}

/** The route's `bloodline` param as one of the starter eggs, or `undefined` (M10 then replaces itself with M08). */
export function parseBloodlineParam(raw: string | readonly string[] | undefined, views: readonly EggView[]): EggView | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' ? views.find((v) => v.bloodlineId === value) : undefined;
}

/**
 * M08 / M10 re-entry guard: a Caller with a Mon or an unhatched egg never sees
 * a second choice (D-16e). Both land on `/(home)`, which renders M11 or M13.
 */
export function entryRedirect(input: { readonly hasMon: boolean; readonly hasPendingEgg: boolean }): typeof MON_HOME_PATH | undefined {
  return input.hasMon || input.hasPendingEgg ? MON_HOME_PATH : undefined;
}

// ---------------------------------------------------------------- M08 states

/** M08 states (handoff § States). `chosen` is a navigation, not a stored phase. */
export type MeetPhase = 'browsing' | 'approaching' | 'confirming';

export interface MeetState {
  readonly phase: MeetPhase;
  /** null only while browsing. */
  readonly focused: number | null;
}

export const MEET_INITIAL: MeetState = { phase: 'browsing', focused: null };

/** Trackpad flick, VoiceOver adjust, or the Previous/Next actions. Browsing: either direction focuses tile 1. Confirming: disabled. */
export function meetStep(state: MeetState, direction: -1 | 1, count: number): MeetState {
  switch (state.phase) {
    case 'browsing':
      return { phase: 'approaching', focused: 0 };
    case 'approaching': {
      const at = state.focused ?? 0;
      return { phase: 'approaching', focused: (at + direction + count) % count };
    }
    case 'confirming':
      return state;
  }
}

/** A tile pressed, an arrow key, or Escape (`null`) from the triptych. */
export function meetFocus(state: MeetState, index: number | null): MeetState {
  if (index === null) return MEET_INITIAL;
  if (state.phase === 'confirming' && state.focused === index) return state;
  return { phase: 'approaching', focused: index };
}

/** The H-Lynk Back key: confirming → approaching → browsing → leave the screen. */
export function meetBack(state: MeetState): MeetState | 'leave' {
  switch (state.phase) {
    case 'browsing':
      return 'leave';
    case 'approaching':
      return MEET_INITIAL;
    case 'confirming':
      return { phase: 'approaching', focused: state.focused };
  }
}

/** The `Choose the {eggName}` button: asks to confirm (D-16d). */
export function meetAskConfirm(state: MeetState): MeetState {
  return state.phase === 'approaching' ? { phase: 'confirming', focused: state.focused } : state;
}

/** M10's href for the chosen egg. The choice lives only here until M10 writes it (D-16c). */
export function incubateHref(bloodlineId: BloodlineId): `${typeof INCUBATE_PATH}?bloodline=${string}` {
  return `${INCUBATE_PATH}?bloodline=${encodeURIComponent(bloodlineId)}`;
}

// ---------------------------------------------------------------- M10

/**
 * Trackpad step on the ring: shorter / longer, clamped at the ends. From no
 * choice, +1 picks the shortest and -1 the longest (M10 handoff "Trackpad").
 */
export function stepMinutes<V extends number>(
  stops: readonly V[],
  current: V | null,
  direction: -1 | 1,
): V {
  const last = stops.length - 1;
  if (current === null) return stops[direction === 1 ? 0 : last]!;
  const at = stops.indexOf(current);
  const next = Math.min(last, Math.max(0, (at < 0 ? 0 : at) + direction));
  return stops[next]!;
}

/** Copy id and time for `m10.ready` / `m10.ready.tomorrow`. `formatTime` uses the device locale (never hard-codes "PM"). */
export function readyAt(
  nowMs: number,
  minutes: IncubationMinutes,
  formatTime: (atMs: number) => string,
): { readonly id: 'm10.ready' | 'm10.ready.tomorrow'; readonly time: string; readonly endsAtMs: number } {
  const endsAtMs = nowMs + minutes * 60_000;
  const now = new Date(nowMs);
  const end = new Date(endsAtMs);
  const sameDay =
    now.getFullYear() === end.getFullYear() && now.getMonth() === end.getMonth() && now.getDate() === end.getDate();
  return { id: sameDay ? 'm10.ready' : 'm10.ready.tomorrow', time: formatTime(endsAtMs), endsAtMs };
}

/** The LED chip after the case closes (`m10.led.chip`): minutes left, rounded up; a full hour reads as one hour. */
export function ledChip(remainingMs: number): { readonly id: 'm10.led.chip' | 'm10.led.chip.hour'; readonly minutes: number } {
  const minutes = Math.max(0, Math.ceil(remainingMs / 60_000));
  return minutes === 60 ? { id: 'm10.led.chip.hour', minutes } : { id: 'm10.led.chip', minutes };
}

/**
 * What follows the closed case (M10 "States" → confirmed). The M06 sheet only
 * when the OS permission is still undecided (P2); with permission already
 * granted M10 schedules the one notification itself; otherwise straight to M11.
 */
export function afterCaseClosed(permission: 'undetermined' | 'granted' | 'denied' | 'unsupported'): 'sheet' | 'schedule-then-home' | 'home' {
  if (permission === 'undetermined') return 'sheet';
  if (permission === 'granted') return 'schedule-then-home';
  return 'home';
}
