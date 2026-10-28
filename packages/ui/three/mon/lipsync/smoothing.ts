/**
 * Frame-rate independent exponential smoothing: moves `current` toward
 * `target` by `1 - exp(-rate * dtSeconds)`. Two 1/60 s steps land exactly
 * where one 1/30 s step does, so the mouth moves the same at 30 and 120 fps.
 * `rate` is per second; the time constant is `1 / rate`.
 */
export function damp(current: number, target: number, rate: number, dtSeconds: number): number {
  if (!(dtSeconds > 0)) return current;
  return current + (target - current) * (1 - Math.exp(-rate * dtSeconds));
}
