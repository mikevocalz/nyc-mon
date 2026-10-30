import { babyTalkEndsAt, hash128, voiceStage, type VoiceStageSubject } from '@acme/core';

/**
 * Ambient babble (Decision 32): an Egg, and a Baby in its first 24 hours,
 * babbles now and then on its own while its screen is up. At most once per
 * 45 to 90 s, the gap jittered by a seed so it never ticks like a metronome.
 *
 * A turn that comes due while the Mon cannot speak (Sound off, a line already
 * playing, the voice-note recorder open) is skipped, never queued: the next
 * turn is scheduled as usual. Once a Baby passes `hatchedAt + 24 h` the
 * scheduler stops; when that moment falls inside the next gap it wakes at
 * that moment instead, finds the babble over and stops.
 *
 * Pure apart from the timer and clock it is handed, so tests drive it by hand.
 */

export const AMBIENT_BABBLE_MIN_MS = 45_000;
export const AMBIENT_BABBLE_MAX_MS = 90_000;

/** The gap before ambient turn `turn`, in [45 s, 90 s], the same for the same seed and turn. */
export function ambientBabbleDelayMs(seed: string, turn: number): number {
  const [word] = hash128(`nyc-mon/ambient-babble/${seed}/${turn}`);
  const unit = (word >>> 0) / 0x1_0000_0000;
  return AMBIENT_BABBLE_MIN_MS + Math.floor(unit * (AMBIENT_BABBLE_MAX_MS - AMBIENT_BABBLE_MIN_MS + 1));
}

/** True while the Mon babbles on its own: an Egg, or a Baby in its first day. */
export function ambientBabbleActive(mon: VoiceStageSubject, now: number): boolean {
  return voiceStage(mon, now) === 'baby-talk';
}

export interface AmbientBabbleDeps {
  /** The Mon (or Egg) on screen; read on every turn, so a hatch or a stage change is seen. */
  readonly subject: () => VoiceStageSubject | undefined;
  readonly now: () => number;
  /** Runs `fire` after `ms`; returns a cancel. */
  readonly setTimer: (ms: number, fire: () => void) => () => void;
  /** False while Sound is off, a line is playing, or a voice session (recorder, listening) is open. */
  readonly canSpeak: () => boolean;
  /** Says one babble line; `seed` makes it the same babble for the same turn. */
  readonly babble: (seed: string) => void;
  /** Seeds the jitter and the babble: the Mon's id. */
  readonly seed: string;
}

/** Starts the ambient babble; the returned function stops it (blur, unmount, background). */
export function startAmbientBabble(deps: AmbientBabbleDeps): () => void {
  let cancel: (() => void) | null = null;
  let stopped = false;
  let turn = 0;

  const schedule = () => {
    cancel = null;
    if (stopped) return;
    const mon = deps.subject();
    const now = deps.now();
    if (mon === undefined || !ambientBabbleActive(mon, now)) return;
    const gap = ambientBabbleDelayMs(deps.seed, turn);
    const endsAt = babyTalkEndsAt(mon);
    if (endsAt !== null && now + gap >= endsAt) {
      // The first day ends inside this gap: wake then, re-read the stage, and stop.
      cancel = deps.setTimer(Math.max(0, endsAt - now), schedule);
      return;
    }
    cancel = deps.setTimer(gap, fire);
  };

  const fire = () => {
    cancel = null;
    if (stopped) return;
    const mon = deps.subject();
    if (mon !== undefined && ambientBabbleActive(mon, deps.now()) && deps.canSpeak()) {
      deps.babble(`${deps.seed}|ambient|${turn}`);
    }
    turn += 1;
    schedule();
  };

  schedule();
  return () => {
    stopped = true;
    cancel?.();
    cancel = null;
  };
}
