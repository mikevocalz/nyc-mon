import { create } from 'zustand';
import { allSpecies } from '@acme/content';
import {
  applyCareAction,
  buildMonSceneInput,
  type CareOutcome,
  enqueueCareWrite,
  IDLE_PRESENCE,
  PHASE1_FEATURE_FLAGS,
  type ResolvedSceneMode,
  type ScenePresence,
} from '@acme/core/sim';
import type {
  BloodlineId,
  CareAction,
  CareState,
  LifecycleStage,
  MonInstance,
  MonSceneInput,
  SaveCurrent,
} from '@acme/core/types';
import type { SaveIO } from '../onboarding/save-io';

/**
 * The Mon store (ADR 0010). It holds the parsed save as read from {@linkcode SaveIO}
 * and writes every change back through it, so the save stays the only
 * persisted copy. Identity, starter, stage, care, evolution progress and
 * last-seen times are all read through the selectors below.
 */
export interface MonStoreState {
  /** The save as last read or written. `undefined` before {@linkcode MonStoreState.hydrate} or when no save exists. */
  readonly save: SaveCurrent | undefined;
  /** Which Mon the companion shows. Defaults to the first Mon in the save (DECISIONS.md #18 allows two). */
  readonly activeMonInstanceId: string | undefined;
  /** Reads the save. Call at app start; later writes through the same `SaveIO` arrive on their own. */
  hydrate: () => void;
  /** Switches the active Mon. Throws when the save has no Mon with that id. */
  setActiveMon: (monInstanceId: string) => void;
  /**
   * Applies a Caller care action at `atMs` through the sim, queues the server
   * write, persists the save and returns the sim's outcome. It re-reads the
   * save first, so a write another feature made since hydrate is kept, not
   * overwritten. Throws when there is no active Mon with care state.
   */
  applyCare: (action: CareAction, atMs: number) => CareOutcome;
}

function pickActive(save: SaveCurrent | undefined, preferred: string | undefined): string | undefined {
  if (save === undefined) return undefined;
  if (preferred !== undefined && save.mons.some((m) => m.monInstanceId === preferred)) return preferred;
  return save.mons[0]?.monInstanceId;
}

/**
 * Creates a Mon store bound to one save. The app binds it once, in
 * `mon.store.ts`. Every write through `io`, from this store or from another
 * feature, lands in the store, so it never needs a manual re-hydrate after a
 * write.
 */
export function createMonStore(io: SaveIO) {
  const store = create<MonStoreState>()((set, get) => ({
    save: undefined,
    activeMonInstanceId: undefined,
    hydrate: () => {
      const save = io.read();
      set({ save, activeMonInstanceId: pickActive(save, get().activeMonInstanceId) });
    },
    setActiveMon: (monInstanceId) => {
      if (get().save?.mons.some((m) => m.monInstanceId === monInstanceId) !== true) {
        throw new Error(`No Mon ${monInstanceId} in the save`);
      }
      set({ activeMonInstanceId: monInstanceId });
    },
    applyCare: (action, atMs) => {
      const save = io.read();
      const activeMonInstanceId = pickActive(save, get().activeMonInstanceId);
      const mon = save?.mons.find((m) => m.monInstanceId === activeMonInstanceId);
      const care = save?.care.find((c) => c.monInstanceId === activeMonInstanceId);
      if (save === undefined || mon === undefined || care === undefined) {
        throw new Error('applyCare needs an active Mon with care state; hydrate the store first');
      }
      const result = applyCareAction({ mon, care }, action, atMs);
      const { queue } = enqueueCareWrite(save.queue, { monInstanceId: mon.monInstanceId, at: atMs, action });
      const next: SaveCurrent = {
        ...save,
        savedAt: atMs,
        mons: save.mons.map((m) => (m.monInstanceId === mon.monInstanceId ? result.state.mon : m)),
        care: save.care.map((c) => (c.monInstanceId === mon.monInstanceId ? result.state.care : c)),
        queue,
      };
      io.write(next);
      return result.outcome;
    },
  }));
  io.addOnWriteListener((save) => {
    store.setState({ save, activeMonInstanceId: pickActive(save, store.getState().activeMonInstanceId) });
  });
  return store;
}

