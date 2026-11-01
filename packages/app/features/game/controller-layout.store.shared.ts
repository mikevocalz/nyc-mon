import { createStore } from 'zustand/vanilla';
import {
  EMPTY_SAVED_LAYOUTS,
  clampControlOffset,
  clampControlScale,
  parseSavedControlLayouts,
  type ControlOffset,
  type LayoutProfile,
  type MovableControl,
  type SavedControlLayouts,
} from '@acme/ui/game-controls/layout/parts';

/**
 * WHERE SAVED CONTROLLER POSITIONS LIVE: one key, `controller-layout`, as
 * JSON, in whatever synchronous key-value store the platform fork hands over
 * (the editor preferences pattern). Synchronous is the requirement: the first
 * frame must already place the stick where the player left it, or the
 * controller paints the default and then jumps.
 *
 * This store holds offsets and a scale per LayoutProfile only. It never holds
 * rects: the rects come from the resolver, which revalidates every offset
 * against the live window, insets and hinge on each metrics change. The one
 * controller profile (handedness, scale, stick tuning) is lane C1's
 * controller-profile store; there is no second profile system here.
 */
export const STORAGE_KEY = 'controller-layout';

/** The three operations persistence needs. MMKV already has exactly this shape. */
export interface ControllerLayoutStorage {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
  remove: (key: string) => void;
}

export interface ControllerLayoutState {
  /** Shape-validated on read; geometry-validated by the resolver on use. */
  layouts: SavedControlLayouts;
  /** Save where a group was dragged to, as an offset from its default place for `profile`. */
  setOffset: (profile: LayoutProfile, control: MovableControl, offset: ControlOffset) => void;
  /** Save a control scale for `profile` only. Clamped to 0.8…1.4. */
  setScale: (profile: LayoutProfile, scale: number) => void;
  /** Forget one profile's customization, or every profile's when omitted. */
  reset: (profile?: LayoutProfile) => void;
}

/**
 * Read and validate the saved map. A blob that is not JSON is removed; a blob
 * whose entries fail validation keeps only the valid ones. Either way the
 * resolver's defaults cover whatever was dropped, and defaults are always a
 * safe layout.
 */
export function readControllerLayouts(storage: ControllerLayoutStorage): SavedControlLayouts {
  const raw = storage.getString(STORAGE_KEY);
  if (raw === undefined) return EMPTY_SAVED_LAYOUTS;
  try {
    return parseSavedControlLayouts(JSON.parse(raw));
  } catch {
    storage.remove(STORAGE_KEY);
    return EMPTY_SAVED_LAYOUTS;
  }
}

/**
 * `initial` is a parameter rather than always `readControllerLayouts(storage)`
 * because the two platforms disagree on when the saved value may first be
 * observed; see controller-layout.store.web.ts.
 */
export function createControllerLayoutStore(storage: ControllerLayoutStorage, initial: SavedControlLayouts) {
  return createStore<ControllerLayoutState>((set, get) => {
    const persist = (layouts: SavedControlLayouts) => {
      if (Object.keys(layouts).length === 0) storage.remove(STORAGE_KEY);
      else storage.set(STORAGE_KEY, JSON.stringify(layouts));
      set({ layouts });
    };

    return {
      layouts: initial,
      setOffset: (profile, control, offset) => {
        const clamped = clampControlOffset(offset);
        const current = get().layouts;
        persist({ ...current, [profile]: { ...current[profile], [control]: clamped } });
      },
      setScale: (profile, scale) => {
        const clamped = clampControlScale(scale);
        const current = get().layouts;
        persist({ ...current, [profile]: { ...current[profile], scale: clamped } });
      },
      reset: (profile) => {
        if (profile === undefined) {
          persist(EMPTY_SAVED_LAYOUTS);
          return;
        }
        const { [profile]: _dropped, ...rest } = get().layouts;
        persist(rest);
      },
    };
  });
}
