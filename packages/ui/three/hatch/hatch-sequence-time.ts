import { BEATS, HATCH_SECONDS, REDUCED_SECONDS } from '../mon/hatch-timeline.ts';

/** M12's presentation phases (the hatch state machine's, `HATCH_PRESENTATION_PHASES`); the kit does not import core. */
export type SequencePhase = 'stir' | 'pressure' | 'crack' | 'burst' | 'emerge' | 'attention';

/**
 * Where each M12 phase sits on the Alexa hatch timeline (hatch-timeline.ts),
 * in timeline seconds. M12 keeps its own phase lengths and persists each
 * phase end (resume starts the saved phase over), so every phase plays its
 * window of the one choreography at the screen's pace:
 *
 *   stir      the stage dims, the first shake and crack
 *   pressure  the second shake and crack
 *   crack     the third shake, then the tension: light through the cracks, sparkles in, orbits
 *   burst     the white-out throws the shards; the Baby arrives under the white
 *   emerge    the white clears, the silhouette pulses, the colour resolves
 *   attention the moment is over: the Baby, settled
 *
 * Reduced motion has no shakes, cracks or white-out: the egg holds still
 * until `burst`, which plays the 0.6 s cross-fade; after it the Baby holds.
 */
export function sequenceSpan(phase: SequencePhase, reducedMotion: boolean): readonly [number, number] {
  if (reducedMotion) {
    switch (phase) {
      case 'stir':
      case 'pressure':
      case 'crack':
        return [0, 0];
      case 'burst':
        return [0, REDUCED_SECONDS];
      case 'emerge':
      case 'attention':
        return [REDUCED_SECONDS, REDUCED_SECONDS];
    }
  }
  switch (phase) {
    case 'stir':
      return [0, BEATS.shake2[0]];
    case 'pressure':
      return [BEATS.shake2[0], BEATS.shake3[0]];
    case 'crack':
      return [BEATS.shake3[0], BEATS.tension[1]];
    case 'burst':
      return [BEATS.whiteout[0], BEATS.whiteFade[0]];
    case 'emerge':
      return [BEATS.whiteFade[0], HATCH_SECONDS];
    case 'attention':
      return [HATCH_SECONDS, HATCH_SECONDS];
  }
}

/** Timeline seconds `elapsedMs` into `phase` when the screen gives the phase `phaseMs`. Holds the window's end past it. */
export function sequenceTime(phase: SequencePhase, elapsedMs: number, phaseMs: number, reducedMotion: boolean): number {
  const [from, to] = sequenceSpan(phase, reducedMotion);
  const share = phaseMs <= 0 ? 1 : Math.min(1, Math.max(0, elapsedMs / phaseMs));
  return from + (to - from) * share;
}
