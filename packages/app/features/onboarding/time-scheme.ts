'use client';

/**
 * The time-of-day adapter the H-Lynk chrome reads (DIRECTION.md §3.2, D8):
 * the shell's `scheme` follows the device clock while onboarding pages
 * follow the OS appearance.
 *
 * `night` runs 19:00–07:00 local. The exact hours are a platform default —
 * the canon decisions name daylit/night but not the boundary, so it lives in
 * this one function until ruled.
 */
export type ShellScheme = 'daylit' | 'night';

const DAY_START_HOUR = 7;
const NIGHT_START_HOUR = 19;

export function schemeForTime(nowMs: number): ShellScheme {
  const hour = new Date(nowMs).getHours();
  return hour >= DAY_START_HOUR && hour < NIGHT_START_HOUR ? 'daylit' : 'night';
}
