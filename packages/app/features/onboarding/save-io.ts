import { loadSave, SaveLoadError } from '@acme/core/save';
import type { SaveCurrent } from '@acme/core/types';
import type { KeyValueStorage } from './storage.types';

/** Read and write access to the single sim save value. */
export interface SaveIO {
  /** The parsed save, or `undefined` when the value is missing or unreadable. Never throws on bad data. */
  read(): SaveCurrent | undefined;
  /** Replaces the stored save, then calls every write listener with it. */
  write(save: SaveCurrent): void;
  /**
   * Calls `listener` after every `write` through this binding, from any
   * caller (`writeSave`, `storeCallerProfile`, the Mon store). Returns the
   * subscription; `remove` is idempotent.
   */
  addOnWriteListener(listener: (save: SaveCurrent) => void): { remove: () => void };
}

/**
 * Binds the save codec to one key in one storage. `save-store.ts` binds it to
 * MMKV `nyc-mon-save`; tests bind it to memory.
 */
export function createSaveIO(storage: KeyValueStorage, key: string): SaveIO {
  const listeners = new Set<(save: SaveCurrent) => void>();
  return {
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
      storage.set(key, JSON.stringify(save));
      for (const listener of [...listeners]) listener(save);
    },
    addOnWriteListener: (listener) => {
      const entry = (save: SaveCurrent) => listener(save);
      listeners.add(entry);
      return { remove: () => listeners.delete(entry) };
    },
  };
}
