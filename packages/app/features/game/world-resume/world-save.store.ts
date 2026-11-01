// TS resolution anchor; Metro loads the .native fork. The Game tab never
// mounts on web (GameScreen.tsx: "apps/web never mounts it"), so this default
// keeps the world in memory only and writes nothing durable. A web world
// would need its own fork with IndexedDB behind the same `WorldSaveStorage`.
import { useStore } from 'zustand';
import { createWorldSaveStore, readOrMintDeviceId, type WorldSaveState, type WorldSaveStorage } from './world-save.store.shared.ts';

const memory = new Map<string, string>();
const storage: WorldSaveStorage = {
  getString: (key) => memory.get(key),
  set: (key, value) => {
    memory.set(key, value);
  },
  remove: (key) => {
    memory.delete(key);
  },
};

export const worldSaveStore = createWorldSaveStore(storage, { status: 'missing' });

export function useWorldSave<T>(selector: (state: WorldSaveState) => T): T {
  return useStore(worldSaveStore, selector);
}

/** This H-Lynk's world device id, persisted on first read. */
export function worldDeviceId(): string {
  return readOrMintDeviceId(storage);
}
