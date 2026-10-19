import { createStore } from 'zustand/vanilla';
import {
  DEFAULT_CONTROLLER_PROFILE,
  parseControllerProfile,
  patchControllerProfile,
  type ControllerProfile,
} from '@acme/ui/game-controls/parts';

/**
 * WHERE THE CONTROLLER PROFILE LIVES: one key, `controller-profile.v1`, as
 * JSON, in whatever synchronous key-value store the platform fork hands over
 * (the editor preferences pattern). Synchronous is the requirement: the
 * first frame of the overlay must already know the handedness and scale, or
 * the controls paint mirrored and then jump.
 *
 * `.v1` is the schema version (G03 08-handoff.md § Data). A future shape
 * writes `.v2` and a migration reads `.v1` once, never in place.
 *
 * One profile, one store (Master Directive v2 §13): the layout resolver and
 * the input adapters read it; the layout store beside this file holds saved
 * positions only, never a second copy of the profile.
 */
export const STORAGE_KEY = 'controller-profile.v1';

/** The three operations persistence needs. MMKV already has exactly this shape. */
export interface ControllerProfileStorage {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
  remove: (key: string) => void;
}

export interface ControllerProfileState {
  /** Schema-validated on read (Law 5); never a partial. */
  profile: ControllerProfile;
  /**
   * Apply a partial change. A patch that leaves any field out of its range
   * is dropped whole and the state is unchanged, so a settings slider can
   * never push the store into a profile the schema rejects.
   */
  set: (patch: Partial<ControllerProfile>) => void;
  /** Back to {@linkcode DEFAULT_CONTROLLER_PROFILE} and clear storage. */
  reset: () => void;
}

/**
 * Read and validate the saved profile. A blob that is not JSON or not a
 * valid profile is removed and the defaults are returned; a profile saved by
 * a newer build with extra keys loads with those keys stripped.
 */
export function readControllerProfile(storage: ControllerProfileStorage): ControllerProfile {
  const raw = storage.getString(STORAGE_KEY);
  if (raw === undefined) return DEFAULT_CONTROLLER_PROFILE;
  try {
    const parsed = parseControllerProfile(JSON.parse(raw));
    if (parsed === undefined) {
      storage.remove(STORAGE_KEY);
      return DEFAULT_CONTROLLER_PROFILE;
    }
    return parsed;
  } catch {
    storage.remove(STORAGE_KEY);
    return DEFAULT_CONTROLLER_PROFILE;
  }
}

/**
 * `initial` is a parameter rather than always `readControllerProfile(storage)`
 * because the two platforms disagree on when the saved value may first be
 * observed; see controller-profile.store.web.ts.
 */
export function createControllerProfileStore(storage: ControllerProfileStorage, initial: ControllerProfile) {
  return createStore<ControllerProfileState>((set, get) => {
    const persist = (profile: ControllerProfile) => {
      if (profile === DEFAULT_CONTROLLER_PROFILE) storage.remove(STORAGE_KEY);
      else storage.set(STORAGE_KEY, JSON.stringify(profile));
      set({ profile });
    };

    return {
      profile: initial,
      set: (patch) => {
        const current = get().profile;
        const next = patchControllerProfile(current, patch);
        if (next !== current) persist(next);
      },
      reset: () => persist(DEFAULT_CONTROLLER_PROFILE),
    };
  });
}
