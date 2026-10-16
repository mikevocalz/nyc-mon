// Every visible and spoken string on G02, from
// docs/design/screens/G02-game-lobby/05-copy.md, keyed by the deck's ids.
// Pure: no React, no platform import, so node tests cover the composed
// strings. Nothing here invents a line the deck does not carry.
import { DISTRICT_NAME, type District } from '../district/districts.ts';
import type { ResumeFailure, ResumeRecovery, StartVariant } from './lobby-contract.ts';

export const LOBBY_COPY = {
  identityA11y: 'NYC-Mon',
  screenA11y: 'Game lobby',
  startLegend: 'START',
  startA11yNew: 'Start a new game',
  startA11yContinue: 'Continue your game',
  startHintNew: "Creates your Caller's first game",
  startHintContinue: 'Picks up exactly where you left off',
  startLoading: 'Getting you the keys🔑 to the City🏙️',
  /** Spoken form of `startLoading`: screen readers would read the emoji aloud. */
  startLoadingA11y: 'Getting you the keys to the City',
  startA11yRecover: 'Fix your last save',
  resumeTitleContinue: 'Continue your game',
  resumeTitleNew: 'Start a new game',
  resumeBodyNew: 'Your first walk through the city starts here.',
  resumeOffline: "You're offline. Your last save is on this H-Lynk.",
  failDataset: 'The city map changed since your last save. Your Mon and progress are safe.',
  failDatasetPrimary: 'Start from your last district',
  failDatasetSecondary: 'Start a new game',
  failUnreadable: "Your last save couldn't be read. Your Mon and progress are safe on the server.",
  failUnreadablePrimary: 'Restore from the server',
  failUnreadableSecondary: 'Not now',
  failNewer: "A newer save exists from another H-Lynk. This one wasn't written over.",
  failNewerPrimary: 'Continue from the newer save',
  failNewerSecondary: 'Keep this one',
  failOfflineNone: "You're offline and there's no save on this H-Lynk yet. Connect once to pick up your game.",
  failGeneric: "Your game couldn't open. Try again, and if it keeps happening, restart the app.",
  failGenericPrimary: 'Try again',
  recoveryDialogTitle: 'Before you continue',
  rankTitle: 'NYC Rank',
  rankSelf: 'You',
  rankLoading: 'Loading rankings',
  rankUnavailable: "Rankings aren't live yet.",
  rankUnavailableBody: 'When they are, your standing will show here.',
  rankEmpty: "Nobody's ranked yet.",
  rankEmptySelf: "You'll be the first.",
  rankError: "Rankings didn't load.",
  rankErrorAction: 'Try again',
} as const;

/** `g02.resume.district`: "Last seen in {district}". */
export function resumeDistrictLine(district: District): string {
  return `Last seen in ${DISTRICT_NAME[district]}`;
}

/** The START's accessible name per variant (`g02.start.a11y.*`), sentence case. */
export function startAccessibleName(variant: StartVariant, district?: District): string {
  switch (variant) {
    case 'new':
      return LOBBY_COPY.startA11yNew;
    case 'continue':
      return district === undefined
        ? LOBBY_COPY.startA11yContinue
        : `${LOBBY_COPY.startA11yContinue}, last seen in ${DISTRICT_NAME[district]}`;
    case 'recover':
      return LOBBY_COPY.startA11yRecover;
  }
}

/** The START's hint (`g02.start.hint.*`); the recover state has none in the deck. */
export function startHint(variant: StartVariant): string | undefined {
  switch (variant) {
    case 'new':
      return LOBBY_COPY.startHintNew;
    case 'continue':
      return LOBBY_COPY.startHintContinue;
    case 'recover':
      return undefined;
  }
}

/** The strip and dialog body for a failure (`g02.resume.fail.*`). */
export function failureLine(reason: ResumeFailure): string {
  switch (reason.kind) {
    case 'dataset-incompatible':
      return LOBBY_COPY.failDataset;
    case 'save-unreadable':
      return LOBBY_COPY.failUnreadable;
    case 'newer-save-elsewhere':
      return LOBBY_COPY.failNewer;
    case 'offline-no-snapshot':
      return LOBBY_COPY.failOfflineNone;
    case 'unknown':
      return LOBBY_COPY.failGeneric;
  }
}

/** A recovery button: its label and what it reports. */
export interface RecoveryAction {
  readonly label: string;
  readonly choice: 'from-district' | 'new-game' | 'restore-server' | 'use-newer' | 'keep-local' | 'retry' | 'not-now';
}

/** Every recovery the dialog can name. A host passes the subset it can actually perform. */
export const ALL_RECOVERY_CHOICES: ReadonlySet<RecoveryAction['choice']> = new Set([
  'from-district', 'new-game', 'restore-server', 'use-newer', 'keep-local', 'retry', 'not-now',
]);

