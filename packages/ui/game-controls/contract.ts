// The one input contract every arcade-control lane builds against
// (Master Directive v2 §9, §13). Types only: no React, no Rive, no renderer.
// Every lane imports from here; nobody redefines these names.
//
// Authority order: the game session owns state; the router validates and
// orders input; Rive reflects. Nothing in this file is a per-frame transport.

/** The six right-cluster buttons. Top row X Y Z, bottom row A B C (§2B). */
export type ButtonId = 'x' | 'y' | 'z' | 'a' | 'b' | 'c';
export const BUTTON_IDS: readonly ButtonId[] = ['x', 'y', 'z', 'a', 'b', 'c'];

/** Where an input came from. Every event carries one so diagnostics and conflicts can name it. */
export type InputSource = 'touch' | 'keyboard' | 'gamepad' | 'accessibility';

/** Phase of a continuous input (the stick). Buttons use down/up only. */
export type Phase = 'begin' | 'update' | 'end' | 'cancel';

/** Why every active input was dropped at once (§9 "safe cleanup"). */
export type CancelReason =
  | 'background'
  | 'focus-loss'
  | 'layout-change'
  | 'gesture-cancel'
  | 'screen-transition'
  | 'fold-change'
  | 'source-disconnected';

/** Visual state the Rive `buttons/<id>/state` property takes (§8). */
export type ButtonVisualState = 'idle' | 'pressed' | 'held' | 'released' | 'disabled' | 'cooldown';

/**
 * Visual state the Rive `pill/state` property takes (§8).
 * Decision (2026-10-15): DEFER adding `disabled` here. StartStopPill carries
 * it locally; the session machine and the save cadence switch exhaustively on
 * this union, so it grows only with a gameplay reason.
 */
export type PillState = 'start' | 'playing' | 'paused' | 'stopConfirm';

/**
 * How long a stop hold lasts, in ms: the touch pill, the gamepad Start
 * button, the keyboard Escape key and the session's ring timer all read this
 * one number, and the spoken hint is derived from it. The `start-stop`
 * artboard has no clock of its own; its ring follows `pill/holdProgress`.
 * Decision (2026-10-15): BUILD 1000 ms, the length the copy deck already
 * speaks ("Hold for one second to stop") and the hardware path already used.
 */
export const STOP_HOLD_MS = 1000;

export type StickMode = 'analog' | 'dpad';
export type StickPlacement = 'fixed' | 'floating';
export type Handedness = 'left' | 'right';
export type HapticStrength = 'off' | 'light' | 'medium' | 'strong';

/** Eight-way digital reading of the stick, or `none` inside the dead zone. */
export type Direction8 = 'none' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

/** The stick as the native adapter publishes it: normalized −1…1 on both axes, +y is up. */
export interface StickReading {
  readonly x: number;
  readonly y: number;
  readonly engaged: boolean;
  readonly direction: Direction8;
}

/**
 * Tuning the stick math reads. Persisted through {@linkcode ControllerProfile};
 * the adapter never reads settings storage itself.
 */
export interface StickTuning {
  /** Radial dead zone as a fraction of {@linkcode StickTuning.clampRadiusDp}. 0…0.5. */
  readonly deadZone: number;
  /** Multiplier applied after the dead zone, before the clamp. 0.5…2. */
  readonly sensitivity: number;
  /** Finger travel that reads as full deflection, in dp. */
  readonly clampRadiusDp: number;
}

/**
 * Everything the game-control settings screen edits (§13). One profile, one
 * store; the layout resolver and the input adapters read it, nobody else
 * duplicates it.
 */
export interface ControllerProfile {
  readonly stickMode: StickMode;
  readonly stickPlacement: StickPlacement;
  readonly stick: StickTuning;
  readonly handedness: Handedness;
  /** Overall control scale. 0.8…1.4. */
  readonly scale: number;
  /** Overlay opacity. 0.3…1. */
  readonly opacity: number;
  readonly haptics: HapticStrength;
  /** Show the bound icon instead of the letter on each button when the binding has one. */
  readonly showIcons: boolean;
}

