import { AudioContext } from 'react-native-audio-api';
import { holdAmbientSession } from '../../audio/session';
import { soundEnabled } from '../../device-preferences';
import { chirpSeconds, scheduleChirp } from './chirp-core';

/**
 * Native: the same chirp on react-native-audio-api, which mirrors Web Audio.
 * The context is made on the first press and kept; the stage's Sound switch
 * decides whether a press plays. Each chirp takes the shared ambient-session
 * lease (audio/session.native.ts) for its length, so the Ring/Silent switch
 * silences it, and a voice line or care cue playing at the same moment keeps
 * its own lease.
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
  // The lease goes first so the session is ambient before the context starts.
  holdAmbientSession(chirpSeconds());
  primeSideKeyChirp();
  if (!context) return;
  const ctx = context;
  if (ctx.state === 'suspended') {
    void ctx.resume().then(() => scheduleChirp(ctx), () => {});
    return;
  }
  scheduleChirp(ctx);
}
