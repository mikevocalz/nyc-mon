// Pushes lobby state into lane B's View Model paths (Master Directive v2 §8;
// docs/evidence/rive/game-lobby/data-contract.data.json lists every path with
// its type) with no React render per update. Same shape as
// ../game-controls/rive-binding.ts: the binding talks to a structural
// `ArcadeViewModelInstance` (@rive-app/react-native 0.5.2
// lib/typescript/src/specs/ViewModel.nitro.d.ts: numberProperty /
// booleanProperty / enumProperty / stringProperty each return a handle with
// `set(value)`), so `node --test` drives it with a fake.
//
// The paths are identical in the assembled `game-lobby` scene and in each
// standalone artboard (`start-angled`, `leaderboard`, `game-transition`),
// because each standalone root points at the same nested view models
// (scene.rml headers), so one binding serves whichever artboard a component
// hosts; a path the artboard does not define lands in `missingPaths`.
//
// Rows (review finding H9). The `leaderboard` artboard authors a list
// property `leaderboard/rows` holding four `Row` instances (Row 1, Row 2,
// Row 3, Row Self); `rive --data-dump` on packages/ui/rive/lobby/leaderboard
// lists them as `type: "list", size: 4` with `rank`/`name`/`score`/`isSelf`
// on each item. The runtime documents no bracket indexing inside a scalar
// path, so rows go through its list API (ViewModel.nitro.d.ts:
// `listProperty(path)` → `ViewModelListProperty.getInstanceAtAsync(index)`,
// then the item's relative `rank`, `name`, `score`, `isSelf`). The items
// resolve asynchronously once; rows written before that are held and flushed
// when the items arrive. A missing list or item lands in `missingPaths`,
// never a crash. `leaderboard/rows[n]/…` stays as the diagnostic name of
// each slot. Seam for a page longer than LOBBY_ROWS_AUTHORED: grow the list
// through `ViewModelListProperty.addInstanceAsync`, or keep the overflow in a
// native `VirtualList` beside the artboard (08-handoff.md "Panel rows
// (overflow)"); neither is needed at today's page size.
import type { ArcadeViewModelInstance, RivePropertySetter } from '../game-controls/rive-binding.ts';
import type { LayoutProfile, LeaderboardStatus } from '../game-controls/contract.ts';
import type { AngledStartState, LeaderboardRow, ThemeVariant, TransitionPhase } from './lobby-contract.ts';

/** How many `Row` instances lane B's `leaderboard` artboard authors in its list. */
export const LOBBY_ROWS_AUTHORED = 4;

/**
 * The list slice of a Rive view model instance (@rive-app/react-native
 * 0.5.2 `ViewModelListProperty`): items resolve asynchronously by index.
 */
export interface LobbyViewModelList {
  getInstanceAtAsync(index: number): Promise<ArcadeViewModelInstance | undefined>;
}

/**
 * What the lobby binding writes to: the controller's scalar accessors plus
 * the runtime's `listProperty`. Optional so an instance without lists (an
 * older artboard, a test fake) still binds its scalar paths.
 */
export interface LobbyViewModelInstance extends ArcadeViewModelInstance {
  listProperty?(path: string): LobbyViewModelList | undefined;
}

/** The fields each `Row` item carries, relative to the item. */
export const LOBBY_ROW_FIELDS = { rank: 'rank', name: 'name', score: 'score', isSelf: 'isSelf' } as const;

/** The §8 lobby View Model paths, spelled once. */
export const LOBBY_VM_PATHS = {
  resumeEligible: 'lobby/resume/eligible',
  resumeDistrict: 'lobby/resume/district',
  startState: 'lobby/start/state',
  startPressed: 'lobby/start/pressed',
  startFocused: 'lobby/start/focused',
  leaderboardStatus: 'leaderboard/status',
  /** The list property the rows live in. */
  leaderboardRows: 'leaderboard/rows',
  /** Diagnostic name of one list item (not a runtime path). */
  row: (index: number) => `leaderboard/rows[${index}]`,
  transitionPhase: 'transition/phase',
  themeVariant: 'theme/variant',
  layoutProfile: 'layout/profile',
  reducedMotion: 'a11y/reducedMotion',
} as const;

/**
 * What {@linkcode createLobbyRiveBinding} returns. Every setter is cheap,
 * synchronous and skips a write when the value did not change.
 */
export interface LobbyRiveBinding {
  /** `lobby/resume/eligible` and `lobby/resume/district` (the display name, or "" when unknown). */
  setResume(eligible: boolean, districtName: string): void;
  setStartState(state: AngledStartState): void;
  setStartPressed(pressed: boolean): void;
  setStartFocused(focused: boolean): void;
  setLeaderboardStatus(status: LeaderboardStatus): void;
  /**
   * Writes rows 0..n-1 and clears the authored slots above n (rank 0, name
   * "", not self) so a shorter page never leaves a stale row lit. `score`
   * is bound as 0 while absent (08-handoff.md "Rive View Model bindings").
   * Rows set before the list items have resolved are written when they do.
   */
  setLeaderboardRows(rows: readonly LeaderboardRow[]): void;
  setTransitionPhase(phase: TransitionPhase): void;
  setTheme(variant: ThemeVariant): void;
  setLayoutProfile(profile: LayoutProfile): void;
  setReducedMotion(reduced: boolean): void;
  /** Paths the instance returned no handle for, in first-seen order. Empty means the artboard matches §8. */
  readonly missingPaths: readonly string[];
  /** Resolves once the row items have been looked up (found or missing). Tests and diagnostics await it. */
  readonly rowsReady: Promise<void>;
  /** Forgets the cached handles. Call when the view model instance goes away. */
  dispose(): void;
}

