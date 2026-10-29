import { AudioContext } from 'react-native-audio-api';
import { soundEnabled } from '../device-preferences.ts';
import { createCareCuePlayer, type CareCue, type CueContext } from './care-cues-core.ts';
import { holdAmbientSession } from './session.native.ts';

/**
 * Native: the care cues on react-native-audio-api, which mirrors Web Audio.
 * One context, made on the first cue and kept. Each cue takes the shared
 * ambient-session lease (session.native.ts) before the context exists, so
 * the Ring/Silent switch silences even the first cue. A context left
 * suspended by an interruption (a phone call) is resumed before the cue.
 */
let context: AudioContext | null = null;

function nativeContext(): CueContext | null {
  context ??= new AudioContext();
  return context;
}

/** Plays one care cue. A no-op when Sound is off or audio can't start. */
export const playCareCue: (cue: CareCue) => void = createCareCuePlayer({
  enabled: soundEnabled,
  holdSession: holdAmbientSession,
  context: nativeContext,
});
