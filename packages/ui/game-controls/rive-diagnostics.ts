// Where Rive failures go instead of nowhere (finding M16). A process-wide
// vanilla Zustand store the debug overlay and tests read: every View Model
// path an artboard did not define (from the binding's `onMissingPath`) and
// every `RiveView` error. In development each new entry is also a
// console warning, so a path typo or a stale `.riv` shows up the first time
// it happens. Pure: no react-native import.
import { createStore } from 'zustand/vanilla';

/** One `RiveView` error, as @rive-app/react-native reports it (`RiveError`: message and numeric type). */
export interface RiveErrorRecord {
  /** Which surface reported it, e.g. `arcade:start-stop`. */
  readonly surface: string;
  readonly message: string;
  readonly type: number;
}

export interface RiveDiagnosticsState {
  /** `<surface> <path>` for every path an artboard did not define, first-seen order, no duplicates. */
  readonly missingPaths: readonly string[];
  /** The most recent errors, newest last, at most {@linkcode RIVE_ERROR_LIMIT}. */
  readonly errors: readonly RiveErrorRecord[];
  reportMissingPath(surface: string, path: string): void;
  reportError(error: RiveErrorRecord): void;
  /** Tests only. */
  reset(): void;
}

/** How many errors the store keeps. */
export const RIVE_ERROR_LIMIT = 20;

/** Set false in tests to silence the development warnings. */
export const riveDiagnosticsConfig = { warn: true };

function isDev(): boolean {
  const flag = (globalThis as { __DEV__?: boolean }).__DEV__;
  return flag === true;
}

function warn(message: string): void {
  if (riveDiagnosticsConfig.warn && isDev()) console.warn(message);
}

/** The one store. Read with `useStore(riveDiagnosticsStore, selector)` or `getState()`. */
export const riveDiagnosticsStore = createStore<RiveDiagnosticsState>((set, get) => ({
  missingPaths: [],
  errors: [],
  reportMissingPath(surface, path) {
    const key = `${surface} ${path}`;
    if (get().missingPaths.includes(key)) return;
    set({ missingPaths: [...get().missingPaths, key] });
    warn(`[rive] ${surface}: the artboard has no View Model path "${path}"`);
  },
  reportError(error) {
    const errors = [...get().errors, error];
    set({ errors: errors.length > RIVE_ERROR_LIMIT ? errors.slice(errors.length - RIVE_ERROR_LIMIT) : errors });
    warn(`[rive] ${error.surface}: ${error.message} (type ${error.type})`);
  },
  reset() {
    set({ missingPaths: [], errors: [] });
  },
}));
