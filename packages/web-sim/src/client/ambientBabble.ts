import { planMonUtterance } from '@acme/content/voice';
import { liveVoiceStage, type MonVoice } from './monVoice.ts';

/**
 * An Egg, and a Baby in its first day, babbles now and then on its own
 * (Decision 32). One line every 45 to 90 seconds at most, with jitter, from a
 * seeded script (`planMonUtterance` with a seed): no model call. Never while
 * muted, never while the Mon is speaking or the Caller is talking (the voice
 * controller's listening, thinking and speaking phases), and never for a Mon
 * that has words.
 */

export const AMBIENT_MIN_MS = 45_000;
export const AMBIENT_MAX_MS = 90_000;

export function ambientDelay(random: () => number): number {
  return AMBIENT_MIN_MS + Math.floor(random() * (AMBIENT_MAX_MS - AMBIENT_MIN_MS));
}

/** The `index`th ambient line for this voice: the same babble on every device for the same Mon. */
export function ambientBabbleLine(voice: MonVoice, index: number): string {
  return planMonUtterance('', { ...voice, voiceStage: 'baby-talk' }, undefined, { seed: `${voice.lineageId}|ambient|${index}` }).caption;
}

export interface AmbientBabbleDeps {
  readonly voice: () => MonVoice | undefined;
  readonly hatchedAt: () => number | undefined;
  /** True while the Mon speaks, the Caller talks or is heard, or a turn runs. */
  readonly quiet: () => boolean;
  readonly muted: () => boolean;
  /** Speaks and captions one line. */
  readonly say: (line: string) => void;
  readonly now?: () => number;
  readonly random?: () => number;
  readonly setTimer?: (fn: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
}

/** Starts the ambient babble; the returned function stops it (call it on unmount). */
export function startAmbientBabble(deps: AmbientBabbleDeps): () => void {
  const now = deps.now ?? Date.now;
  const random = deps.random ?? Math.random;
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number) => globalThis.setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((h: unknown) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>));
  let stopped = false;
  let handle: unknown = null;
  let spoken = 0;

  const tick = () => {
    if (stopped) return;
    handle = setTimer(tick, ambientDelay(random));
    const voice = deps.voice();
    if (deps.muted() || deps.quiet() || liveVoiceStage(voice, deps.hatchedAt(), now()) !== 'baby-talk' || voice === undefined) return;
    deps.say(ambientBabbleLine(voice, spoken++));
  };
  handle = setTimer(tick, ambientDelay(random));

  return () => {
    stopped = true;
    clearTimer(handle);
  };
}
