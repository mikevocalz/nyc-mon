import type { SaveCurrent } from '../types/index.ts';
import { loadSave, type SaveLoadFailure, SaveLoadError } from './migrate.ts';

/**
 * The last good save (M22). Every write that lands intact is copied to a
 * second key, so a save that later reads as corrupt can be put back to the
 * last state this device stored without error. A broken save is never
 * deleted: recovery moves it to a third key first.
 */
export const lastGoodKey = (key: string): string => `${key}:last-good`;

/** Where recovery keeps the unreadable save it replaced, for support. */
export const brokenSaveKey = (key: string): string => `${key}:broken`;

export type LastGoodSnapshot =
  | { readonly status: 'none' }
  | { readonly status: 'available'; readonly save: SaveCurrent }
  | { readonly status: 'unreadable'; readonly reason: SaveLoadFailure };

/** Reads the last-good copy. Never throws for bad data; any other error is a bug and propagates. */
export function readLastGood(raw: string | undefined): LastGoodSnapshot {
  if (raw === undefined) return { status: 'none' };
  try {
    return { status: 'available', save: loadSave(raw) };
  } catch (error) {
    if (error instanceof SaveLoadError) return { status: 'unreadable', reason: error.reason };
    throw error;
  }
}

/**
 * Whether a write becomes the new last-good copy: only when the storage
 * returns exactly the bytes that were written. A short or failed write
 * leaves the previous copy in place.
 */
export function keepsAsLastGood(written: string, readBack: string | undefined): boolean {
  return readBack !== undefined && readBack === written;
}
