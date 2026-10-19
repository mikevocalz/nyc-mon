// The controller's touch and accessibility path into the router, with the
// rules that keep `heldButtons` honest when the controller stops being live.
// Pure (no react-native import) so node tests drive it against a real router.
//
// Rules:
// - A down is sent only while live. An up is always sent: a cap pressed while
//   live and released after `disabled` or `mode` flipped must still reach the
//   router, or the router keeps it held (finding H4). An up the router never
//   saw a down for is rejected and counted there, which is harmless.
// - Live going true → false calls `cancelAll('gesture-cancel')`, so holds
//   whose up will never come (the gesture was torn down) are dropped.
// - An accessibility activation is a down then an up ACCESSIBILITY_PRESS_MS
//   later. `dispose()` clears the pending timers and sends their ups at once,
//   so an unmount never strands a held cap (finding L7).
// - `releaseTouch()` ends only what touch holds (its caps up, its stick
//   cancelled). The controller calls it when the touch slots unmount because
//   a hardware source took over (finding H8): a router-wide cancelAll there
//   would also drop the very gamepad press that caused the switch.
import type { ButtonId, CancelReason, GameInputRouter, Phase } from './contract.ts';

/** An accessibility activation is a down then an up this long after (G01 08-handoff.md § Interaction). */
export const ACCESSIBILITY_PRESS_MS = 80;

/** Timer functions; injectable so tests run without real time. */
export interface GateTimers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

/** Options for {@linkcode createTouchInputGate}. */
export interface TouchInputGateOptions {
  readonly router: Pick<GameInputRouter, 'buttonDown' | 'buttonUp' | 'cancelAll' | 'move'>;
  /** Whether the controller accepts new input right now. */
  readonly live: boolean;
  /** Defaults to `Date.now`. */
  readonly now?: () => number;
  /** Defaults to the global timers. */
  readonly timers?: GateTimers;
}

/** What {@linkcode createTouchInputGate} returns. */
export interface TouchInputGate {
  /** A touch went down on a cap. Returns `true` when it was forwarded (the caller plays the press haptic only then). */
  down(id: ButtonId, timestampMs: number): boolean;
  /** A touch on a cap ended. Always forwarded. */
  up(id: ButtonId, timestampMs: number): void;
  /** A touch stick reading. `begin` is forwarded only while live; `update`, `end` and `cancel` always are. */
  move(x: number, y: number, phase: Phase, timestampMs: number): void;
  /** Ends what touch holds right now (caps up, stick cancelled), leaving other sources alone. */
  releaseTouch(): void;
  /** Screen-reader activation of a cap: a down now, an up {@linkcode ACCESSIBILITY_PRESS_MS} later. Ignored while not live. */
  accessibilityActivate(id: ButtonId): void;
  /** Update liveness. True → false cancels every held input with `reason`. */
  setLive(live: boolean, reason?: CancelReason): void;
  /** Clears pending accessibility timers and sends their ups now. Idempotent. */
  dispose(): void;
}

const DEFAULT_TIMERS: GateTimers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * Builds the gate an {@linkcode ArcadeController} instance owns for its
 * lifetime. Call {@linkcode TouchInputGate.setLive} from an effect when the
 * controller's liveness changes and {@linkcode TouchInputGate.dispose} on
 * unmount.
 */
export function createTouchInputGate(options: TouchInputGateOptions): TouchInputGate {
  const { router } = options;
  const now = options.now ?? Date.now;
  const timers = options.timers ?? DEFAULT_TIMERS;
  let live = options.live;
  const pending = new Map<ButtonId, unknown>();
  const touchHeld = new Set<ButtonId>();
  let touchStick = false;

  function releaseAccessibility(id: ButtonId): void {
    const handle = pending.get(id);
    if (handle === undefined) return;
    timers.clearTimeout(handle);
    pending.delete(id);
    router.buttonUp(id, 'accessibility', now());
  }

  return {
    down(id, timestampMs) {
      if (!live) return false;
      touchHeld.add(id);
      router.buttonDown(id, 'touch', timestampMs);
      return true;
    },
    up(id, timestampMs) {
      touchHeld.delete(id);
      router.buttonUp(id, 'touch', timestampMs);
    },
    move(x, y, phase, timestampMs) {
      if (phase === 'begin') {
        if (!live) return;
        touchStick = true;
      } else if (phase === 'end' || phase === 'cancel') {
        touchStick = false;
      }
      router.move(x, y, phase, 'touch', timestampMs);
    },
    releaseTouch() {
      const t = now();
      for (const id of [...touchHeld]) {
        touchHeld.delete(id);
        router.buttonUp(id, 'touch', t);
      }
      if (touchStick) {
        touchStick = false;
        router.move(0, 0, 'cancel', 'touch', t);
      }
    },
    accessibilityActivate(id) {
      if (!live) return;
      // A second activation inside the window finishes the first press before starting another.
      releaseAccessibility(id);
      router.buttonDown(id, 'accessibility', now());
      pending.set(
        id,
        timers.setTimeout(() => {
          pending.delete(id);
          router.buttonUp(id, 'accessibility', now());
        }, ACCESSIBILITY_PRESS_MS),
      );
    },
    setLive(next, reason = 'gesture-cancel') {
      const was = live;
      live = next;
      if (was && !next) {
        for (const id of [...pending.keys()]) {
          timers.clearTimeout(pending.get(id));
          pending.delete(id);
        }
        touchHeld.clear();
        touchStick = false;
        router.cancelAll(reason);
      }
    },
    dispose() {
      for (const id of [...pending.keys()]) releaseAccessibility(id);
    },
  };
}
