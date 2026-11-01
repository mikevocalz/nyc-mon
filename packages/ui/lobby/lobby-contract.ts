// The lobby's public prop contract (Master Directive v2 §3, §13; G02
// 08-handoff.md "Public prop contracts"). Types only, no React, no Rive, no
// renderer, so the app's stores and node tests import this path. The input
// contract in ../game-controls/contract.ts is not changed: `LeaderboardStatus`
// and `LayoutProfile` are re-used from it, never redefined.
//
// Discriminated unions over boolean flags, so impossible states cannot be
// represented: a `ready` leaderboard cannot lack rows, `stale` cannot lack
// `updatedAtMs`, a `failed` resume cannot lack a reason.
import type { District } from '../district/districts.ts';
import type { LeaderboardStatus } from '../game-controls/contract.ts';

/** Milliseconds since the Unix epoch; the save's own clock, never `Date.now()` at read time. */
export type EpochMs = number;

/**
 * Why the last save cannot be resumed as it is. Each kind has a strip and a
 * recovery dialog in `05-copy.md` ("Resume failure and recovery").
 *
 * @see {@linkcode ResumeSummary}
 */
export type ResumeFailure =
  | { readonly kind: 'dataset-incompatible' }
  | { readonly kind: 'save-unreadable' }
  | { readonly kind: 'newer-save-elsewhere' }
  | { readonly kind: 'offline-no-snapshot' }
  | { readonly kind: 'unknown' };

/**
 * The recovery the dialog offers for a {@linkcode ResumeFailure}. Mirrors
 * `ResumeRecovery` in `@acme/core` (`world/resume.ts`): `start-new` discards
 * nothing until the Caller confirms, `retry-sync` fetches the server copy,
 * `keep-waiting` has no action beyond closing the dialog.
 */
export type ResumeRecovery = 'start-new' | 'retry-sync' | 'keep-waiting';

/**
 * What the lobby shows about the save. The app derives it from
 * `resolveResume` (`@acme/core`) before the first paint, never from the
 * network.
 *
 * @see {@linkcode GameLobbyProps.resume}
 */
export type ResumeSummary =
  | { readonly kind: 'none' }
  | { readonly kind: 'eligible'; readonly district?: District; readonly savedAtMs: EpochMs; readonly revision: number }
  | { readonly kind: 'failed'; readonly reason: ResumeFailure; readonly recovery: ResumeRecovery }
  /** `eligible` with no network: resume from the latest committed snapshot (`g02.resume.offline`). */
  | { readonly kind: 'offline'; readonly district?: District; readonly savedAtMs: EpochMs; readonly revision: number };

/**
 * One row of the NYC Rank panel as the kit renders it.
 *
 * @see {@linkcode LeaderboardModel}
 */
export interface LeaderboardRow {
  readonly rank: number;
  /** The Caller name from M07; never a real name or photo. */
  readonly name: string;
  /** Present only when the ranking authority defines the metric; absent until then. */
  readonly score?: number;
  readonly isSelf: boolean;
  /** Stable id from the ranking authority; never the account id. */
  readonly playerId: string;
}

/**
 * The panel's view model, one variant per {@linkcode LeaderboardStatus}.
 * Built by the app from a `LeaderboardPage` (`@acme/core`), which reports
 * `error` with reason `no-ranking-authority`; the app maps that to
 * `unavailable` (contract.ts note on `LeaderboardStatus`).
 *
 * @see {@linkcode LeaderboardPanelProps.model}
 */
export type LeaderboardModel =
  | { readonly status: 'loading' }
  | { readonly status: 'unavailable' }
  | { readonly status: 'empty'; readonly selfEligible: boolean }
  | { readonly status: 'ready'; readonly rows: readonly LeaderboardRow[]; readonly self: LeaderboardRow | null }
  | {
      readonly status: 'stale';
      readonly rows: readonly LeaderboardRow[];
      readonly self: LeaderboardRow | null;
      readonly updatedAtMs: EpochMs;
    }
  | { readonly status: 'error'; readonly reason: string };

/** The status the Rive `leaderboard/status` enum takes for a model. */
export function leaderboardStatusOf(model: LeaderboardModel): LeaderboardStatus {
  return model.status;
}

/** Visual state the Rive `lobby/start/state` enum takes (start-angled scene.rml `StartState`). */
export type AngledStartState = 'idle' | 'pressed' | 'loading' | 'disabled';

/**
 * Which START the lobby shows. `continue` and `new` are the directive's two
 * behaviours; `recover` is the resume-failed state of the handoff (the press
 * opens the recovery dialog, label `g02.start.a11y.recover`).
 * Decision (2026-10-15): BUILD `recover` as a third variant rather than a
 * boolean next to `continue | new`, so a recovering START cannot also claim
 * to continue.
 */
export type StartVariant = 'continue' | 'new' | 'recover';

/** Phase of the cover between the lobby and the first gameplay frame (game-transition scene.rml `TransitionPhase`). */
export type TransitionPhase = 'enter' | 'hold' | 'reveal' | 'done';

/** Page scheme from the clock (D8). The Rive `theme/variant` enum takes the same values. */
export type ThemeVariant = 'daylit' | 'night';

/**
 * What the recovery dialog's buttons report. The app runs the chosen path;
 * the kit never discards a save.
 *
 * @see {@linkcode GameLobbyProps.onRecover}
 */
export type RecoveryChoice = 'from-district' | 'new-game' | 'restore-server' | 'use-newer' | 'keep-local' | 'retry' | 'not-now';