/** The active Mon's record, or `undefined` before hatch. */
export function selectActiveMon(state: MonStoreState): MonInstance | undefined {
  return state.save?.mons.find((m) => m.monInstanceId === state.activeMonInstanceId);
}

/** The active Mon's care state as last persisted (not advanced to now). */
export function selectActiveCare(state: MonStoreState): CareState | undefined {
  return state.save?.care.find((c) => c.monInstanceId === state.activeMonInstanceId);
}

export function selectStage(state: MonStoreState): LifecycleStage | undefined {
  return selectActiveMon(state)?.stage;
}

const bloodlineBySpecies = new Map(allSpecies.map((s) => [s.speciesId, s.bloodlineId]));

/** The starter's bloodline, looked up in `@acme/content`. `undefined` for a species content does not ship. */
export function selectStarterBloodlineId(state: MonStoreState): BloodlineId | undefined {
  const mon = selectActiveMon(state);
  return mon === undefined ? undefined : bloodlineBySpecies.get(mon.speciesId);
}

/** What evolution needs: stage, bond, and whether the Phase-1 flag allows it at all. */
export interface EvolutionProgress {
  readonly stage: LifecycleStage;
  readonly bond: number;
  readonly evolutionEnabled: boolean;
}

const progressByMon = new WeakMap<MonInstance, EvolutionProgress>();

/** Stable per Mon record, so it is safe as a zustand selector. */
export function selectEvolutionProgress(state: MonStoreState): EvolutionProgress | undefined {
  const mon = selectActiveMon(state);
  if (mon === undefined) return undefined;
  let progress = progressByMon.get(mon);
  if (progress === undefined) {
    progress = { stage: mon.stage, bond: mon.bond, evolutionEnabled: PHASE1_FEATURE_FLAGS.evolutionEnabled };
    progressByMon.set(mon, progress);
  }
  return progress;
}

/** When the active Mon was last advanced and last cared for. Epoch ms; null where never. */
export interface LastSeen {
  readonly careUpdatedAt: number;
  readonly lastFedAt: number | null;
  readonly lastRestedAt: number | null;
  readonly lastSocialAt: number | null;
}

const lastSeenByCare = new WeakMap<CareState, LastSeen>();

/** Stable per care record, so it is safe as a zustand selector. */
export function selectLastSeen(state: MonStoreState): LastSeen | undefined {
  const care = selectActiveCare(state);
  if (care === undefined) return undefined;
  let seen = lastSeenByCare.get(care);
  if (seen === undefined) {
    seen = {
      careUpdatedAt: care.updatedAt,
      lastFedAt: care.lastFedAt,
      lastRestedAt: care.lastRestedAt,
      lastSocialAt: care.lastSocialAt,
    };
    lastSeenByCare.set(care, seen);
  }
  return seen;
}

/**
 * Returns a selector for the renderer contract. `scene` is the
 * `resolveSceneMode` answer, so mode, placement, H-Lynk and anchors are the
 * resolver's and `street` cannot be passed. The selector caches on the Mon and
 * care records and returns the same object until either changes; create it
 * once per (scene, presence).
 */
export function selectSceneInput(
  scene: ResolvedSceneMode,
  presence: ScenePresence = IDLE_PRESENCE,
): (state: MonStoreState) => MonSceneInput | undefined {
  let last: { mon: MonInstance; care: CareState; input: MonSceneInput } | undefined;
  return (state) => {
    const mon = selectActiveMon(state);
    const care = selectActiveCare(state);
    const bloodlineId = selectStarterBloodlineId(state);
    if (mon === undefined || care === undefined || bloodlineId === undefined) return undefined;
    if (last?.mon === mon && last.care === care) return last.input;
    const input = buildMonSceneInput({ mon, care, bloodlineId, scene, presence });
    last = { mon, care, input };
    return input;
  };
}
