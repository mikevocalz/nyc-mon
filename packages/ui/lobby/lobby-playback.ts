// When a lobby artboard's render loop runs (review finding M15; directive §3
// "never let the lobby keep a full-speed render loop alive during gameplay").
// Pure, so node tests cover it; the native surface applies the answer through
// `RiveViewRef.pause()` / `play()` (@rive-app/react-native 0.5.2,
// lib/typescript/src/specs/RiveView.nitro.d.ts).

/** The React Native AppState values that matter here; anything but `active` stops the loop. */
export type AppActivity = 'active' | 'background' | 'inactive' | 'unknown' | 'extension';

/** True when the artboard should be playing: the host has not paused it and the app is in the foreground. */
export function shouldPlayArtboard(paused: boolean, activity: AppActivity | string): boolean {
  return !paused && activity === 'active';
}

/**
 * Whether the lobby's own artboards (rank panel, START) should be paused:
 * whenever the transition cover is up, because the cover hides them and the
 * game is building underneath.
 */
export function isLobbyCovered(phase: 'enter' | 'hold' | 'reveal' | 'done'): boolean {
  return phase !== 'done';
}
