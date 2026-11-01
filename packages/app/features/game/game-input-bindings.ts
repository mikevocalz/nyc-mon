// The pure half of the gameplay input wiring (Master Directive v2 §9 input
// architecture, §2C pill contract): cap → the bound `CallerAction` (or a
// `CameraCommand` for a custom camera map), stick reading → camera pan for
// that legacy map, held-cap repeat timing, router request → session
// event. No react-native import, so `node --test` covers every branch; the
// hook in use-game-input.ts owns the subscriptions and the timers.
//
// Ordering (Muratori): input is validated by the router, mapped here, then
// applied to the simulation (the camera store, the session store). Nothing
// here holds state, so a dropped event can never leave a stuck mapping.
import type { SessionEvent, SessionState } from '@acme/core';
import type { ButtonId, ControllerBindings, InputEvent, StickReading } from '@acme/ui/game-controls/parts';
import { panToAction, type CameraCommand } from './camera-input.ts';
import type { CityCameraAction } from './city-camera.ts';
import type { CityCamera } from './city-scene.ts';

/**
 * Finger travel the stick stands in for at full deflection, in dp per second.
 * A full push pans the world as fast as a steady 320 dp/s drag would, so the
 * stick and the drag share one speed feel through `panToAction`.
 */
export const STICK_PAN_DP_PER_SECOND = 320;

/** Largest frame step the stick integrates; a stalled frame never teleports the camera. */
export const STICK_MAX_FRAME_SECONDS = 0.1;

/** A held cap fires again this long after its first press, then every {@linkcode BUTTON_REPEAT_MS}. */
export const BUTTON_REPEAT_DELAY_MS = 300;
/** Repeat interval while a cap stays down. 120 ms is eight steps a second, bounded by the router's up. */
export const BUTTON_REPEAT_MS = 120;

const CAMERA_COMMANDS: readonly CameraCommand[] = [
  'zoomIn', 'zoomOut', 'rotateLeft', 'rotateRight', 'moveForward', 'moveBack', 'moveLeft', 'moveRight', 'reset',
];

/** True when a binding's action is one of the existing camera commands (§2B: the only bindings allowed today). */
export function isCameraCommand(action: string): action is CameraCommand {
  return (CAMERA_COMMANDS as readonly string[]).includes(action);
}

/**
 * The camera command a cap is bound to, or `null` when the binding names
 * something the camera does not know (a future gameplay spec) or is disabled.
 */
export function buttonToCommand(button: ButtonId, bindings: ControllerBindings): CameraCommand | null {
  const binding = bindings[button];
  if (binding.enabled === false) return null;
  return isCameraCommand(binding.action) ? binding.action : null;
}

/**
 * What a cap does to the Caller (default-bindings.ts `DefaultCallerAction`).
 * None of these is canon: the bible and DECISIONS define no Caller verbs, so
 * each is movement or camera handling with no rule attached, recorded as a
 * Decision in docs/implementation/caller-proxy.md.
 */
export type CallerAction = 'jump' | 'run' | 'interact' | 'recentre' | 'zoomCycle' | 'look';

const CALLER_ACTIONS: readonly CallerAction[] = ['jump', 'run', 'interact', 'recentre', 'zoomCycle', 'look'];

export function isCallerAction(action: string): action is CallerAction {
  return (CALLER_ACTIONS as readonly string[]).includes(action);
}

/** The Caller action a cap is bound to, or `null` when it is disabled or names something else. */
export function buttonToCallerAction(button: ButtonId, bindings: ControllerBindings): CallerAction | null {
  const binding = bindings[button];
  if (binding.enabled === false) return null;
  return isCallerAction(binding.action) ? binding.action : null;
}

/** Hold actions last from button-down to button-up; the rest fire once on the press and never repeat. */
export function isHoldAction(action: CallerAction): action is 'run' | 'look' {
  return action === 'run' || action === 'look';
}

/** Commands that make sense to repeat while held. `reset` is one step by nature. */
export function isRepeatable(command: CameraCommand): boolean {
  return command !== 'reset';
}

/**
 * When the n-th repeat of a held cap is due, in the clock of `downAtMs`.
 * Repeat 1 lands after {@linkcode BUTTON_REPEAT_DELAY_MS}; each later one
 * {@linkcode BUTTON_REPEAT_MS} after the previous.
 */
