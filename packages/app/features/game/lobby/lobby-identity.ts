'use client';
import { deviceId, readSave } from '../../onboarding/save-store.ts';
import type { WorldIdentity } from '../world-resume/world-snapshot.ts';

// The Caller the lobby resumes for and the Game screen saves for, read the
// way M01 boot reads it (`packages/core/sim/boot.ts` routes on
// `save.caller`; the app's `features/onboarding/save-store.ts` reads the MMKV
// `nyc-mon-save` value). Synchronous and local: no network, no new Caller.
// `null` means no Caller has been stored on this H-Lynk yet, so no world can
// be resumed or saved (`resolveResume` would reject every candidate as
// `not-owner`). One reader for both screens, so they can never disagree.
//
// Device id (review finding M2): onboarding's `deviceId()`, which returns the
// Mon save's queue id when one exists and otherwise a persisted minted id, so
// the world save and the Mon write queue always name the same H-Lynk.

export function readLobbyIdentity(): WorldIdentity | null {
  const save = readSave();
  const caller = save?.caller;
  if (caller === undefined || caller === null) return null;
  return { playerId: caller.callerId, deviceId: deviceId() };
}