/**
 * Binds a view model instance to the lobby contract. Handles are looked up
 * lazily and cached; values are cached too, so re-syncing unchanged state
 * costs nothing. Not validated up front: @rive-app/react-native resolves
 * property paths on its async runtime, so a typo surfaces as a missing path
 * here rather than as a throw.
 *
 * @see {@linkcode LOBBY_VM_PATHS}
 */
export function createLobbyRiveBinding(instance: LobbyViewModelInstance): LobbyRiveBinding {
  type Kind = keyof ArcadeViewModelInstance;
  const handles = new Map<string, RivePropertySetter<never> | null>();
  const values = new Map<string, number | boolean | string>();
  const missing: string[] = [];
  let disposed = false;
  /** `null` until the list items resolve; then one slot per authored row (an item or `undefined` when missing). */
  let items: readonly (ArcadeViewModelInstance | undefined)[] | null = null;
  let pendingRows: readonly LeaderboardRow[] | null = null;
  let rowsReady: Promise<void> | null = null;

  function handleOn<T>(target: ArcadeViewModelInstance, kind: Kind, key: string, lookup: string): RivePropertySetter<T> | null {
    if (disposed) return null;
    const cached = handles.get(key);
    if (cached !== undefined) return cached as RivePropertySetter<T> | null;
    const found = (target[kind](lookup) as RivePropertySetter<T> | undefined) ?? null;
    handles.set(key, found);
    if (found === null) missing.push(key);
    return found;
  }

  function writeOn<T extends number | boolean | string>(target: ArcadeViewModelInstance, kind: Kind, key: string, lookup: string, value: T): void {
    if (disposed || values.get(key) === value) return;
    const setter = handleOn<T>(target, kind, key, lookup);
    if (!setter) return;
    setter.set(value);
    values.set(key, value);
  }

  function write<T extends number | boolean | string>(kind: Kind, path: string, value: T): void {
    writeOn(instance, kind, path, path, value);
  }

  function writeRows(rows: readonly LeaderboardRow[], resolved: readonly (ArcadeViewModelInstance | undefined)[]): void {
    const count = Math.min(rows.length, LOBBY_ROWS_AUTHORED);
    for (let index = 0; index < LOBBY_ROWS_AUTHORED; index++) {
      const item = resolved[index];
      if (item === undefined) continue;
      const row = index < count ? rows[index] : undefined;
      const slot = LOBBY_VM_PATHS.row(index);
      writeOn(item, 'numberProperty', `${slot}/${LOBBY_ROW_FIELDS.rank}`, LOBBY_ROW_FIELDS.rank, row ? row.rank : 0);
      writeOn(item, 'stringProperty', `${slot}/${LOBBY_ROW_FIELDS.name}`, LOBBY_ROW_FIELDS.name, row ? row.name : '');
      writeOn(item, 'numberProperty', `${slot}/${LOBBY_ROW_FIELDS.score}`, LOBBY_ROW_FIELDS.score, row?.score ?? 0);
      writeOn(item, 'booleanProperty', `${slot}/${LOBBY_ROW_FIELDS.isSelf}`, LOBBY_ROW_FIELDS.isSelf, row ? row.isSelf : false);
    }
  }

  async function resolveItems(): Promise<void> {
    const list = instance.listProperty?.(LOBBY_VM_PATHS.leaderboardRows);
    if (list === undefined) {
      missing.push(LOBBY_VM_PATHS.leaderboardRows);
      items = [];
      return;
    }
    const found = await Promise.all(
      Array.from({ length: LOBBY_ROWS_AUTHORED }, (_, index) => list.getInstanceAtAsync(index).catch(() => undefined)),
    );
    if (disposed) return;
    found.forEach((item, index) => {
      if (item === undefined) missing.push(LOBBY_VM_PATHS.row(index));
    });
    items = found;
    if (pendingRows !== null) {
      const rows = pendingRows;
      pendingRows = null;
      writeRows(rows, found);
    }
  }

  function ensureRowsReady(): Promise<void> {
    if (rowsReady === null) rowsReady = resolveItems();
    return rowsReady;
  }

  return {
    setResume(eligible, districtName) {
      write('booleanProperty', LOBBY_VM_PATHS.resumeEligible, eligible);
      write('stringProperty', LOBBY_VM_PATHS.resumeDistrict, districtName);
    },
    setStartState(state) {
      write('enumProperty', LOBBY_VM_PATHS.startState, state);
    },
    setStartPressed(pressed) {
      write('booleanProperty', LOBBY_VM_PATHS.startPressed, pressed);
    },
    setStartFocused(focused) {
      write('booleanProperty', LOBBY_VM_PATHS.startFocused, focused);
    },
    setLeaderboardStatus(status) {
      write('enumProperty', LOBBY_VM_PATHS.leaderboardStatus, status);
    },
    setLeaderboardRows(rows) {
      if (disposed) return;
      if (items !== null) {
        writeRows(rows, items);
        return;
      }
      pendingRows = rows;
      void ensureRowsReady();
    },
    setTransitionPhase(phase) {
      write('enumProperty', LOBBY_VM_PATHS.transitionPhase, phase);
    },
    setTheme(variant) {
      write('enumProperty', LOBBY_VM_PATHS.themeVariant, variant);
    },
    setLayoutProfile(profile) {
      write('enumProperty', LOBBY_VM_PATHS.layoutProfile, profile);
    },
    setReducedMotion(reduced) {
      write('booleanProperty', LOBBY_VM_PATHS.reducedMotion, reduced);
    },
    get missingPaths() {
      return missing;
    },
    get rowsReady() {
      return ensureRowsReady();
    },
    dispose() {
      disposed = true;
      pendingRows = null;
      handles.clear();
      values.clear();
    },
  };
}
