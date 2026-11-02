import { soundEnabled } from '../device-preferences.ts';
import { createCareCuePlayer, type CareCue, type CueContext } from './care-cues-core.ts';
import { holdAmbientSession } from './session.ts';

/**
 * Web (and the platform resolution anchor): the care cues on the browser's
 * Web Audio, like the side-key chirp. The context is created on the first
 * cue. A context still suspended by autoplay rules (an attention call on a
 * page with no gesture yet) gets a short resume attempt and the cue is
 * dropped if it stays suspended; the LED, text and haptic carry it.
 * Browsers have no ring/silent switch, so the session hold is a no-op here.
 */
let context: AudioContext | null = null;

function webContext(): CueContext | null {
  if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') return null;
  context ??= new window.AudioContext();
  return context;
}

/** Plays one care cue. A no-op when Sound is off or Web Audio is missing. */
export const playCareCue: (cue: CareCue) => void = createCareCuePlayer({
  enabled: soundEnabled,
  holdSession: holdAmbientSession,
  context: webContext,
});
