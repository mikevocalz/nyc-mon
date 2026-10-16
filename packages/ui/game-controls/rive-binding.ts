// Pushes controller state into the Rive View Model paths of Master Directive
// v2 §8, with no React render per update. Pure: the binding talks to a
// structural `ArcadeViewModelInstance`, which @rive-app/react-native 0.5.2's
// `ViewModelInstance` satisfies (lib/typescript/src/specs/ViewModel.nitro.d.ts:
// numberProperty/booleanProperty/enumProperty/stringProperty each return a
// handle with `set(value)`), so `node --test` drives it with a fake.
//
// The web runtime (@rive-app/react-webgl2 4.36.0) exposes the same property
// setters under hooks; the ArcadeRiveSurface web fork is DEFERRED to lane B's
// asset decision, so no web type is referenced here.
import { BUTTON_IDS, type ButtonId, type ButtonVisualState, type PillState, type StickMode, type StickReading } from './contract.ts';

/** The one setter the binding needs from a Rive property handle. */
export interface RivePropertySetter<T> {
  set(value: T): void;
}

/**
 * The slice of a Rive view model instance the controller writes. Every
 * accessor returns `undefined` for a path the artboard does not define; the
 * binding records those in {@linkcode ArcadeRiveBinding.missingPaths} and
 * keeps going, so an older `.riv` degrades instead of crashing the input path.
 */
export interface ArcadeViewModelInstance {
  numberProperty(path: string): RivePropertySetter<number> | undefined;
  booleanProperty(path: string): RivePropertySetter<boolean> | undefined;
  enumProperty(path: string): RivePropertySetter<string> | undefined;
  stringProperty(path: string): RivePropertySetter<string> | undefined;
}

/** The §8 View Model paths, spelled once. */
export const ARCADE_VM_PATHS = {
  stickX: 'stick/x',
  stickY: 'stick/y',
  stickEngaged: 'stick/engaged',
  stickMode: 'stick/mode',
  pillState: 'pill/state',
  /**
   * 0…1 fill of the hold-to-stop ring (added to the §8 table 2026-10-15,
   * finding C2). The `start-stop` artboard authors it on the Pill view model
   * and keys the ring's trim from it; under `a11y/reducedMotion` an authored
   * sibling ring shows it in quarter steps. The artboard has no ring clock.
   */
  pillHoldProgress: 'pill/holdProgress',
  reducedMotion: 'a11y/reducedMotion',
  buttonState: (id: ButtonId) => `buttons/${id}/state`,
  buttonLabel: (id: ButtonId) => `buttons/${id}/label`,
  buttonIcon: (id: ButtonId) => `buttons/${id}/icon`,
} as const;

/**
 * What {@linkcode createArcadeRiveBinding} returns. Every setter is cheap,
 * synchronous and skips a write when the value did not change, so adapters
 * can call them on every accepted input event.
 */
export interface ArcadeRiveBinding {
  setStick(reading: StickReading): void;
  setStickMode(mode: StickMode): void;
  setButtonState(button: ButtonId, state: ButtonVisualState): void;
  /** Label and optional icon name for the cap; an absent icon writes an empty string so a stale glyph clears. */
  setButtonLabel(button: ButtonId, label: string, icon?: string): void;
  setPillState(state: PillState): void;
  /** Hold-to-stop ring fill, clamped to 0…1. Writes {@linkcode ARCADE_VM_PATHS.pillHoldProgress}. */
  setPillHoldProgress(progress: number): void;
  setReducedMotion(reduced: boolean): void;
  /** Paths the instance returned no handle for, in first-seen order. Empty means the artboard matches §8. */
  readonly missingPaths: readonly string[];
  /** Forgets the cached handles. Call when the view model instance goes away. */
  dispose(): void;
}

