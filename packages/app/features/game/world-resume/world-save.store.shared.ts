import { createStore } from 'zustand/vanilla';
import { loadWorldSave, type WorldSave, WorldSaveCurrentSchema, WorldSaveLoadError, type WorldSaveLoadFailure } from '@acme/core';

// WHERE THE WORLD SAVE LIVES: one key, `world-save`, as JSON, in the
// synchronous key-value store the platform fork hands over (MMKV id `world`
// on native). Synchronous is the requirement: the lobby decides resume
// before its first paint, and an async read would paint "Start" and then
// flip to "Continue your game".
//
// This store never bumps a revision itself. `commit` takes a save the
// cadence already stamped and refuses one that does not move the revision
// forward, so a late write from a stale closure cannot roll the world back.

export const WORLD_SAVE_KEY = 'world-save';
/** The H-Lynk's own id for world saves, minted once and kept beside the save (review finding M2). */
export const WORLD_DEVICE_KEY = 'world-device-id';
/** Where `clear` moves an unreadable save before forgetting it (review finding M20). */
export const WORLD_SAVE_QUARANTINE_KEY = 'world-save-quarantine';

/** The three operations the world save needs. MMKV has exactly this shape. */
export interface WorldSaveStorage {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
  remove: (key: string) => void;
}

/** What the lobby reads at boot. `unreadable` keeps the raw string so sync can still upload it for diagnosis. */
export type WorldSaveSnapshot =
  | { readonly status: 'missing' }
  | { readonly status: 'loaded'; readonly save: WorldSave }
  | { readonly status: 'unreadable'; readonly reason: WorldSaveLoadFailure; readonly raw: string };

export type CommitOutcome = 'written' | 'skipped-stale';

export interface WorldSaveState {
  readonly snapshot: WorldSaveSnapshot;
  /**
   * Writes `save` durably and atomically (one `set` of one key). Returns
   * `skipped-stale` without writing when a loaded save already has the same
   * or a higher revision. Throws if `save` fails the schema: a caller that
   * built an invalid save has a bug, and the disk must never see it.
   */
  readonly commit: (save: WorldSave) => CommitOutcome;
  /**
   * Forgets the world on this H-Lynk. Only the explicit "start new" recovery
   * calls this. An unreadable save is copied to
   * {@linkcode WORLD_SAVE_QUARANTINE_KEY} first so it can still be uploaded
   * for diagnosis; the latest quarantined value replaces an older one.
   */
  readonly clear: () => void;
}

/** Reads the stored value once. Never throws: a bad value is reported, not swallowed. */
export function readWorldSaveSnapshot(storage: WorldSaveStorage): WorldSaveSnapshot {
  const raw = storage.getString(WORLD_SAVE_KEY);
  if (raw === undefined) return { status: 'missing' };
  try {
    return { status: 'loaded', save: loadWorldSave(raw) };
  } catch (error) {
    if (error instanceof WorldSaveLoadError) return { status: 'unreadable', reason: error.reason, raw };
    throw error;
  }
}

export function createWorldSaveStore(storage: WorldSaveStorage, initial: WorldSaveSnapshot) {
  return createStore<WorldSaveState>((set, get) => ({
    snapshot: initial,
    commit: (save) => {
      const valid = WorldSaveCurrentSchema.parse(save);
      const { snapshot } = get();
      if (snapshot.status === 'loaded' && valid.revision <= snapshot.save.revision) return 'skipped-stale';
      storage.set(WORLD_SAVE_KEY, JSON.stringify(valid));
      set({ snapshot: { status: 'loaded', save: valid } });
      return 'written';
    },
    clear: () => {
      const { snapshot } = get();
      if (snapshot.status === 'unreadable') storage.set(WORLD_SAVE_QUARANTINE_KEY, snapshot.raw);
      storage.remove(WORLD_SAVE_KEY);
      set({ snapshot: { status: 'missing' } });
    },
  }));
}

export type WorldSaveStore = ReturnType<typeof createWorldSaveStore>;

/** A fresh device id: a UUID where the runtime has one, otherwise time plus randomness. */
export function mintDeviceId(): string {
  const uuid = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.();
  if (uuid !== undefined) return `device-${uuid}`;
  return `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * The stored device id, minted and persisted on the first read so every
 * later save names the same H-Lynk (review finding M2).
 */
export function readOrMintDeviceId(storage: WorldSaveStorage, mint: () => string = mintDeviceId): string {
  const existing = storage.getString(WORLD_DEVICE_KEY);
  if (existing !== undefined && existing !== '') return existing;
  const id = mint();
  storage.set(WORLD_DEVICE_KEY, id);
  return id;
}
