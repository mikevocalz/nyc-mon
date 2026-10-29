import { SNACK_NUTRITION, type MonCareAction } from '@acme/core/sim';
import type { MonSpaceIntent } from './mon-space-model.ts';

/** The food a snack serves (contract §1: a `feed` with `foodClassId: 'snack'`, so the server replays it). */
export const SNACK_FOOD = { foodClassId: 'snack', nutrition: SNACK_NUTRITION } as const;

/**
 * The sim actions an intent applies, in order. Empty for intents that only
 * open something (status, the pause confirm, Peek) or only explain.
 * Lights off on an awake Mon is bed then dark: `rest`, then `lights` off.
 */
export function actionsFor(intent: MonSpaceIntent): readonly MonCareAction[] {
  switch (intent.kind) {
    case 'meal':
      return [{ kind: 'feed' }];
    case 'snack':
      return [{ kind: 'feed', food: SNACK_FOOD }];
    case 'lights-off':
      return intent.alsoRest ? [{ kind: 'rest' }, { kind: 'lights', on: false }] : [{ kind: 'lights', on: false }];
    case 'lights-on':
      return [{ kind: 'lights', on: true }];
    case 'clean':
      return [{ kind: 'clean' }];
    case 'medicine':
      return [{ kind: 'medicine' }];
    case 'boundary':
      return [{ kind: 'discipline' }];
    case 'resume':
      return [{ kind: 'resume' }];
    case 'peek':
    case 'status':
    case 'confirm-pause':
    case 'explain':
      return [];
    default:
      return intent satisfies never;
  }
}

/** The pause itself, after the confirm. */
export const PAUSE_ACTION: MonCareAction = { kind: 'pause' };
