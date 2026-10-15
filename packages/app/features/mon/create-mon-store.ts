import { create } from 'zustand';
import { allSpecies, eggs as starterEggs } from '@acme/content';
import {
  advanceCare,
  appendCareToJournal,
  appendJournalEntry,
  applyCareAction,
  buildMonSceneInput,
  type CareOutcome,
  countDaysTogether,
  createEggRecord,
  createHatchState,
  createInitialCareState,
  enqueueCareWrite,
  enqueueEggCreate,
  type HatchEvent,
  IDLE_PRESENCE,
  isCallerUnder13,
  isStoredMonName,
  pendingEggs,
  PHASE1_FEATURE_FLAGS,
  type ResolvedSceneMode,
  type ScenePresence,
  toCreateEggRequest,
  transitionHatch,
} from '@acme/core/sim';
import type {
  BloodlineId,
  CareAction,
  CareState,
  EggRecord,
  HatchState,
  IncubationMinutes,
  JournalEntry,
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
  /**
   * Applies one `HatchEvent` to the egg's hatch state through
   * `transitionHatch` and persists the result in ONE write. On the edge into
   * `hatched` the same write appends the Mon, its care and the journal's
   * `hatched` entry, so no reader ever sees a hatched egg without its Mon.
   * Care starts at `atMs`, the moment the hatch completes, not at
   * `incubationEndsAt` (D-15f); `mon.hatchedAt` keeps its deterministic value.
   * Re-reads the save first. A transition that changes nothing writes
   * nothing. Returns the new hatch state. Throws `HatchIntegrityError`
   * unchanged, and an `Error` when the save has no egg `eggId`.
   */
  applyHatch: (eggId: string, event: HatchEvent, atMs: number) => HatchState;
  /**
   * Creates the Caller's egg for the chosen Bloodline (M10 confirm), reserves
   * its `monInstanceId`, starts the hatch state machine, queues
   * `POST /v1/eggs` with the same `eggId`, and persists the save in one
   * write. The nickname is always null (naming comes after the hatch,
   * D-16f). Idempotent: when an unhatched egg exists it returns that egg and
   * writes nothing. Throws when the save has no Caller, already has a Mon,
   * or `bloodlineId` is not a starter egg in `@acme/content`.
   */
  startIncubation: (input: {
    readonly bloodlineId: BloodlineId;
    readonly minutes: IncubationMinutes;
    readonly atMs: number;
  }) => EggRecord;
  /**
   * Names the active Mon (M09). Writes only when its nickname is null, so a
   * double submit or a replay is a no-op that returns the stored Mon.
   * Changes `nickname` only and appends the journal's `named` entry.
   * Local-first: no server endpoint accepts a nickname yet (§1.4), so
   * nothing is queued. `name` must already have passed `validateMonName`;
   * throws `RangeError` for a name that is not in stored form, and `Error`
   * when there is no active Mon.
   */
  nameActiveMon: (name: string, atMs: number) => MonInstance;
}

/** Options for {@linkcode createMonStore}. */
export interface MonStoreOptions {
  /**
   * Mints a new `eggId` for {@linkcode MonStoreState.startIncubation}. Must
   * be unique per egg and fit `IdSchema` (1–128 chars). Defaults to
   * `crypto.randomUUID()`.
   */
  readonly newEggId?: () => string;
}

