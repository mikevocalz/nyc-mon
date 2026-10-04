import type { BootSave } from '../sim/boot.ts';
import { loadSave, SaveLoadError } from './migrate.ts';

/**
 * Reads the raw MMKV save value into the {@linkcode BootSave} that
 * `resolveBootRoute` takes. Never throws for a bad save: `undefined` is
 * `missing`, a {@linkcode SaveLoadError} is `unreadable` with its reason (M22).
 * Any other error is a bug and propagates.
 */
export function readBootSave(raw: string | undefined): BootSave {
  if (raw === undefined) return { status: 'missing' };
  try {
    return { status: 'loaded', save: loadSave(raw) };
  } catch (error) {
    if (error instanceof SaveLoadError) return { status: 'unreadable', reason: error.reason };
    throw error;
  }
}
