/**
 * One owner for the iOS audio session category, shared by every short sound
 * that should obey the Ring/Silent switch: the Mon voice line, the care cues
 * and the side-key chirp. Each holder takes a lease; the first lease switches
 * the session to `ambient` (silenced by the switch, mixes with the Caller's
 * music) and the session goes back to `playback` (the library default, which
 * voice notes rely on) only after the LAST lease is released, plus a margin
 * that covers drift between the JS timer and the audio clock. A lease taken
 * inside that margin cancels the restore, so back-to-back sounds never flip
 * the session between them.
 *
 * Pure: the category write and the timer are injected, so tests drive it
 * with fakes. session.native.ts binds it to react-native-audio-api.
 */

export type SessionCategory = 'ambient' | 'playback';

export interface SessionLeasePorts {
  /** Writes the session category. Throwing is allowed; the lease state stays consistent. */
  apply(category: SessionCategory): void;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  /** Ms after the last release before `playback` comes back. */
  readonly marginMs: number;
}

export interface SessionLeases {
  /** Takes a lease now. Returns its release, which is idempotent. */
  acquire(): () => void;
  /** Takes a lease for `seconds` of sound, released by timer. */
  hold(seconds: number): void;
  /** Leases currently held (for tests and dev tooling). */
  readonly active: () => number;
}

export function createSessionLeases(ports: SessionLeasePorts): SessionLeases {
  let count = 0;
  let ambient = false;
  let restore: unknown = null;

  const write = (category: SessionCategory) => {
    try {
      ports.apply(category);
    } catch {
      // The port reports its own failure; the lease count must not drift.
    }
  };

  const acquire = () => {
    if (restore !== null) {
      ports.clearTimer(restore);
      restore = null;
    }
    count += 1;
    if (!ambient) {
      ambient = true;
      write('ambient');
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      count -= 1;
      if (count > 0) return;
      restore = ports.setTimer(() => {
        restore = null;
        if (count > 0) return;
        ambient = false;
        write('playback');
      }, ports.marginMs);
    };
  };

  return {
    acquire,
    hold(seconds) {
      const release = acquire();
      ports.setTimer(release, Math.max(0, Math.ceil(seconds * 1000)));
    },
    active: () => count,
  };
}