function defaultNewEggId(): string {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new Error('crypto.randomUUID is unavailable; pass MonStoreOptions.newEggId');
  }
  return `egg-${globalThis.crypto.randomUUID()}`;
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
export function createMonStore(io: SaveIO, options: MonStoreOptions = {}) {
  const newEggId = options.newEggId ?? defaultNewEggId;
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
      // Clock rollback must not reverse the server replay order.
      const effectiveAt = result.state.care.updatedAt;
      const { queue } = enqueueCareWrite(save.queue, { monInstanceId: mon.monInstanceId, at: effectiveAt, action });
      const journal = appendCareToJournal(save.journal, {
        monInstanceId: mon.monInstanceId,
        at: result.state.care.updatedAt,
        outcome: result.outcome,
        events: result.events,
      });
      const next: SaveCurrent = {
        ...save,
        savedAt: effectiveAt,
        mons: save.mons.map((m) => (m.monInstanceId === mon.monInstanceId ? result.state.mon : m)),
        care: save.care.map((c) => (c.monInstanceId === mon.monInstanceId ? result.state.care : c)),
        queue,
        journal: [...journal],
      };
      io.write(next);
      return result.outcome;
    },
    applyHatch: (eggId, event, atMs) => {
      const save = io.read();
      const egg = save?.eggs.find((e) => e.eggId === eggId);
      if (save === undefined || egg === undefined) throw new Error(`No egg ${eggId} in the save`);
      const hatch = save.hatches.find((h) => h.eggId === eggId) ?? createHatchState(egg);
      const next = transitionHatch(hatch, event, egg);
      if (next === hatch && save.hatches.includes(hatch)) return hatch;
      const hatches = save.hatches.some((h) => h.eggId === eggId)
        ? save.hatches.map((h) => (h.eggId === eggId ? next : h))
        : [...save.hatches, next];
      let { mons, care, journal } = save;
      const newMon = next.kind === 'hatched' && !mons.some((m) => m.monInstanceId === next.mon.monInstanceId);
      if (newMon) {
        mons = [...mons, next.mon];
        care = [...care, createInitialCareState(next.mon.monInstanceId, atMs)];
        journal = [...appendJournalEntry(journal, { monInstanceId: next.mon.monInstanceId, kind: 'hatched', at: atMs })];
      }
      io.write({ ...save, savedAt: atMs, hatches, mons, care, journal });
      if (newMon) set({ activeMonInstanceId: next.mon.monInstanceId });
      return next;
    },
    startIncubation: ({ bloodlineId, minutes, atMs }) => {
      const save = io.read();
      if (save?.caller == null) throw new Error('startIncubation needs a Caller in the save');
      const existing = pendingEggs(save)[0];
      if (existing !== undefined) return existing;
      if (save.mons.length > 0 || save.hatches.some((h) => h.kind === 'hatched')) {
        throw new Error('startIncubation: this Caller already has a Mon (one egg per Caller, D-16e)');
      }
      const starter = starterEggs.find((e) => e.bloodlineId === bloodlineId);
      if (starter === undefined) throw new Error(`No starter egg for Bloodline ${bloodlineId}`);
      const egg = createEggRecord({
        eggId: newEggId(),
        speciesId: starter.speciesId,
        hatchesIntoSpeciesId: starter.hatchesIntoSpeciesId,
        callerId: save.caller.callerId,
        nickname: null,
        incubationMinutes: minutes,
        createdAt: atMs,
      });
      io.write({
        ...save,
        savedAt: atMs,
        eggs: [...save.eggs, egg],
        hatches: [...save.hatches, createHatchState(egg)],
        queue: enqueueEggCreate(save.queue, toCreateEggRequest(egg), atMs),
      });
      return egg;
    },
    nameActiveMon: (name, atMs) => {
      const save = io.read();
      const activeMonInstanceId = pickActive(save, get().activeMonInstanceId);
      const mon = save?.mons.find((m) => m.monInstanceId === activeMonInstanceId);
      if (save === undefined || mon === undefined) throw new Error('nameActiveMon needs an active Mon');
      if (mon.nickname !== null) return mon;
      if (!isStoredMonName(name)) throw new RangeError('nameActiveMon: pass the name validateMonName returned');
      const named: MonInstance = { ...mon, nickname: name };
      io.write({
        ...save,
        savedAt: atMs,
        mons: save.mons.map((m) => (m.monInstanceId === named.monInstanceId ? named : m)),
        journal: [...appendJournalEntry(save.journal, { monInstanceId: named.monInstanceId, kind: 'named', at: atMs })],
      });
      return named;
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

/** The Caller's unhatched egg and its hatch state, from {@linkcode selectPendingEgg}. */
export interface PendingEgg {
  readonly egg: EggRecord;
  /** The stored hatch state, or a fresh `incubating` one when none is stored yet. */
  readonly hatch: HatchState;
}

const pendingBySave = new WeakMap<SaveCurrent, PendingEgg | null>();

/**
 * The Caller's unhatched egg (no Mon and no `hatched` state for it yet), or
 * `undefined`. Same order as boot (`pendingEggs` in `@acme/core/sim`):
 * earliest `incubationEndsAt`, ties by `eggId`. Stable per save, so it is
 * safe as a zustand selector.
 */
export function selectPendingEgg(state: MonStoreState): PendingEgg | undefined {
  const { save } = state;
  if (save === undefined) return undefined;
  let pending = pendingBySave.get(save);
  if (pending === undefined) {
    const egg = pendingEggs(save)[0];
    pending =
      egg === undefined
        ? null
        : { egg, hatch: save.hatches.find((h) => h.eggId === egg.eggId) ?? createHatchState(egg) };
    pendingBySave.set(save, pending);
  }
  return pending ?? undefined;
}

/**
 * Returns a selector for the active Mon's care advanced to `nowMs`, without
 * writing (M13–M16 meters, LED, mood). Feed it a minute clock. The selector
 * returns the same object until the stored care or `nowMs` changes; create
 * it once per `nowMs` (`useMemo`).
 */
export function selectCareNow(nowMs: number): (state: MonStoreState) => CareState | undefined {
  let last: { mon: MonInstance; care: CareState; result: CareState } | undefined;
  return (state) => {
    const mon = selectActiveMon(state);
    const care = selectActiveCare(state);
    if (mon === undefined || care === undefined) return undefined;
    if (last?.mon === mon && last.care === care) return last.result;
    const result = advanceCare({ mon, care }, nowMs).state.care;
    last = { mon, care, result };
    return result;
  };
}

const EMPTY_JOURNAL: readonly JournalEntry[] = [];

/**
 * Returns a selector for one Mon's journal (M18), newest first; entries at
 * the same instant keep reverse append order. Stable until the journal changes.
 */
export function selectJournal(monInstanceId: string): (state: MonStoreState) => readonly JournalEntry[] {
  let last: { journal: readonly JournalEntry[]; result: readonly JournalEntry[] } | undefined;
  return (state) => {
    const journal = state.save?.journal ?? EMPTY_JOURNAL;
    if (last?.journal === journal) return last.result;
    const indexed = journal.map((entry, index) => ({ entry, index })).filter((x) => x.entry.monInstanceId === monInstanceId);
    indexed.sort((a, b) => b.entry.at - a.entry.at || b.index - a.index);
    const result = indexed.length === 0 ? EMPTY_JOURNAL : indexed.map((x) => x.entry);
    last = { journal, result };
    return result;
  };
}

/**
 * The local calendar day of an instant as ISO `YYYY-MM-DD`, in the device's
 * time zone (M18 day boundaries). The journal and DaysCalendar key days by it.
 */
export function localDayKey(atMs: number): string {
  const d = new Date(atMs);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Returns a selector for the active Mon's "days together" (M18, D-15a): the
 * number of local days with at least one journal entry at or before
 * `nowMs`. Gaps never subtract and entries are never removed, so the count
 * only rises. `undefined` before the hatch.
 */
export function selectDaysTogether(nowMs: number): (state: MonStoreState) => number | undefined {
  return (state) => {
    const mon = selectActiveMon(state);
    if (mon === undefined) return undefined;
    return countDaysTogether(state.save?.journal ?? EMPTY_JOURNAL, mon.monInstanceId, nowMs, localDayKey);
  };
}

/**
 * Returns a selector for whether the Caller must be treated as under 13 at
 * `nowMs`, for `deriveFirstLook` (D-15g). The age band lives on the save's
 * `CallerProfile` (`birthYear`, `consentStatus`); the raw M04 answer is
 * MMKV `age-answer` (`readAgeAnswer` in `onboarding/onboarding.store.ts`).
 * `undefined` when there is no Caller.
 */
export function selectCallerIsUnder13(nowMs: number): (state: MonStoreState) => boolean | undefined {
  return (state) => {
    const caller = state.save?.caller;
    return caller == null ? undefined : isCallerUnder13(caller, nowMs);
  };
}
