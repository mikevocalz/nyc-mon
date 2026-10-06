import type { District } from '../backgrounds/city-blocks-model.ts';

/** Shared pure logic for the progress family. No React, so node:test can run it. */

/** `value / max`, clamped to 0..1. Non-finite input and max <= 0 read as 0. */
export function progressFraction(value: number | undefined, max = 100): number {
  if (value === undefined || !Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.min(1, Math.max(0, value / max));
}

/** No value, or an explicit flag, means the work has no known end yet. */
export function isIndeterminate(value: number | undefined, indeterminate?: boolean): boolean {
  return indeterminate === true || value === undefined || !Number.isFinite(value);
}

export interface ProgressA11yInput {
  value?: number;
  max?: number;
  indeterminate?: boolean;
  /** What is loading, e.g. "Uploading photos". */
  label?: string;
  /** Overrides the spoken value, e.g. "3 of 8 stops". */
  valueText?: string;
  /**
   * 'progressbar' (default) for something that will finish; 'meter' for a
   * level read off a scale (care meters, bond) — G18.
   */
  role?: 'progressbar' | 'meter';
}

/**
 * Accessibility props for a progress root. React Native and react-native-web
 * both read the ARIA prop names. Indeterminate progress drops aria-valuenow,
 * which is how screen readers know there is no value to announce, and sets
 * aria-busy.
 */
export function progressA11y({ value, max = 100, indeterminate, label, valueText, role = 'progressbar' }: ProgressA11yInput) {
  const busy = isIndeterminate(value, indeterminate);
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const now = busy ? undefined : Math.round(progressFraction(value, safeMax) * safeMax * 100) / 100;
  return {
    role,
    'aria-label': label,
    'aria-valuemin': 0,
    'aria-valuemax': safeMax,
    'aria-valuenow': now,
    'aria-valuetext': valueText ?? (busy ? 'Loading' : `${Math.round(progressFraction(value, safeMax) * 100)}%`),
    'aria-busy': busy,
  };
}

/** Whole percent for a visible label. */
export function percentLabel(fraction: number): string {
  return `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%`;
}

/**
 * How many of `count` discrete pieces (segments, arrows, windows) are lit.
 * Any progress above zero lights at least one, so a started task never looks
 * untouched, and the last piece only lights at 100%, so a nearly done task
 * never looks done.
 */
export function litCount(fraction: number, count: number): number {
  if (count <= 0 || fraction <= 0) return 0;
  if (fraction >= 1) return count;
  return Math.min(count - 1, Math.max(1, Math.floor(fraction * count)));
}

/**
 * Fill of each of `count` blocks built left to right: full blocks, then one
 * partial block, then empty lots.
 */
export function blockFills(fraction: number, count: number): number[] {
  const f = Math.min(1, Math.max(0, fraction)) * count;
  return Array.from({ length: Math.max(0, count) }, (_, i) => Math.min(1, Math.max(0, f - i)));
}

/** Round a 0..1 fill down to whole floors, so windows light a floor at a time. */
export function quantize(fraction: number, steps: number): number {
  if (steps <= 0) return fraction;
  return Math.floor(Math.min(1, Math.max(0, fraction)) * steps + 1e-9) / steps;
}

/** mulberry32: small, fast, deterministic. Same seed, same skyline. */
function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Building heights for a skyline of `count` lots, each 0..1 of the bar
 * height, shaped like the district:
 * - downtown: tall and ragged, with the odd supertall at full height;
 * - midtown: mid-rise Deco masses with a few tall crowns;
 * - harlem: a low, even brownstone row broken by a tall project slab;
 * - megacity: uniformly massive.
 */
export function skylineHeights(count: number, district: District = 'midtown', seed = 1): number[] {
  const r = rng(seed * 7919 + count);
  return Array.from({ length: Math.max(0, count) }, () => {
    const x = r();
    switch (district) {
      case 'downtown':
        return x > 0.82 ? 1 : 0.45 + r() * 0.45;
      case 'harlem':
        return x > 0.85 ? 0.8 + r() * 0.15 : 0.32 + r() * 0.14;
      case 'megacity':
        return 0.72 + x * 0.28;
      default:
        return x > 0.8 ? 0.85 + r() * 0.15 : 0.4 + r() * 0.35;
    }
  });
}

/** Resolve a size preset or a pixel number. */
export function resolveSize<K extends string>(size: K | number | undefined, presets: Record<K, number>, fallback: K): number {
  if (typeof size === 'number' && Number.isFinite(size) && size > 0) return size;
  return presets[(size as K | undefined) ?? fallback] ?? presets[fallback];
}

/** Evenly spaced angles in degrees, starting at 12 o'clock and going clockwise. */
export function ringAngles(count: number): number[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => (360 / count) * i);
}

/** Clamp an integer prop into its documented range. */
export function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}
