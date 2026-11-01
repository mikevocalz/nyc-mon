import type { MonSpeechCue } from '@acme/ui/three/mon/lipsync';

/**
 * Speech cues from the voice player (speech.ts) to whichever Mon view is
 * mounted (AppView), without threading a callback through App. One start
 * cue when the audio begins, one stop cue when it ends or is cut off.
 */
const listeners = new Set<(cue: MonSpeechCue) => void>();

type StartCue = Extract<MonSpeechCue, { kind: 'start' }>;
/** The utterance playing now and when (performance.now) its latest start cue went out. */
let playing: { readonly cue: StartCue; readonly at: number } | null = null;
let listening = false;

/** The microphone's state as the last listen cue gave it, for a view that mounts while it is open. */
export function listeningNow(): boolean {
  return listening;
}

export function emitSpeechCue(cue: MonSpeechCue, now: number = performance.now()): void {
  if (cue.kind === 'start') playing = { cue, at: now };
  else if (cue.kind === 'listen') listening = cue.on;
  else if (playing?.cue.id === cue.id) playing = null;
  for (const l of [...listeners]) l(cue);
}

/**
 * The start cue for the utterance playing now, re-stamped to where its audio
 * is at `now`, or null when nothing plays. A view that mounts mid-sentence
 * (a care tool's result replacing the card while the Mon talks) missed that
 * sentence's start cue; AppView sends it this one once the view is ready, so
 * the Mon faces the viewer and lip-syncs from the right point.
 */
export function currentSpeechCue(now: number = performance.now()): StartCue | null {
  if (!playing) return null;
  const elapsedMs = playing.cue.elapsedMs + (now - playing.at);
  if (elapsedMs >= playing.cue.durationMs) return null;
  return { ...playing.cue, elapsedMs };
}

/** Subscribes to cues; the returned function unsubscribes and is safe to call twice. */
export function addSpeechCueListener(listener: (cue: MonSpeechCue) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
