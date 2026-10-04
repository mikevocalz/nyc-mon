import type { SaveLoadFailure } from '../save/migrate.ts';
import type { AgeAnswer, EggRecord, HatchState, SaveCurrent } from '../types/index.ts';
import { assertNever } from './assert-never.ts';
import { resolveCreateEntry } from './onboarding.ts';

// M01 boot routing: docs/design/screens/M01/08-handoff.md § States and § Data.
// Pure and synchronous over a local snapshot, so it fits the 240 ms boot budget
// and never waits on the network. Offline is not an input: every route resolves
// the same way with or without a connection.

/**
 * The save half of a {@linkcode BootSnapshot}. Build it with `readBootSave`
 * from `@acme/core/save`, which wraps `loadSave` and never throws.
 */
export type BootSave =
  | { readonly status: 'missing' }
  | { readonly status: 'loaded'; readonly save: SaveCurrent }
  | { readonly status: 'unreadable'; readonly reason: SaveLoadFailure };

/** Everything {@linkcode resolveBootRoute} reads. All of it is local; none of it needs I/O to evaluate. */
export interface BootSnapshot {
  /** The single MMKV save value, already read. */
  readonly save: BootSave;
  /** A local `@acme/auth` session exists. Read from storage only; never a network call. */
  readonly hasSession: boolean;
  /** The stored M04 answer, parsed with `AgeAnswerSchema`; `undefined` when M04 has not been answered. */
  readonly ageAnswer: AgeAnswer | undefined;
  /** Boot time, epoch ms. The only clock the route reads. */
  readonly nowMs: number;
}

/**
 * The onboarding step a returning-but-unfinished player resumes at.
 *
 * - `create-account`: M03 with the create intent (an age answer is stored, 13+).
 * - `guardian-consent`: M05 (an age answer is stored and needs consent).
 * - `caller-name`: M07 (a session whose server profile, already restored, has no Caller name).
 * - `egg-choice`: M08 (a Caller exists but has no egg or Mon yet).
 */
export type OnboardingStep = 'create-account' | 'guardian-consent' | 'caller-name' | 'egg-choice';

/** Where M01 sends this session. Produced by {@linkcode resolveBootRoute}; map it with an exhaustive `switch`. */
export type BootRoute =
  | { readonly kind: 'first-run' }
  | { readonly kind: 'restore' }
  | { readonly kind: 'resume-onboarding'; readonly step: OnboardingStep }
  | { readonly kind: 'incubating'; readonly eggId: string }
  | { readonly kind: 'egg-ready'; readonly eggId: string }
  | { readonly kind: 'companion'; readonly monInstanceId: string }
  | { readonly kind: 'consent-denied' }
  | { readonly kind: 'save-recovered'; readonly reason: SaveLoadFailure };

/**
 * Decides where M01 sends this session, from local state only.
 *
 * Order: unreadable save → `save-recovered` (M22); a session with no save on
 * this device → `restore` (the app fetches `GET /v1/me/mons` and the Caller
 * profile, writes the save, and calls this again); denied consent →
 * `consent-denied` (M05); a hatched Mon → `companion` (M13); an egg past
 * `incubationEndsAt` or mid-presentation → `egg-ready` (M11); an egg still
 * incubating → `incubating` (M11); a Caller with nothing yet → `egg-choice`;
 * no Caller → `caller-name` with a session (the restored profile had no
 * name), else the P1 entry (`create-account` / `guardian-consent` only with a
 * stored age answer), else `first-run` (M02).
 *
 * With several eggs, the earliest `incubationEndsAt` wins, ties by `eggId`.
 */
export function resolveBootRoute(snapshot: BootSnapshot): BootRoute {
  const { save } = snapshot;
  switch (save.status) {
    case 'missing':
      // A signed-in player on a fresh install: the server owns their Caller and
      // Mons ("a device session is a surface, not a new creature"). Lead ruling L2.
      return snapshot.hasSession ? { kind: 'restore' } : routeWithoutCaller(snapshot);
    case 'unreadable':
      return { kind: 'save-recovered', reason: save.reason };
    case 'loaded':
      return routeLoadedSave(save.save, snapshot);
    default:
      return assertNever(save);
  }
}

function routeWithoutCaller({ hasSession, ageAnswer, nowMs }: BootSnapshot): BootRoute {
  if (hasSession) return { kind: 'resume-onboarding', step: 'caller-name' };
  const entry = resolveCreateEntry({ ageAnswer, nowMs });
  switch (entry.kind) {
    case 'age-gate':
      return { kind: 'first-run' };
    case 'create-account':
      return { kind: 'resume-onboarding', step: 'create-account' };
    case 'guardian-consent':
      return { kind: 'resume-onboarding', step: 'guardian-consent' };
    default:
      return assertNever(entry);
  }
}

function routeLoadedSave(save: SaveCurrent, snapshot: BootSnapshot): BootRoute {
  const { caller } = save;
  if (caller === null) return routeWithoutCaller(snapshot);
  if (caller.consentStatus === 'denied') return { kind: 'consent-denied' };

  const monInstanceId = save.mons[0]?.monInstanceId ?? hatchedMonId(save.hatches);
  if (monInstanceId !== undefined) return { kind: 'companion', monInstanceId };

  const eggs = unhatchedEggs(save);
  const ready = eggs.find((egg) => isEggReady(egg, save.hatches, snapshot.nowMs));
  if (ready !== undefined) return { kind: 'egg-ready', eggId: ready.eggId };
  const incubating = eggs[0];
  if (incubating !== undefined) return { kind: 'incubating', eggId: incubating.eggId };

  return { kind: 'resume-onboarding', step: 'egg-choice' };
}

/** A hatch that committed its individual but whose Mon has not been copied into `mons` yet. */
function hatchedMonId(hatches: readonly HatchState[]): string | undefined {
  for (const hatch of hatches) {
    if (hatch.kind === 'hatched') return hatch.mon.monInstanceId;
  }
  return undefined;
}

/** Eggs with no Mon yet, earliest `incubationEndsAt` first, ties by `eggId`. */
function unhatchedEggs(save: SaveCurrent): EggRecord[] {
  const minted = new Set(save.mons.map((mon) => mon.monInstanceId));
  return save.eggs
    .filter((egg) => !minted.has(egg.monInstanceId))
    .sort((a, b) => a.incubationEndsAt - b.incubationEndsAt || (a.eggId < b.eggId ? -1 : a.eggId > b.eggId ? 1 : 0));
}

/** Same edge as `transitionHatch`'s `tick`: ready at `incubationEndsAt`. A presenting hatch resumes on M11. */
function isEggReady(egg: EggRecord, hatches: readonly HatchState[], nowMs: number): boolean {
  const hatch = hatches.find((h) => h.eggId === egg.eggId);
  if (hatch !== undefined && hatch.kind !== 'incubating') return true;
  return nowMs >= egg.incubationEndsAt;
}
