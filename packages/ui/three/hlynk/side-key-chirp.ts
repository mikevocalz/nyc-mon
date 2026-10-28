import { soundEnabled } from '../../device-preferences';
import { scheduleChirp, type ChirpContext } from './chirp-core';

/**
 * Web (and the platform resolution anchor): the side key's chirp on the
 * browser's Web Audio. Nothing runs on load. The context is created on the
 * first press, in the press handler, so autoplay rules pass on every browser
 * (iOS Safari included). Volume follows the system mixer; the stage's Sound
 * switch mutes it. Same `.ts` extension as the native fork.
 */
let context: AudioContext | null = null;

/** Create or resume the audio context. Call from inside a user gesture handler. */
export function primeSideKeyChirp(): void {
  if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') return;
  try {
    context ??= new window.AudioContext();
    if (context.state === 'suspended') void context.resume();
  } catch {
    context = null; // no audio here; the press still works silently
  }
}

/** Play the chirp once. A no-op where Web Audio is missing. */
export function playSideKeyChirp(): void {
  // The Caller's Sound switch (Settings, M19) wins over the stage's own prop.
  if (!soundEnabled()) return;
  primeSideKeyChirp();
  if (context) scheduleChirp(context as unknown as ChirpContext);
}
