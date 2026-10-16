'use client';

import { useEffect } from 'react';
import { AppState } from 'react-native';
import type { SaveReason, SessionEffect } from '@acme/core';
import { assertNever } from '@acme/core';
import { gameCameraStore } from '../game-session.ts';
import type { CityDataset } from '../city-dataset.ts';
import { decideSave, draftRevision, guardedSave, SAVE_INTERVAL_MS, type SaveTrigger } from './save-cadence.ts';
import { buildWorldSave, cameraChangedSince, ownedPrevious, type WorldIdentity } from './world-snapshot.ts';
import { worldSaveStore } from './world-save.store.ts';
import { worldSessionStore } from './world-session.store.ts';

// One commit path for every save trigger (Master Directive v2 §3 "Save
// lifecycle"): AppState background → session `background` → `request-save`;
// pill pause/stop → `request-save` (the pill dispatches to worldSessionStore
// and hands its effects here); a 15 s ticker while playing. Nothing here is
// subscribed to the camera store: a gesture never writes.
//
// Mount once, on the Game route. `identity` is null until the Caller is
// known; without it nothing is saved, because a save without an owner can
// never be resumed (resolveResume rejects it as `not-owner`).

export interface WorldSaveLifecycleInput {
  readonly identity: WorldIdentity | null;
  readonly dataset: CityDataset | null;
}

function triggerOf(reason: SaveReason): SaveTrigger {
  switch (reason) {
    case 'pause':
      return 'pause';
    case 'background':
      return 'background';
    case 'stop':
      return 'stop';
    default:
      return assertNever(reason);
  }
}

/** Decides and, when the cadence agrees, commits one save. Returns true when a write happened. */
export function saveWorldNow(trigger: SaveTrigger, input: WorldSaveLifecycleInput, now: number = Date.now()): boolean {
  const { identity, dataset } = input;
  if (identity === null || dataset === null) return false;
  const session = worldSessionStore.getState().session;
  if (session.kind === 'idle' && trigger !== 'stop') return false;
  const { snapshot, commit } = worldSaveStore.getState();
  const owned = ownedPrevious(snapshot.status === 'loaded' ? snapshot.save : null, identity);
  // Another Caller's world is never continued or overwritten from here (review finding M1).
  if (owned === 'foreign') return false;
  const previous = owned;
  const { camera } = gameCameraStore.getState();
  const pill = worldSessionStore.getState().pill;
  const decision = decideSave({
    trigger,
    pill,
    now,
    lastSavedAt: previous?.savedAt ?? null,
    storedRevision: previous?.revision ?? 0,
    draftRevision: draftRevision(previous?.revision ?? 0, cameraChangedSince(previous, camera, pill)),
  });
  if (!decision.save) return false;
  // A stop has already moved the session to idle; the final save still belongs to the session that ended.
  const sessionId = session.kind === 'idle' ? (previous?.sessionId ?? null) : session.sessionId;
  if (sessionId === null) return false;
  return commit(buildWorldSave({ previous, identity, sessionId, camera, dataset, pill, now })) === 'written';
}

/** Runs the effects a `worldSessionStore.dispatch` returned. The pill's handlers call this with theirs. */
export function runSessionEffects(effects: readonly SessionEffect[], input: WorldSaveLifecycleInput): void {
  for (const effect of effects) {
    switch (effect.kind) {
      case 'request-save':
        saveWorldNow(triggerOf(effect.reason), input, effect.at);
        break;
      default:
        assertNever(effect.kind);
    }
  }
}

/** Background and the periodic ticker. The pill and explicit exit go through {@linkcode runSessionEffects}. */
export function useWorldSaveLifecycle(input: WorldSaveLifecycleInput): void {
  const { identity, dataset } = input;
  useEffect(() => {
    const current: WorldSaveLifecycleInput = { identity, dataset };
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'background') return;
      guardedSave('background', () => {
        runSessionEffects(worldSessionStore.getState().dispatch({ type: 'background', at: Date.now() }), current);
      });
    });
    const ticker = setInterval(() => guardedSave('tick', () => { saveWorldNow('tick', current); }), SAVE_INTERVAL_MS);
    return () => {
      subscription.remove();
      clearInterval(ticker);
      // Leaving the route is an exit: write what the player last saw.
      guardedSave('exit', () => { saveWorldNow('exit', current); });
    };
  }, [identity, dataset]);
}
