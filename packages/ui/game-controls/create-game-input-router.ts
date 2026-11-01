// The renderer-independent input router (Master Directive v2 §9). Pure: no
// react-native import, no Rive, no renderer, so `node --test` covers every
// validation rule. Touch, keyboard, gamepad and accessibility adapters call
// the same six methods; the gameplay screen subscribes with addListener.
//
// Closures, not a class: adapters hand `router.move` and `router.buttonDown`
// to scheduleOnRN from a UI-thread worklet, where a lost `this` would be a
// silent bug.
import {
  BUTTON_IDS,
  type ButtonId,
  type CancelReason,
  type ControllerBindings,
  type GameInputRouter,
  type InputDiagnostics,
  type InputEvent,
  type InputSource,
  type ListenerSubscription,
  type Phase,
  type StickReading,
} from './contract.ts';
import { NEUTRAL_STICK, direction8 } from './stick-math.ts';

const SOURCES: readonly InputSource[] = ['touch', 'keyboard', 'gamepad', 'accessibility'];
const PHASES: readonly Phase[] = ['begin', 'update', 'end', 'cancel'];
const CANCEL_REASONS: readonly CancelReason[] = [
  'background', 'focus-loss', 'layout-change', 'gesture-cancel', 'screen-transition', 'fold-change', 'source-disconnected',
];

/** Options for {@linkcode createGameInputRouter}. */
export interface GameInputRouterOptions {
  /**
   * Button meanings for the current gameplay screen. A binding with
   * `enabled: false` makes the router drop that button's presses (counted as
   * rejected). Omitted: every button is enabled. Change later with
   * {@linkcode CreatedGameInputRouter.setBindings}.
   */
  readonly bindings?: ControllerBindings;
  /**
   * Clock for the pause, resume and stop requests, which the contract takes
   * without a timestamp. Defaults to `Date.now`.
   */
  readonly now?: () => number;
  /**
   * Receives an error a listener threw. The router catches it so the
   * remaining listeners still get the event (finding L9) and counts it in
   * {@linkcode CreatedGameInputRouter.listenerErrors}. Defaults to a
   * development-only `console.error`.
   */
  readonly onListenerError?: (error: unknown, event: InputEvent) => void;
}

/**
 * What {@linkcode createGameInputRouter} returns: the contract's
 * {@linkcode GameInputRouter} plus the diagnostics the debug overlay and the
 * tests read, and the binding update the gameplay screen needs.
 */
export interface CreatedGameInputRouter extends GameInputRouter {
  /** Live counters. The object is replaced on every change; read it, never hold it. */
  readonly diagnostics: InputDiagnostics;
  /** Listener calls that threw since creation. Each one was caught; later listeners still ran. */
  readonly listenerErrors: number;
  /** Replace the bindings. Buttons already held stay held until their up arrives, so pairing never breaks. */
  setBindings(bindings: ControllerBindings | undefined): void;
}

/**
 * Builds the one router a gameplay screen owns (§9, §13 `GameInputRouter`).
 *
 * Rules every call goes through, in order: numbers must be finite, ids must
 * be known, a button down from a source that already holds that button is
 * dropped, a button up from a source that never pressed it is dropped, and
 * the stick belongs to the source that began it until it ends or cancels. A
 * dropped call increments {@linkcode InputDiagnostics.rejected} and records
 * {@linkcode InputDiagnostics.lastRejection}; nothing throws, because the
 * adapters run on hot paths. Accepted calls are delivered to listeners in
 * arrival order, synchronously.
 *
 * {@linkcode GameInputRouter.cancelAll} drops every held button and the
 * stick, then emits exactly one `cancel-all` event; it never synthesises
 * `button-up` or `move` events, so a listener that mirrors held state must
 * clear it on `cancel-all`.
 *
 * @example
 * ```ts
 * const router = createGameInputRouter({ bindings });
 * const subscription = router.addListener((event) => {
 *   if (event.kind === 'cancel-all') session.releaseEverything();
 * });
 * // ...on unmount
 * router.cancelAll('screen-transition');
 * subscription.remove();
 * ```
 */