export function nextRepeatAtMs(downAtMs: number, repeatsFired: number): number {
  return downAtMs + BUTTON_REPEAT_DELAY_MS + repeatsFired * BUTTON_REPEAT_MS;
}

/**
 * One frame of stick travel as a camera pan. The reading is a velocity: +x
 * pans the camera right, +y (up on the stick) pans it forward, scaled by
 * {@linkcode STICK_PAN_DP_PER_SECOND} and the frame's `deltaSeconds`, then
 * through {@linkcode panToAction}, which scales dp to metres by the camera
 * distance and the viewport. `panToAction` moves the world with a finger
 * (drag right pans the camera left), so the x travel is negated here to make
 * the stick move the camera, not the world. A disengaged reading or a
 * non-positive viewport pans nothing.
 */
export function stickToPanAction(
  reading: StickReading,
  camera: CityCamera,
  viewportHeightDp: number,
  deltaSeconds: number,
): CityCameraAction | null {
  if (!reading.engaged || viewportHeightDp <= 0) return null;
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return null;
  const dt = Math.min(deltaSeconds, STICK_MAX_FRAME_SECONDS);
  const travel = STICK_PAN_DP_PER_SECOND * dt;
  return panToAction(-reading.x * travel, reading.y * travel, camera, viewportHeightDp);
}

/** The three router requests the session answers. */
export type SessionRequestKind = Extract<InputEvent['kind'], 'pause-request' | 'resume-request' | 'stop-request'>;

/**
 * The session events a router request means in the current session state.
 * The session machine (`transitionSession` in @acme/core) ignores events its
 * state does not accept, so this only decides which events to send:
 *
 * - `pause-request` while playing and `resume-request` while paused are one
 *   `pillPress`; any other pairing sends nothing (a double tap or a stale
 *   hardware edge never flips the session the wrong way).
 * - `stop-request` from `stop-confirm` (the touch hold) is `confirmStop`.
 *   From `playing` or `paused` (a keyboard or gamepad hold, which completes
 *   in the adapter without a `stopConfirm` first) it is `stopConfirm` then
 *   `confirmStop`, so the session still owns the transition in order. From
 *   `idle` it sends nothing.
 */
export function sessionEventsFor(kind: SessionRequestKind, session: SessionState, at: number): readonly SessionEvent[] {
  switch (kind) {
    case 'pause-request':
      return session.kind === 'playing' ? [{ type: 'pillPress', at }] : [];
    case 'resume-request':
      return session.kind === 'paused' ? [{ type: 'pillPress', at }] : [];
    case 'stop-request':
      switch (session.kind) {
        case 'stop-confirm':
          return [{ type: 'confirmStop', at }];
        case 'playing':
        case 'paused':
          return [{ type: 'stopConfirm', at }, { type: 'confirmStop', at }];
        case 'idle':
          return [];
      }
  }
}

/** True while gameplay input (stick, caps) should reach the camera: only a playing session moves the world. */
export function acceptsGameplayInput(session: SessionState): boolean {
  return session.kind === 'playing';
}

/**
 * The polite line spoken when every input is dropped at once
 * (G01 05-copy.md § Cancelled input, `g01.cancel.*`).
 */
export function cancelAnnouncement(reason: Extract<InputEvent, { kind: 'cancel-all' }>['reason']): string {
  switch (reason) {
    case 'background':
      return 'Paused while the app was in the background';
    case 'fold-change':
      return 'Paused while the screen changed shape';
    case 'layout-change':
      return 'Controls moved to fit the screen';
    case 'source-disconnected':
      return 'Controller disconnected. Touch controls are on';
    case 'gesture-cancel':
    case 'focus-loss':
    case 'screen-transition':
      return 'Controls reset';
  }
}

/**
 * True when the Game screen's router, hardware adapter and controller should
 * be live (review finding H1): the world can take input and the lobby has
 * handed the tab over. Under the transition cover the phase is `transition`,
 * so a held pad stick or a screen reader never reaches the world before the
 * resumed frame is revealed.
 */
export function gameplayInputEnabled(worldReady: boolean, lobbyPhase: 'lobby' | 'transition' | 'game'): boolean {
  return worldReady && lobbyPhase === 'game';
}
