import { soundEnabled } from '../device-preferences.ts';
import type { ChirpContext } from '../three/hlynk/chirp-core.ts';
import { createCareCuePlayer, type CareCue } from './care-cues-core.ts';

/**
 * Web (and the platform resolution anchor): the care cues on the browser's
 * Web Audio, like the side-key chirp. The context is created on the first
 * cue and resumed each time; a cue that fires before any user gesture (an
 * attention call on a cold page) stays silent under autoplay rules, and the
 * LED, text and haptic carry it. Browsers have no ring/silent switch to
 * honour; the system mixer and the Sound switch decide.
 */
let context: AudioContext | null = null;

function webContext(): ChirpContext | null {
  if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') return null;
  context ??= new window.AudioContext();
  if (context.state === 'suspended') void context.resume().catch(() => {});
  return context as unknown as ChirpContext;
}

/** Plays one care cue. A no-op when Sound is off or Web Audio is missing. */
export const playCareCue: (cue: CareCue) => void = createCareCuePlayer({ enabled: soundEnabled, context: webContext });