export const DEFAULT_CONTROLLER_PROFILE: ControllerProfile = {
  stickMode: 'analog',
  stickPlacement: 'fixed',
  stick: { deadZone: 0.15, sensitivity: 1, clampRadiusDp: 56 },
  handedness: 'right',
  scale: 1,
  opacity: 0.9,
  haptics: 'medium',
  showIcons: false,
};

/**
 * What a button means to the current gameplay screen. `Action` is the
 * screen's own union; the kit never names a game action (§2B: bindings come
 * from gameplay specifications, never invented here).
 */
export interface ActionBinding<Action extends string = string> {
  readonly action: Action;
  /** Label painted on the cap. One or two characters, or a short word. */
  readonly label: string;
  /** Optional kit icon name; shown when {@linkcode ControllerProfile.showIcons} is on. */
  readonly icon?: string;
  /** `false` renders the button disabled and the router drops its presses. Default true. */
  readonly enabled?: boolean;
  /** Screen-reader name when the painted label is a bare letter (copy deck g01.btn.*). Defaults to `label`. */
  readonly spokenLabel?: string;
}

export type ControllerBindings<Action extends string = string> = Readonly<Record<ButtonId, ActionBinding<Action>>>;

/**
 * Visual state the Rive `leaderboard/status` property takes (§8 plus
 * `unavailable`, added 2026-10-15: no server ranking authority exists yet, and
 * the lobby must say so rather than show an empty list or a generic error).
 * The core {@linkcode LeaderboardSource} reports `error` with reason
 * `no-ranking-authority`; the lobby maps that case to `unavailable`.
 */
export type LeaderboardStatus = 'loading' | 'ready' | 'empty' | 'stale' | 'error' | 'unavailable';

/** A single validated input event after the router accepted it. */
export type InputEvent =
  | { readonly kind: 'move'; readonly reading: StickReading; readonly phase: Phase; readonly source: InputSource; readonly timestampMs: number }
  | { readonly kind: 'button-down'; readonly button: ButtonId; readonly source: InputSource; readonly timestampMs: number }
  | { readonly kind: 'button-up'; readonly button: ButtonId; readonly source: InputSource; readonly timestampMs: number }
  | { readonly kind: 'pause-request'; readonly source: InputSource; readonly timestampMs: number }
  | { readonly kind: 'resume-request'; readonly source: InputSource; readonly timestampMs: number }
  | { readonly kind: 'stop-request'; readonly source: InputSource; readonly timestampMs: number }
  | { readonly kind: 'cancel-all'; readonly reason: CancelReason; readonly timestampMs: number };

export interface ListenerSubscription {
  /** Idempotent. */
  remove(): void;
}

/**
 * Renderer-independent input router (§9). Touch, keyboard, gamepad and
 * accessibility adapters all call these; the gameplay screen subscribes.
 * Every call is validated (finite numbers, known ids, strict down/up pairing)
 * and ordered by arrival; a rejected call is dropped and counted, never thrown,
 * because adapters run on hot paths.
 */
export interface GameInputRouter {
  move(x: number, y: number, phase: Phase, source: InputSource, timestampMs: number): void;
  buttonDown(button: ButtonId, source: InputSource, timestampMs: number): void;
  buttonUp(button: ButtonId, source: InputSource, timestampMs: number): void;
  pauseRequest(source: InputSource): void;
  resumeRequest(source: InputSource): void;
  stopRequest(source: InputSource): void;
  cancelAll(reason: CancelReason): void;
  /** Buttons currently down, by id. Read for rendering; never mutated by callers. */
  readonly heldButtons: ReadonlySet<ButtonId>;
  readonly stick: StickReading;
  addListener(listener: (event: InputEvent) => void): ListenerSubscription;
}

/** Counters the diagnostics overlay and tests read (§13 `ControllerDiagnostics`). */
export interface InputDiagnostics {
  readonly accepted: number;
  readonly rejected: number;
  /** Last rejection reason, for the debug overlay. */
  readonly lastRejection: string | null;
  readonly activeSources: ReadonlySet<InputSource>;
}

/** Window-independent layout profile the resolver picks (§10). */
export type LayoutProfile =
  | 'phone-portrait'
  | 'phone-landscape'
  | 'fold-outer'
  | 'fold-book'
  | 'fold-tabletop'
  | 'tablet'
  | 'web';
