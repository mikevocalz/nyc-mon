export { amplitudeEnvelope, sampleAmplitude, type AmplitudeTrack } from './amplitude.ts';
export {
  parseSpeechCue,
  pickSpeechTrack,
  sampleSpeechTrack,
  SPEECH_CONTEXT_KEY,
  utteranceTimeMs,
  type FaceTrack,
  type MonSpeechCue,
  type SampleSpeechOptions,
  type SpeechSources,
  type SpeechTrack,
} from './cue.ts';
export { ARKIT_INPUTS, arkitKey, arkitToRig, EXPRESSION_CHANNELS, mouthToRig, SPEECH_CHANNELS, type RigTargets } from './retarget.ts';
export { damp } from './smoothing.ts';
export {
  buildVisemeTimeline,
  charViseme,
  sampleVisemes,
  VISEME_SHAPES,
  type CharacterAlignment,
  type MouthShape,
  type SampleVisemeOptions,
  type Viseme,
  type VisemeKey,
} from './visemes.ts';
