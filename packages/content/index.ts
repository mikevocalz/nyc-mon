export * from './mons/index.ts';
export { eggs } from './eggs.ts';
export type { StarterEgg } from './eggs.ts';
export { resolveVoice, voicePitchFactor, voicePools, webSpeechPitch } from './voices.ts';
export type { LineageVoice, LineVoicePools } from './voices.ts';
export {
  captionText,
  spokenText,
  ELEVENLABS_TTS_MODEL,
  MAX_SPOKEN_TEXT,
  monSpeechRequest,
  monVoiceRef,
  planMonUtterance,
  readMonVoiceRef,
} from './mon-voice.ts';
export type { MonSpeechRequest, MonUtterance, MonVoicePlan, MonVoicePort, MonVoiceRef } from './mon-voice.ts';
