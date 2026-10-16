// The default six-button map until a gameplay spec exists (Master Directive
// v2 §2B: bindings come from gameplay specifications, never invented here).
// The caps drive the Caller, the player's character, not the camera. The
// canon (GAMEPLAY_BIBLE_V12, DECISIONS) defines no Caller verbs yet, so every
// action here is plain movement or camera handling with no rule attached: no
// cooldown, no stamina, no damage. Each is a Decision for Mike to confirm in
// docs/implementation/caller-proxy.md. The gameplay screen replaces this map
// as data; nothing here is canon.
import type { ControllerBindings } from './contract.ts';

/** The Caller actions the default map names. The app's `CallerAction` in game-input-bindings.ts is the same union. */
export type DefaultCallerAction = 'jump' | 'run' | 'interact' | 'recentre' | 'zoomCycle' | 'look';

/**
 * Bottom row A B C, nearest the thumb: jump, run (hold), interact. Top row
 * X Y Z: recentre the camera behind the Caller, step the chase zoom, look
 * around (hold, then steer the view with the stick). Labels are the letters;
 * the spoken names are below.
 *
 * @see {@linkcode DEFAULT_CALLER_SPOKEN_LABELS}
 */
export const DEFAULT_CALLER_BINDINGS: ControllerBindings<DefaultCallerAction> = {
  x: { action: 'recentre', label: 'X' },
  y: { action: 'zoomCycle', label: 'Y' },
  z: { action: 'look', label: 'Z' },
  a: { action: 'jump', label: 'A' },
  b: { action: 'run', label: 'B' },
  c: { action: 'interact', label: 'C' },
};

/** Spoken names for {@linkcode DEFAULT_CALLER_BINDINGS}. Proposed copy rows `g01.btn.<id>.label`, 14 characters max. */
export const DEFAULT_CALLER_SPOKEN_LABELS = {
  x: 'Recentre view',
  y: 'Change zoom',
  z: 'Look around',
  a: 'Jump',
  b: 'Hold to run',
  c: 'Interact',
} as const;

/**
 * @deprecated The caps no longer drive the camera. Kept so `parts.ts`, the
 * settings screen and the stories pick up the Caller map without an edit;
 * import {@linkcode DEFAULT_CALLER_BINDINGS} once `parts.ts` re-exports it.
 */
export const DEFAULT_CAMERA_BINDINGS = DEFAULT_CALLER_BINDINGS;
/** @deprecated Use {@linkcode DEFAULT_CALLER_SPOKEN_LABELS}. */
export const DEFAULT_CAMERA_SPOKEN_LABELS = DEFAULT_CALLER_SPOKEN_LABELS;
/** @deprecated Use {@linkcode DefaultCallerAction}. */
export type DefaultCameraAction = DefaultCallerAction;