/** Options for {@linkcode createArcadeRiveBinding}. */
export interface ArcadeRiveBindingOptions {
  /**
   * Called once per path the instance has no handle for, the first time a
   * setter asks for it (finding M16: the surfaces route this to
   * `riveDiagnosticsStore`, so a path typo or a stale `.riv` is visible).
   */
  readonly onMissingPath?: (path: string) => void;
  /**
   * Called once after any setter call that changed at least one value. A
   * host passes its `RiveView`'s `playIfNeeded()` here: on the Android
   * runtime of @rive-app/react-native 0.5.2 a settled state machine stops
   * advancing (android/src/new/java/com/rive/RiveReactNativeView.kt: the
   * render loop advances only while `!settled`), and a view model write does
   * not clear that flag (`HybridViewModelNumberProperty.set` only calls
   * `ViewModelInstance.setNumber`). Without the wake a write lands in the
   * instance and the artboard never shows it.
   */
  readonly onDidWrite?: () => void;
}

/**
 * Binds a view model instance to the controller contract. Handles are looked
 * up lazily and cached; values are cached too, so a stick that rests at
 * (0, 0) between frames costs nothing.
 *
 * The instance is not validated up front: @rive-app/react-native resolves
 * property paths on its async runtime, so a typo surfaces as a missing path
 * here rather than as a throw.
 *
 * @see {@linkcode ARCADE_VM_PATHS}
 */
export function createArcadeRiveBinding(instance: ArcadeViewModelInstance, options: ArcadeRiveBindingOptions = {}): ArcadeRiveBinding {
  type Kind = keyof ArcadeViewModelInstance;
  const handles = new Map<string, RivePropertySetter<never> | null>();
  const values = new Map<string, number | boolean | string>();
  const missing: string[] = [];
  let disposed = false;

  function handle<T>(kind: Kind, path: string): RivePropertySetter<T> | null {
    if (disposed) return null;
    const cached = handles.get(path);
    if (cached !== undefined) return cached as RivePropertySetter<T> | null;
    const found = (instance[kind](path) as RivePropertySetter<T> | undefined) ?? null;
    handles.set(path, found);
    if (found === null) {
      missing.push(path);
      options.onMissingPath?.(path);
    }
    return found;
  }

  /** Writes one path; true when a handle received a new value. */
  function write<T extends number | boolean | string>(kind: Kind, path: string, value: T): boolean {
    if (values.get(path) === value) return false;
    const setter = handle<T>(kind, path);
    if (!setter) return false;
    // The native instance can close under a live binding (remount, fold, a
    // hot reload): rive-android then throws RiveResourceClosedException. That
    // binding is finished; stop writing instead of throwing through React.
    try {
      setter.set(value);
    } catch {
      disposed = true;
      return false;
    }
    values.set(path, value);
    return true;
  }

  /** Ends one setter call: wakes the host once if anything changed. */
  function done(changed: boolean): void {
    if (changed && !disposed) options.onDidWrite?.();
  }

  return {
    setStick(reading) {
      const x = write('numberProperty', ARCADE_VM_PATHS.stickX, reading.x);
      const y = write('numberProperty', ARCADE_VM_PATHS.stickY, reading.y);
      const engaged = write('booleanProperty', ARCADE_VM_PATHS.stickEngaged, reading.engaged);
      done(x || y || engaged);
    },
    setStickMode(mode) {
      done(write('enumProperty', ARCADE_VM_PATHS.stickMode, mode));
    },
    setButtonState(button, state) {
      if (!BUTTON_IDS.includes(button)) return;
      done(write('enumProperty', ARCADE_VM_PATHS.buttonState(button), state));
    },
    setButtonLabel(button, label, icon) {
      if (!BUTTON_IDS.includes(button)) return;
      const l = write('stringProperty', ARCADE_VM_PATHS.buttonLabel(button), label);
      const i = write('stringProperty', ARCADE_VM_PATHS.buttonIcon(button), icon ?? '');
      done(l || i);
    },
    setPillState(state) {
      done(write('enumProperty', ARCADE_VM_PATHS.pillState, state));
    },
    setPillHoldProgress(progress) {
      if (!Number.isFinite(progress)) return;
      done(write('numberProperty', ARCADE_VM_PATHS.pillHoldProgress, Math.min(1, Math.max(0, progress))));
    },
    setReducedMotion(reduced) {
      done(write('booleanProperty', ARCADE_VM_PATHS.reducedMotion, reduced));
    },
    get missingPaths() {
      return missing;
    },
    dispose() {
      disposed = true;
      handles.clear();
      values.clear();
    },
  };
}
