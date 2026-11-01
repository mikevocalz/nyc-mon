// Press-and-hold on the pause key is the hardware stop request (directive
// §2C: never a bare tap). The timing lives here, in event-clock milliseconds,
// so the hook's timer and the release path agree on one number: the
// contract's STOP_HOLD_MS, which the touch pill reads too.
import { STOP_HOLD_MS } from '../contract.ts';

/** How long Start (gamepad) or Escape (keyboard) stays down before it reads as a stop request. Re-exported from the contract. */
export { STOP_HOLD_MS };

/**
 * A pause key currently down. `null` while it is up. `fired` is set once
 * the hold produced a stop request, so the release that follows makes no
 * second request.
 */
export interface HoldState {
  readonly downAtMs: number;
  readonly fired: boolean;
}

/** A down edge at `timestampMs` on the source's event clock. */
export function beginHold(timestampMs: number): HoldState {
  return { downAtMs: timestampMs, fired: false };
}

/**
 * The timer path: `true` once the key has been down for
 * {@linkcode STOP_HOLD_MS} and the stop has not been sent yet.
 */
export function holdReached(hold: HoldState | null, nowMs: number): boolean {
  return hold !== null && !hold.fired && nowMs - hold.downAtMs >= STOP_HOLD_MS;
}

/** Marks the stop as sent. A `null` hold stays `null`. */
export function markHoldFired(hold: HoldState | null): HoldState | null {
  return hold === null ? null : { downAtMs: hold.downAtMs, fired: true };
}

/**
 * What a release means. `stop` covers the case where the timer never ran
 * (the JS thread was busy) but the key was down long enough anyway; `none`
 * is a release after the timer already sent the stop, or with no down on
 * record (a key that was down before the adapter mounted).
 */
export type HoldRelease = 'short-press' | 'stop' | 'none';

export function releaseHold(hold: HoldState | null, timestampMs: number): HoldRelease {
  if (hold === null || hold.fired) return 'none';
  return timestampMs - hold.downAtMs >= STOP_HOLD_MS ? 'stop' : 'short-press';
}
