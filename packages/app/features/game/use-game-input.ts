'use client';
// The one GameInputRouter the Game screen owns (Master Directive v2 §9), and
// the subscription that turns its events into Caller moves, chase-camera
// moves and session events. Module scope like gameCameraStore: the router outlives the
// component, so a fold or a tab change never loses a held button's pairing
// (the hook cancels everything instead, through the router, so every
// adapter and the overlay hear one `cancel-all`).
//
// Order of authority (Muratori, Carmack/Acton): the router validates and
// orders input; this file maps it (game-input-bindings.ts, pure); the
// Caller simulation (character/caller-controller.ts, pure) steps on a
// requestAnimationFrame loop that runs only while something moves (stick
// engaged, a jump in the air, the camera catching up); the Caller, camera and
// session stores apply it; the proxy, the overlay and Rive only reflect.
// A custom camera map still works: its caps repeat on a setTimeout chain
// bounded by the router's `heldButtons`. Neither path renders React.
//
// Cleanup (§9 "safe cleanup"): AppState leaving `active` → `background`,
// the route losing focus (`focused` turning false, passed down from the
// route so this package imports no router) → `screen-transition`, a fold change →
// `fold-change`, a container resize → `layout-change`, unmount →
// `screen-transition`. The hardware adapter adds `source-disconnected` and
// its own `background`; a second cancel finds nothing held and stays silent.
import { useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { useStore } from 'zustand';
import type { SessionState } from '@acme/core';
import { useInstanceStore } from '@acme/ui';
import {
  DEFAULT_CAMERA_BINDINGS,
  NEUTRAL_STICK,
  STOP_HOLD_MS,
  createGameInputRouter,
  type ButtonId,
  type ControllerProfile,
  type InputEvent,
  type StickReading,
} from '@acme/ui/game-controls/parts';
import {
  selectIsHardwareSourceActive,
  useHardwareInput,
  useHardwareInputStore,
} from '@acme/ui/game-controls/hardware';
import { commandToAction } from './camera-input.ts';
import { RELEASED_CONTROLS, NOTHING_TO_INTERACT, stepGameFrame, type CallerControls } from './character/caller-controller.ts';
import { chaseRef, cycleZoom, frameWake, jump, placeCaller, recentre, resetViewTurns, streetAxes, worldQueries } from './character/caller-runtime.ts';
import { callerStore } from './character/caller-store.ts';
import type { CityDataset } from './city-dataset.ts';
import {
  acceptsGameplayInput,
  buttonToCallerAction,
  buttonToCommand,
  isHoldAction,
  cancelAnnouncement,
  isRepeatable,
  nextRepeatAtMs,
  sessionEventsFor,
} from './game-input-bindings.ts';
import { gameCameraStore } from './game-session.ts';
import { runSessionEffects, type WorldSaveLifecycleInput } from './world-resume/use-world-save-lifecycle.ts';
import { worldSaveStore } from './world-resume/world-save.store.ts';
import { sessionIdForStart, type WorldIdentity } from './world-resume/world-snapshot.ts';
import { worldSessionStore } from './world-resume/world-session.store.ts';

/**
 * The Game screen's router. Touch (the overlay), keyboard, gamepad and
 * accessibility adapters all call it; {@linkcode useGameInput} is its one
 * subscriber. Bindings are the default camera map until a gameplay spec
 * exists (§2B); a future screen replaces them with `setBindings`.
 */
export const gameInputRouter = createGameInputRouter({ bindings: DEFAULT_CAMERA_BINDINGS });

/** Options for {@linkcode useGameInput}. Read on every event through a ref, so changing them never resubscribes. */
export interface GameInputOptions {
  /** `false` while a blocking state covers the world or the lobby is up: the router and the hardware adapter are detached. */
  readonly enabled: boolean;
  /** Whether the route has navigation focus; turning `false` drops every input with `screen-transition`. */
  readonly focused: boolean;
  /** @deprecated Canvas height in dp. Read by nothing since the stick drives the Caller; remove with the next GameScreen edit. */
  readonly viewportHeight: () => number;
  /** The signed-in Caller, or `null` before one exists; a session cannot start without it. */
  readonly identity: WorldIdentity | null;
  readonly dataset: CityDataset | null;
  /** The one controller profile; dead zone and sensitivity for the hardware stick. */
  readonly profile: ControllerProfile;
  /** Changes when a fold appears, moves or disappears: every input is dropped with `fold-change`. */
  readonly foldSignature: string;
  /** Changes when the container resizes: every input is dropped with `layout-change`. */
  readonly layoutSignature: string;
  /** OS reduced motion: the chase camera snaps to the Caller and the block settle lands in one frame instead of easing. */
  readonly reducedMotion?: boolean;
}

/** What {@linkcode useGameInput} hands the screen for the overlay's props and the pill's session calls. */
export interface GameInput {
  readonly session: SessionState;
  /** The pill state the overlay reflects; the session owns it. */
  readonly pill: ReturnType<typeof worldSessionStore.getState>['pill'];
  /** Ring fill 0…1 while the session is in `stop-confirm`, from the session's own clock. */
  readonly stopProgress: number;
  /** `true` while a gamepad or keyboard drives; the touch overlay hides. */
  readonly hideTouchControls: boolean;
  /** The lobby's start, repeated here for an in-game START. Continues this Caller's saved session id when one exists (ADR 0020). No-op without an identity. */
  readonly startSession: () => void;
  /** The pill's hold began: the session enters `stop-confirm`. */
  readonly beginStopConfirm: () => void;
  /** The hold ended early: back to where the player was. */
  readonly cancelStopConfirm: () => void;
  /**
   * A release inside the tap window while `stop-confirm` is open: the press was
   * a short-press (pause/resume), so cancel the confirm then toggle with one
   * `pillPress` — it lands on whatever `resumeTo` the cancel restored.
   */
  readonly shortPressFromStopConfirm: () => void;
}

interface StopProgressState {
  progress: number;
}

/** Ring steps per hold; the pill quantizes to 20 as well, so finer ticks would change nothing visible. */
const STOP_PROGRESS_STEPS = 20;

function dispatchSession(event: Parameters<ReturnType<typeof worldSessionStore.getState>['dispatch']>[0], input: WorldSaveLifecycleInput): void {
  runSessionEffects(worldSessionStore.getState().dispatch(event), input);
}

/**
 * Subscribes {@linkcode gameInputRouter} to the camera and the session for
 * as long as the Game screen is mounted and `enabled`, and mounts the
 * hardware adapter on the same router so a gamepad or keyboard drives the
 * same path as touch. Stick and cap input reach the camera only while the
 * session is `playing` ({@linkcode acceptsGameplayInput}); pause, resume and
 * stop requests reach the session from any state the machine accepts.
 *
 * @example
 * ```tsx
 * const input = useGameInput({ enabled: ready, focused, viewportHeight, identity, dataset, profile, foldSignature, layoutSignature, reducedMotion });
 * <ArcadeController router={gameInputRouter} pill={input.pill} stopProgress={input.stopProgress} … />
 * ```
 */
export function useGameInput(options: GameInputOptions): GameInput {
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });
  const { enabled, focused, foldSignature, layoutSignature, profile } = options;

  const session = useStore(worldSessionStore, (s) => s.session);
  const pill = useStore(worldSessionStore, (s) => s.pill);
  const hideTouchControls = useHardwareInputStore(selectIsHardwareSourceActive);

  useHardwareInput(gameInputRouter, { profile, pill, enabled });

  // The subscription: one per mount while enabled. Timers and the frame loop live inside it.
  useEffect(() => {
    if (!enabled) return undefined;
    const router = gameInputRouter;
    const camera = gameCameraStore;
    let reading: StickReading = NEUTRAL_STICK;
    let controls: CallerControls = RELEASED_CONTROLS;
    let frame = 0;
    let lastFrameMs = 0;
    const repeats = new Map<ButtonId, ReturnType<typeof setTimeout>>();

    const lifecycleInput = (): WorldSaveLifecycleInput => ({ identity: latest.current.identity, dataset: latest.current.dataset });

    // Gameplay input turning on is the hand-over: put the Caller where the camera looks.
    // A null placement (nothing walkable in reach of the look-at) leaves the
    // Caller unspawned at the 220 m overview with every control dead, so the
    // placement retries on a short timer until it takes or the input unmounts.
    placeCaller();
    let placementTimer: ReturnType<typeof setTimeout> | null = null;
    let placementTries = 0;
    const retryPlacement = (): void => {
      placementTimer = null;
      if (callerStore.getState().spawned || placementTries >= 20) return;
      placementTries += 1;
      placeCaller();
      if (!callerStore.getState().spawned) placementTimer = setTimeout(retryPlacement, 250);
    };
    if (!callerStore.getState().spawned) placementTimer = setTimeout(retryPlacement, 250);

    const stopLoop = (): void => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      lastFrameMs = 0;
    };
    const step = (nowMs: number): void => {
      frame = 0;
      const dt = lastFrameMs ? (nowMs - lastFrameMs) / 1000 : 1 / 60;
      lastFrameMs = nowMs;
      if (!acceptsGameplayInput(worldSessionStore.getState().session)) {
        // Paused: hold still, and keep listening only while the stick is still down.
        if (controls.engaged) frame = requestAnimationFrame(step);
        else lastFrameMs = 0;
        return;
      }
      const before = { caller: callerStore.getState(), camera: camera.getState().camera, chase: chaseRef.current };
      const next = stepGameFrame(before, controls, dt, latest.current.reducedMotion ?? false, worldQueries, streetAxes);
      chaseRef.current = next.chase;
      if (next.caller !== before.caller) callerStore.setState(next.caller, true);
      if (next.camera !== before.camera) camera.setState({ camera: next.camera });
      if (next.active) frame = requestAnimationFrame(step);
      else lastFrameMs = 0;
    };
    const startLoop = (): void => {
      if (frame) return;
      lastFrameMs = 0;
      frame = requestAnimationFrame(step);
    };
    // A drag or twist ending outside the loop wakes it, so the view settles onto the block.
    frameWake.current = startLoop;

    const clearRepeat = (button: ButtonId): void => {
      const timer = repeats.get(button);
      if (timer) clearTimeout(timer);
      repeats.delete(button);
    };
    // A custom camera map (a cap bound to a CameraCommand) keeps its old behaviour.
    const runCommand = (button: ButtonId): boolean => {
      const command = buttonToCommand(button, DEFAULT_CAMERA_BINDINGS);
      if (command === null) return false;
      if (!acceptsGameplayInput(worldSessionStore.getState().session)) return false;
      const { camera: current, move } = camera.getState();
      move(commandToAction(command, current));
      return isRepeatable(command);
    };
    const scheduleRepeat = (button: ButtonId, downAtMs: number, fired: number): void => {
      const delay = Math.max(0, nextRepeatAtMs(downAtMs, fired) - Date.now());
      repeats.set(button, setTimeout(() => {
        repeats.delete(button);
        // Bounded by the router: a cap that is no longer held never repeats.
        if (!router.heldButtons.has(button)) return;
        if (runCommand(button)) scheduleRepeat(button, downAtMs, fired + 1);
      }, delay));
    };

    // A cap bound to a Caller action. Returns false when the binding is not one.
    const runCallerAction = (button: ButtonId, down: boolean): boolean => {
      const action = buttonToCallerAction(button, DEFAULT_CAMERA_BINDINGS);
      if (action === null) return false;
      if (isHoldAction(action)) {
        const held = down || router.heldButtons.has(button);
        controls = action === 'run' ? { ...controls, run: held } : { ...controls, look: held };
        // Letting go of Z settles the view onto the block, which needs a frame even with the stick at rest.
        startLoop();
        return true;
      }
      if (!down || !acceptsGameplayInput(worldSessionStore.getState().session)) return true;
      switch (action) {
        case 'jump': jump(); startLoop(); break;
        case 'recentre': recentre(); startLoop(); break;
        case 'zoomCycle': cycleZoom(); break;
        // No interactables exist yet; say so instead of a press that does nothing.
        case 'interact': AccessibilityInfo.announceForAccessibility(NOTHING_TO_INTERACT); break;
      }
      return true;
    };

    const onEvent = (event: InputEvent): void => {
      switch (event.kind) {
        case 'move':
          reading = event.reading;
          controls = { ...controls, stickX: reading.x, stickY: reading.y, engaged: reading.engaged };
          // Releasing the stick lets the loop run until the camera settles and any jump lands.
          startLoop();
          return;
        case 'button-down':
          clearRepeat(event.button);
          if (runCallerAction(event.button, true)) return;
          if (runCommand(event.button)) scheduleRepeat(event.button, Date.now(), 0);
          return;
        case 'button-up':
          if (runCallerAction(event.button, false)) return;
          if (!router.heldButtons.has(event.button)) clearRepeat(event.button);
          return;
        case 'pause-request':
        case 'resume-request':
        case 'stop-request': {
          const now = Date.now();
          const input = lifecycleInput();
          for (const sessionEvent of sessionEventsFor(event.kind, worldSessionStore.getState().session, now)) {
            dispatchSession(sessionEvent, input);
          }
          return;
        }
        case 'cancel-all': {
          const hadInput = reading.engaged || controls.run || controls.look || repeats.size > 0;
          reading = NEUTRAL_STICK;
          controls = RELEASED_CONTROLS;
          for (const button of [...repeats.keys()]) clearRepeat(button);
          // Let a jump land and the camera settle; the loop stops itself once nothing moves.
          startLoop();
          // One polite line per cancel the player could have felt (G01 05-copy.md § Cancelled input).
          if (hadInput) AccessibilityInfo.announceForAccessibility(cancelAnnouncement(event.reason));
          return;
        }
      }
    };

    const subscription = router.addListener(onEvent);
    const appState = AppState.addEventListener('change', (status) => {
      if (status !== 'active') router.cancelAll('background');
    });
    return () => {
      router.cancelAll('screen-transition');
      appState.remove();
      subscription.remove();
      if (placementTimer) clearTimeout(placementTimer);
      stopLoop();
      frameWake.current = null;
      resetViewTurns();
      for (const button of [...repeats.keys()]) clearRepeat(button);
    };
  }, [enabled]);

  // Leaving the route (tab change, a pushed screen) drops every input; the session is untouched.
  useEffect(() => {
    if (!focused) gameInputRouter.cancelAll('screen-transition');
  }, [focused]);

  // A fold or a resize moves the controls: nothing stays held across the move.
  const lastFold = useRef(foldSignature);
  const lastLayout = useRef(layoutSignature);
  useEffect(() => {
    if (lastFold.current !== foldSignature) {
      lastFold.current = foldSignature;
      lastLayout.current = layoutSignature;
      gameInputRouter.cancelAll('fold-change');
      return;
    }
    if (lastLayout.current !== layoutSignature) {
      lastLayout.current = layoutSignature;
      gameInputRouter.cancelAll('layout-change');
    }
  }, [foldSignature, layoutSignature]);

  // The session's confirm timer: while `stop-confirm`, the ring fills from `pausedAt` over STOP_HOLD_MS.
  const stop = useInstanceStore<StopProgressState>(() => ({ progress: 0 }));
  const stopProgress = useStore(stop, (s) => s.progress);
  const confirmingSince = session.kind === 'stop-confirm' ? session.pausedAt : null;
  useEffect(() => {
    if (confirmingSince === null) {
      stop.setState({ progress: 0 });
      return undefined;
    }
    const tick = (): void => {
      const raw = (Date.now() - confirmingSince) / STOP_HOLD_MS;
      const quantized = Math.min(1, Math.max(0, Math.round(raw * STOP_PROGRESS_STEPS) / STOP_PROGRESS_STEPS));
      if (stop.getState().progress !== quantized) stop.setState({ progress: quantized });
    };
    tick();
    const timer = setInterval(tick, STOP_HOLD_MS / STOP_PROGRESS_STEPS);
    return () => clearInterval(timer);
  }, [confirmingSince, stop]);

  const startSession = useCallback(() => {
    const { identity } = latest.current;
    if (identity === null) return;
    const now = Date.now();
    const { snapshot } = worldSaveStore.getState();
    const previous = snapshot.status === 'loaded' ? snapshot.save : null;
    dispatchSession({ type: 'start', sessionId: sessionIdForStart(previous, identity, now), at: now }, lifecycleInputOf(latest.current));
  }, []);
  const beginStopConfirm = useCallback(() => {
    dispatchSession({ type: 'stopConfirm', at: Date.now() }, lifecycleInputOf(latest.current));
  }, []);
  const cancelStopConfirm = useCallback(() => {
    dispatchSession({ type: 'cancelStop', at: Date.now() }, lifecycleInputOf(latest.current));
  }, []);
  const shortPressFromStopConfirm = useCallback(() => {
    const now = Date.now();
    const input = lifecycleInputOf(latest.current);
    dispatchSession({ type: 'cancelStop', at: now }, input);
    dispatchSession({ type: 'pillPress', at: now }, input);
  }, []);

  return { session, pill, stopProgress, hideTouchControls, startSession, beginStopConfirm, cancelStopConfirm, shortPressFromStopConfirm };
}

function lifecycleInputOf(options: GameInputOptions): WorldSaveLifecycleInput {
  return { identity: options.identity, dataset: options.dataset };
}
