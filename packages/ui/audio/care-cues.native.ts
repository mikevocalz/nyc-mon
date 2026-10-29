import { AudioContext } from 'react-native-audio-api';
import { soundEnabled } from '../device-preferences.ts';
import type { ChirpContext } from '../three/hlynk/chirp-core.ts';
import { createCareCuePlayer, type CareCue } from './care-cues-core.ts';
import { holdCueSession } from './cue-session.native.ts';

/**
 * Native: the care cues on react-native-audio-api, which mirrors Web Audio.
 * One context, made on the first cue and kept. Each cue holds the iOS
 * session in `ambient` for its length (cue-session.native.ts), so the
 * Ring/Silent switch silences it.
 */
let context: AudioContext | null = null;

function nativeContext(): ChirpContext | null {
  context ??= new AudioContext();
  return context as unknown as ChirpContext;
}

/** Plays one care cue. A no-op when Sound is off or audio can't start. */
export const playCareCue: (cue: CareCue) => void = createCareCuePlayer({
  enabled: soundEnabled,
  context: nativeContext,
  willPlay: holdCueSession,
});
