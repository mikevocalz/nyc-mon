import { AudioContext } from 'react-native-audio-api';
import { soundEnabled } from '../../device-preferences';
import { scheduleChirp, type ChirpContext } from './chirp-core';

/**
 * Native: the same chirp on react-native-audio-api, which mirrors Web Audio.
 * The context is made on the first press and kept; the stage's Sound switch
 * decides whether a press plays.
 */
let context: AudioContext | null = null;

/** Create the context ahead of the first chirp. Native has no autoplay gate, so this only warms it. */
export function primeSideKeyChirp(): void {
  try {
    context ??= new AudioContext();
  } catch {
    context = null; // no audio here; the press still works silently
  }
}

/** Play the chirp once. A no-op where the audio context can't start. */
export function playSideKeyChirp(): void {
  // The Caller's Sound switch (Settings, M19) wins over the stage's own prop.
  if (!soundEnabled()) return;
  primeSideKeyChirp();
  if (context) scheduleChirp(context as unknown as ChirpContext);
}
