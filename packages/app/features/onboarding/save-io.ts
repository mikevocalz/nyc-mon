import { brokenSaveKey, keepsAsLastGood, lastGoodKey, type LastGoodSnapshot, loadSave, readLastGood, SaveLoadError } from '@acme/core/save';
import type { SaveCurrent } from '@acme/core/types';
import type { KeyValueStorage } from './storage.types';

/** Read and write access to the single sim save value. */
export interface SaveIO {
  /** The parsed save, or `undefined` when the value is missing or unreadable. Never throws on bad data. */
  read(): SaveCurrent | undefined;
  /**
   * Replaces the stored save, then calls every write listener with it. When
   * storage returns exactly what was written, the same bytes become the
   * last-good copy (M22).
   */
  write(save: SaveCurrent): void;
  /**
   * Calls `listener` after every `write` through this binding, from any
   * caller (`writeSave`, `storeCallerProfile`, the Mon store). Returns the
   * subscription; `remove` is idempotent.
   */
  addOnWriteListener(listener: (save: SaveCurrent) => void): { remove: () => void };
  /** The last save that was written intact, if there is one (M22). */
  lastGood(): LastGoodSnapshot;
  /**
   * M22 restore: moves the current (unreadable) value aside, then writes the
   * last-good copy as the save. Returns the restored save, or `undefined`
   * when there is no readable copy (nothing is changed then).
   */
  restoreLastGood(): SaveCurrent | undefined;
  /**
   * M22 start over: moves the current value aside and writes `fresh`. The
   * broken save is kept under its own key, never deleted.
   */
  startOver(fresh: SaveCurrent): void;
}

/**
 * Binds the save codec to one key in one storage. `save-store.ts` binds it to
 * MMKV `nyc-mon-save`; tests bind it to memory.
 */
export function createSaveIO(storage: KeyValueStorage, key: string): SaveIO {
  const listeners = new Set<(save: SaveCurrent) => void>();
  const keepBroken = () => {
    const current = storage.getString(key);
    if (current !== undefined) storage.set(brokenSaveKey(key), current);
  };
  const io: SaveIO = {
    read: () => {
      const raw = storage.getString(key);
      if (raw === undefined) return undefined;
      try {
        return loadSave(raw);
      } catch (error) {
        if (error instanceof SaveLoadError) return undefined;
        throw error;
      }
    },
    write: (save) => {
      const json = JSON.stringify(save);
      storage.set(key, json);
      if (keepsAsLastGood(json, storage.getString(key))) storage.set(lastGoodKey(key), json);
      for (const listener of [...listeners]) listener(save);
    },
    addOnWriteListener: (listener) => {
      const entry = (save: SaveCurrent) => listener(save);
      listeners.add(entry);
      return { remove: () => listeners.delete(entry) };
    },
    lastGood: () => readLastGood(storage.getString(lastGoodKey(key))),
    restoreLastGood: () => {
      const snapshot = io.lastGood();
      if (snapshot.status !== 'available') return undefined;
      keepBroken();
      io.write(snapshot.save);
      return snapshot.save;
    },
    startOver: (fresh) => {
      keepBroken();
      io.write(fresh);
    },
  };
  return io;
}