export function createGameInputRouter(options: GameInputRouterOptions = {}): CreatedGameInputRouter {
  const now = options.now ?? Date.now;
  let bindings = options.bindings;

  // Which sources hold each button. A button is "held" while any source holds it.
  const holders = new Map<ButtonId, Set<InputSource>>();
  const held = new Set<ButtonId>();
  let stick: StickReading = NEUTRAL_STICK;
  let stickOwner: InputSource | null = null;

  const listeners = new Set<(event: InputEvent) => void>();
  let listenerErrors = 0;
  const onListenerError = options.onListenerError ?? ((error: unknown) => {
    if ((globalThis as { __DEV__?: boolean }).__DEV__ === true) console.error('[game-input-router] a listener threw', error);
  });
  let accepted = 0;
  let rejected = 0;
  let lastRejection: string | null = null;
  let diagnostics: InputDiagnostics = snapshotDiagnostics();

  function activeSources(): ReadonlySet<InputSource> {
    const active = new Set<InputSource>();
    for (const sources of holders.values()) for (const source of sources) active.add(source);
    if (stickOwner) active.add(stickOwner);
    return active;
  }

  function snapshotDiagnostics(): InputDiagnostics {
    return { accepted, rejected, lastRejection, activeSources: activeSources() };
  }

  function reject(reason: string): void {
    rejected += 1;
    lastRejection = reason;
    diagnostics = snapshotDiagnostics();
  }

  function emit(event: InputEvent): void {
    accepted += 1;
    diagnostics = snapshotDiagnostics();
    // Snapshot, so a listener that unsubscribes another mid-dispatch cannot skip it.
    for (const listener of [...listeners]) {
      try {
        listener(event);
      } catch (error) {
        listenerErrors += 1;
        onListenerError(error, event);
      }
    }
  }

  const isSource = (source: unknown): source is InputSource => SOURCES.includes(source as InputSource);
  const isButton = (button: unknown): button is ButtonId => BUTTON_IDS.includes(button as ButtonId);
  const isTimestamp = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

  function move(x: number, y: number, phase: Phase, source: InputSource, timestampMs: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return reject('move: x and y must be finite');
    if (x < -1 || x > 1 || y < -1 || y > 1) return reject('move: x and y must be within -1…1');
    if (!PHASES.includes(phase)) return reject(`move: unknown phase ${String(phase)}`);
    if (!isSource(source)) return reject(`move: unknown source ${String(source)}`);
    if (!isTimestamp(timestampMs)) return reject('move: timestampMs must be finite');
    if (phase === 'begin') {
      if (stickOwner !== null && stickOwner !== source) return reject(`move: stick is owned by ${stickOwner}`);
      stickOwner = source;
    } else {
      if (stickOwner === null) return reject(`move: ${phase} without begin`);
      if (stickOwner !== source) return reject(`move: stick is owned by ${stickOwner}`);
    }
    const ending = phase === 'end' || phase === 'cancel';
    const reading: StickReading = ending || (x === 0 && y === 0)
      ? NEUTRAL_STICK
      : { x, y, engaged: true, direction: direction8(x, y) };
    stick = reading;
    if (ending) stickOwner = null;
    emit({ kind: 'move', reading, phase, source, timestampMs });
  }

  function buttonDown(button: ButtonId, source: InputSource, timestampMs: number): void {
    if (!isButton(button)) return reject(`buttonDown: unknown button ${String(button)}`);
    if (!isSource(source)) return reject(`buttonDown: unknown source ${String(source)}`);
    if (!isTimestamp(timestampMs)) return reject('buttonDown: timestampMs must be finite');
    if (bindings?.[button].enabled === false) return reject(`buttonDown: ${button} is disabled`);
    const sources = holders.get(button) ?? new Set<InputSource>();
    if (sources.has(source)) return reject(`buttonDown: ${button} is already down from ${source}`);
    sources.add(source);
    holders.set(button, sources);
    held.add(button);
    emit({ kind: 'button-down', button, source, timestampMs });
  }

  function buttonUp(button: ButtonId, source: InputSource, timestampMs: number): void {
    if (!isButton(button)) return reject(`buttonUp: unknown button ${String(button)}`);
    if (!isSource(source)) return reject(`buttonUp: unknown source ${String(source)}`);
    if (!isTimestamp(timestampMs)) return reject('buttonUp: timestampMs must be finite');
    const sources = holders.get(button);
    if (!sources?.has(source)) return reject(`buttonUp: ${button} is not down from ${source}`);
    sources.delete(source);
    if (sources.size === 0) {
      holders.delete(button);
      held.delete(button);
    }
    emit({ kind: 'button-up', button, source, timestampMs });
  }

  function request(kind: 'pause-request' | 'resume-request' | 'stop-request', source: InputSource): void {
    if (!isSource(source)) return reject(`${kind}: unknown source ${String(source)}`);
    emit({ kind, source, timestampMs: now() });
  }

  function cancelAll(reason: CancelReason): void {
    if (!CANCEL_REASONS.includes(reason)) return reject(`cancelAll: unknown reason ${String(reason)}`);
    holders.clear();
    held.clear();
    stick = NEUTRAL_STICK;
    stickOwner = null;
    emit({ kind: 'cancel-all', reason, timestampMs: now() });
  }

  function addListener(listener: (event: InputEvent) => void): ListenerSubscription {
    listeners.add(listener);
    return { remove: () => { listeners.delete(listener); } };
  }

  return {
    move,
    buttonDown,
    buttonUp,
    pauseRequest: (source) => request('pause-request', source),
    resumeRequest: (source) => request('resume-request', source),
    stopRequest: (source) => request('stop-request', source),
    cancelAll,
    addListener,
    setBindings: (next) => { bindings = next; },
    get heldButtons() { return held; },
    get stick() { return stick; },
    get diagnostics() { return diagnostics; },
    get listenerErrors() { return listenerErrors; },
  };
}
