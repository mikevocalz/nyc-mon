'use client';

import type { Href } from 'expo-router';
import { readBootSave } from '@acme/core/save';
import { assertNever, type BootRoute, type BootSnapshot, resolveBootRoute } from '@acme/core/sim';
import { readAgeAnswer, readSessionFlag, SAVE_KEY } from './onboarding.store';
import { saveStorage } from './storage';

/**
 * M02 ships with canon-safe art: the real egg captures are still pending
 * (TODO(canon), B4 in the M02 handoff), so panel 2 draws unmarked egg
 * silhouettes — Q11's only approved look is "no colours or markings" — and
 * the captures swap in later without a layout change.
 */
export const WELCOME_ROUTE_ENABLED = true;

/** The app's shell destination while the M-screens it would deepen to (M08+) don't exist yet. */
export const APP_HOME_PATH = '/home' as const;

/** Everything {@linkcode resolveBootRoute} needs, read from local storage only (M01 § Data). */
export function buildBootSnapshot(nowMs: number): BootSnapshot {
  return {
    save: readBootSave(saveStorage.getString(SAVE_KEY)),
    hasSession: readSessionFlag(),
    ageAnswer: readAgeAnswer(),
    nowMs,
  };
}

/**
 * Maps a {@linkcode BootRoute} to an expo-router href. Exhaustive: a new
 * `BootRoute` kind fails typecheck here (M01 "Tests to write"). Destinations
 * whose screens are still blocked or unbuilt (M02, M05, M08, M11, M13, M22)
 * fall back to the nearest shipped route, marked per case.
 */
export function bootPath(route: BootRoute): Href {
  switch (route.kind) {
    case 'first-run':
      return WELCOME_ROUTE_ENABLED ? '/(onboarding)/welcome' : '/(auth)/age';
    case 'restore':
      // The server-restore pass (`GET /v1/me/mons` + profile) is Phase 3; a
      // session on a fresh install lands on sign-in until it exists.
      return '/(auth)/sign-in?intent=sign-in';
    case 'resume-onboarding':
      switch (route.step) {
        case 'create-account':
          return '/(auth)/sign-in?intent=create';
        case 'guardian-consent':
          return '/(auth)/consent';
        case 'caller-name':
          return '/(onboarding)/caller';
        case 'egg-choice':
          // M08 is not built; the drawer home is the app shell until it is.
          return APP_HOME_PATH;
        default:
          return assertNever(route.step);
      }
    case 'incubating':
    case 'egg-ready':
      // M11 is not built; landing on the app shell keeps the sim running.
      return APP_HOME_PATH;
    case 'companion':
      // M13 is not built.
      return APP_HOME_PATH;
    case 'consent-denied':
      return '/(auth)/consent?state=denied';
    case 'save-recovered':
      // M22 is not built; the app shell surfaces a broken save the same way.
      return APP_HOME_PATH;
    default:
      return assertNever(route);
  }
}

/** Convenience for the M01 route: snapshot → route → path, all synchronous. */
export function resolveBootPath(nowMs: number): { route: BootRoute; path: Href } {
  const route = resolveBootRoute(buildBootSnapshot(nowMs));
  return { route, path: bootPath(route) };
}
