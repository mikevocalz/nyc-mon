'use client';

import { createEmptySave, loadSave, SaveLoadError } from '@acme/core/save';
import type { CallerProfile, SaveCurrent } from '@acme/core/types';
import { SAVE_KEY } from './onboarding.store';
import { saveStorage } from './storage';

/**
 * Reads the MMKV sim save. Returns `undefined` for a missing or unreadable
 * value; M22-style recovery is the boot route's job, not a screen's.
 */
export function readSave(): SaveCurrent | undefined {
  const raw = saveStorage.getString(SAVE_KEY);
  if (raw === undefined) return undefined;
  try {
    return loadSave(raw);
  } catch (error) {
    if (error instanceof SaveLoadError) return undefined;
    throw error;
  }
}

/** Persists a save back to the single MMKV value. */
export function writeSave(save: SaveCurrent): void {
  saveStorage.set(SAVE_KEY, JSON.stringify(save));
}

/** The stable id this device's write queue uses, persisted once. */
export function deviceId(): string {
  const existing = readSave()?.queue.deviceId;
  if (existing !== undefined && existing !== '') return existing;
  const id = `device-${Date.now().toString(36)}`;
  return id;
}

/**
 * Writes the Caller record into the save (M07 Continue). Creates an empty
 * save first when none exists yet. The caller is only set once: a stored
 * profile is left alone so a resume cannot overwrite it.
 */
export function storeCallerProfile(caller: CallerProfile, nowMs: number): SaveCurrent {
  const save = readSave() ?? createEmptySave(deviceId(), nowMs);
  const next: SaveCurrent = { ...save, caller, savedAt: nowMs };
  writeSave(next);
  return next;
}