/** What the deck offers for a failure, before the host's capabilities filter it. */
function deckActions(reason: ResumeFailure, recovery: ResumeRecovery): readonly RecoveryAction[] {
  switch (reason.kind) {
    case 'dataset-incompatible':
      return [
        { label: LOBBY_COPY.failDatasetPrimary, choice: 'from-district' },
        { label: LOBBY_COPY.failDatasetSecondary, choice: 'new-game' },
      ];
    case 'save-unreadable':
      return [
        { label: LOBBY_COPY.failUnreadablePrimary, choice: 'restore-server' },
        { label: LOBBY_COPY.failUnreadableSecondary, choice: 'not-now' },
      ];
    case 'newer-save-elsewhere':
      return recovery === 'keep-waiting'
        ? [{ label: LOBBY_COPY.failNewerPrimary, choice: 'use-newer' }]
        : [
            { label: LOBBY_COPY.failNewerPrimary, choice: 'use-newer' },
            { label: LOBBY_COPY.failNewerSecondary, choice: 'keep-local' },
          ];
    case 'offline-no-snapshot':
    case 'unknown':
      return [{ label: LOBBY_COPY.failGenericPrimary, choice: 'retry' }];
  }
}

/** The action that stands in when the host cannot perform any of the deck's: a deck string with a real effect. */
function fallbackAction(reason: ResumeFailure): RecoveryAction {
  switch (reason.kind) {
    case 'dataset-incompatible':
    case 'save-unreadable':
      return { label: LOBBY_COPY.failDatasetSecondary, choice: 'new-game' };
    case 'newer-save-elsewhere':
    case 'offline-no-snapshot':
    case 'unknown':
      return { label: LOBBY_COPY.failGenericPrimary, choice: 'retry' };
  }
}

/**
 * The dialog's primary and secondary buttons for a failure. The secondary is
 * absent when the deck has none for that failure, or when the core's
 * conflict rule disallows it (`keep-local` needs `recovery !== 'keep-waiting'`,
 * `05-copy.md` note on `g02.resume.fail.newer.action_secondary`).
 *
 * `available` is the set of choices the host can carry out (review finding
 * M12: a button that closes the dialog and changes nothing is a dead button).
 * Deck actions outside it are dropped; when no actionable one is left, the
 * reason's fallback (start a new game, or try again) becomes the primary.
 * `not-now` only dismisses, so it never stands as the primary on its own.
 *
 * @default available {@linkcode ALL_RECOVERY_CHOICES}
 */
export function recoveryActions(
  reason: ResumeFailure,
  recovery: ResumeRecovery,
  available: ReadonlySet<RecoveryAction['choice']> = ALL_RECOVERY_CHOICES,
): { primary: RecoveryAction; secondary?: RecoveryAction } {
  const offered = deckActions(reason, recovery).filter((action) => available.has(action.choice));
  const actionable = offered.filter((action) => action.choice !== 'not-now');
  const dismiss = offered.find((action) => action.choice === 'not-now');
  const primary = actionable[0] ?? fallbackAction(reason);
  const secondary = actionable.find((action) => action !== primary) ?? dismiss;
  return secondary === undefined ? { primary } : { primary, secondary };
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** `{age}` for `g02.rank.stale`: "4 minutes", "an hour", "3 days". Floored at one minute. */
export function relativeAge(ageMs: number): string {
  const ms = Number.isFinite(ageMs) ? Math.max(0, ageMs) : 0;
  const unit = (count: number, singular: string, plural: string, article: string) =>
    count === 1 ? `${article} ${singular}` : `${count} ${plural}`;
  if (ms < HOUR_MS) return unit(Math.max(1, Math.round(ms / MINUTE_MS)), 'minute', 'minutes', 'a');
  if (ms < DAY_MS) return unit(Math.round(ms / HOUR_MS), 'hour', 'hours', 'an');
  return unit(Math.round(ms / DAY_MS), 'day', 'days', 'a');
}

/** `g02.rank.stale`: "Last updated {age} ago". */
export function staleHeadline(updatedAtMs: number, nowMs: number): string {
  return `Last updated ${relativeAge(nowMs - updatedAtMs)} ago`;
}

/** `g02.rank.stale.a11y`. */
export function staleAccessibleLabel(updatedAtMs: number, nowMs: number): string {
  return `Rankings may be out of date, last updated ${relativeAge(nowMs - updatedAtMs)} ago`;
}

/** `g02.rank.row.a11y` / `g02.rank.row.self.a11y`. Score is never spoken: no unit exists (05-copy.md). */
export function rowAccessibleLabel(rank: number, name: string, isSelf: boolean): string {
  return isSelf ? `Rank ${rank}, you` : `Rank ${rank}, ${name}`;
}

/**
 * The spoken `{status}` of `g02.rank.a11y.region`: the state's own deck line.
 * `ready` and `stale` have none (review finding M22: "{n} rows" was not deck
 * copy); their rows and the stale strip are separate elements that speak for
 * themselves, so the region is announced by its title alone.
 */
export function rankStatusSpoken(status: 'loading' | 'ready' | 'empty' | 'stale' | 'error' | 'unavailable'): string | undefined {
  switch (status) {
    case 'loading':
      return LOBBY_COPY.rankLoading;
    case 'ready':
    case 'stale':
      return undefined;
    case 'empty':
      return LOBBY_COPY.rankEmpty;
    case 'error':
      return LOBBY_COPY.rankError;
    case 'unavailable':
      return LOBBY_COPY.rankUnavailable;
  }
}

/** `g02.rank.a11y.region`: "NYC Rank, {status}", or the title alone when the state has no status line. */
export function rankRegionLabel(statusSpoken: string | undefined): string {
  return statusSpoken === undefined ? LOBBY_COPY.rankTitle : `${LOBBY_COPY.rankTitle}, ${statusSpoken}`;
}
