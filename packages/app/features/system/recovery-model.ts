import type { SaveLoadFailure } from '@acme/core/save';
import type { SystemCopyId } from './copy.ts';

/**
 * M22 error / recovery. The brief's three states (save-recovered,
 * webgpu-unavailable, context-lost) plus the two "nothing to show" cases
 * that used to dead-end: M13 with no Mon and M17 with an unknown id.
 */
export const RECOVERY_STATES = ['save-recovered', 'webgpu-unavailable', 'context-lost', 'mon-missing', 'dex-not-found'] as const;
export type RecoveryState = (typeof RECOVERY_STATES)[number];

export const ERROR_PATH = '/(system)/error';

/** The M22 href for a state. Every call site builds its link here, so the param name lives in one place. */
export function recoveryHref(state: RecoveryState): `/(system)/error?state=${RecoveryState}` {
  return `${ERROR_PATH}?state=${state}`;
}

/** The state from a route param; `undefined` for anything unknown (the screen then shows the generic error). */
export function parseRecoveryState(raw: unknown): RecoveryState | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return RECOVERY_STATES.find((s) => s === value);
}

export type RecoveryAction = 'restore' | 'start-over' | 'use-2d' | 'retry-3d' | 'reload' | 'home' | 'back';

export const ACTION_COPY: Readonly<Record<RecoveryAction, SystemCopyId>> = {
  restore: 'm22.action.restore',
  'start-over': 'm22.action.start_over',
  'use-2d': 'm22.action.use_2d',
  'retry-3d': 'm22.action.retry_3d',
  reload: 'm22.action.reload',
  home: 'm22.action.home',
  back: 'm22.action.back',
};

export interface RecoveryContext {
  /** Whether the last-good copy reads cleanly. */
  readonly lastGood: 'available' | 'none' | 'unreadable';
  /** Why the save failed to load, when the state is save-recovered. */
  readonly reason?: SaveLoadFailure;
  /** A screen to return to exists (a cold deep link has none). */
  readonly canGoBack: boolean;
}

export interface RecoveryPlan {
  readonly state: RecoveryState;
  readonly titleId: SystemCopyId;
  readonly bodyId: SystemCopyId;
  /** A reassurance line under the body, when the state touches the save. */
  readonly noteId?: SystemCopyId;
  /** The one filled button. Never absent: M22 is never a dead end. */
  readonly primary: RecoveryAction;
  readonly secondary: readonly RecoveryAction[];
}

/** What M22 says and offers for a state. Pure, so every state is unit-tested. */
export function recoveryPlan(state: RecoveryState, ctx: RecoveryContext): RecoveryPlan {
  const canRestore = ctx.lastGood === 'available';
  switch (state) {
    case 'save-recovered': {
      const bodyId: SystemCopyId =
        ctx.reason === 'future-version' ? 'm22.save.body.newer' : canRestore ? 'm22.save.body.restore' : 'm22.save.body.none';
      return {
        state,
        titleId: 'm22.save.title',
        bodyId,
        noteId: 'm22.save.kept',
        primary: canRestore ? 'restore' : 'start-over',
        secondary: canRestore ? ['start-over'] : [],
      };
    }
    case 'webgpu-unavailable':
      return { state, titleId: 'm22.webgpu.title', bodyId: 'm22.webgpu.body', primary: 'use-2d', secondary: ['retry-3d'] };
    case 'context-lost':
      return { state, titleId: 'm22.lost.title', bodyId: 'm22.lost.body', primary: 'retry-3d', secondary: ['use-2d'] };
    case 'mon-missing':
      return {
        state,
        titleId: 'm22.mon.title',
        bodyId: 'm22.mon.body',
        primary: 'reload',
        secondary: canRestore ? ['restore'] : [],
      };
    case 'dex-not-found':
      return { state, titleId: 'm22.dex.title', bodyId: 'm22.dex.body', primary: 'home', secondary: ctx.canGoBack ? ['back'] : [] };
  }
}

/**
 * Which M22 state a 3D stage failure is. A stage that never got a backend
 * could not run here; one that ran and then lost it was dropped mid-session.
 */
export function stageFailureState(everStarted: boolean): Extract<RecoveryState, 'webgpu-unavailable' | 'context-lost'> {
  return everStarted ? 'context-lost' : 'webgpu-unavailable';
}
