/**
 * One press of "Keep it warm" (DeviceScreen.nudge): a V-pet wobble that reads
 * at arm's length on an iPad. `rocks` full swings (five side-to-side rocks)
 * on the egg's base over `seconds`, decaying from about 20 degrees (`tilt` is
 * the undecayed amplitude, rad), with a sideways `slide` of up to that share
 * of the egg's height following the rock, a `hop` (in half-heights) on the
 * first beat, and a glow pulse of `pulse` on the level, with the halo swelling
 * by `flare`, fading over `pulseSeconds`.
 */
export const NUDGE = {
  seconds: 0.7, tilt: 0.42, rocks: 2.5, slide: 0.05, hop: 0.14, hopSeconds: 0.16, pulse: 1.6, flare: 0.35, pulseSeconds: 0.8,
} as const;

/** The wobble's tilt, rad, `age` s after a press: decaying rocks, zero outside the wobble. */
export function nudgeRock(age: number): number {
  if (!(age >= 0 && age < NUDGE.seconds)) return 0;
  const p = age / NUDGE.seconds;
  return NUDGE.tilt * (1 - p) ** 1.5 * Math.sin(2 * Math.PI * NUDGE.rocks * p);
}

/** The sideways slide with the rock, as a share of the egg's height (positive is toward the tilt's low side). */
export function nudgeSlide(age: number): number {
  return (NUDGE.slide * nudgeRock(age)) / NUDGE.tilt;
}

/** The first beat's hop, in half-heights. */
export function nudgeHop(age: number): number {
  if (!(age >= 0 && age < NUDGE.hopSeconds)) return 0;
  return NUDGE.hop * Math.sin((Math.PI * age) / NUDGE.hopSeconds);
}

/** The glow pulse, 1 at the press fading to 0. */
export function nudgePulse(age: number): number {
  if (!(age >= 0 && age < NUDGE.pulseSeconds)) return 0;
  return 1 - age / NUDGE.pulseSeconds;
}
/** Glow tints by slot when a model names none: hud tokens. */
