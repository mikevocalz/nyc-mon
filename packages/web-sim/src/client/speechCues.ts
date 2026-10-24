import type { MonSpeechCue } from '@acme/ui/three/mon/lipsync';

/**
 * Speech cues from the voice player (speech.ts) to whichever Mon view is
 * mounted (AppView), without threading a callback through App. One start
 * cue when the audio begins, one stop cue when it ends or is cut off.
 */
const listeners = new Set<(cue: MonSpeechCue) => void>();

export function emitSpeechCue(cue: MonSpeechCue): void {
  for (const l of [...listeners]) l(cue);
}

/** Subscribes to cues; the returned function unsubscribes and is safe to call twice. */
export function addSpeechCueListener(listener: (cue: MonSpeechCue) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
