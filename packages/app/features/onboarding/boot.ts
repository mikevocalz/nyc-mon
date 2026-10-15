'use client';

import type { Href } from 'expo-router';
import { readBootSave } from '@acme/core/save';
import { assertNever, type BootRoute, type BootSnapshot, resolveBootRoute } from '@acme/core/sim';
import { readAgeAnswer, readSessionFlag, SAVE_KEY } from './onboarding.store';
import { saveStorage } from './storage';
import { MEET_PATH, MON_HOME_PATH } from '../egg/egg-model.ts';

/**
 * M02 ships with canon-safe art: the real egg captures are still pending
 * (TODO(canon), B4 in the M02 handoff), so panel 2 draws unmarked egg
 * silhouettes — Q11's only approved look is "no colours or markings" — and
 * the captures swap in later without a layout change.
 */
export const WELCOME_ROUTE_ENABLED = true;

/**
 * Where a signed-in Caller lands: the `(home)` group index, which picks M11,
 * M13, M09 or the boot route itself. The starter's `/home` grid was struck
 * from the app (Phase 1 integration).
 */
export const APP_HOME_PATH = MON_HOME_PATH;

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
 * whose screens are still unbuilt (M22) fall back to the nearest shipped
 * route, marked per case. M08 (`/(onboarding)/meet`), M09 (`/(home)/name`)
 * and M11/M13 (`/(home)`) point at their D-16 routes.
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
          // M08 egg choice (D-16a).
          return MEET_PATH;
        case 'mon-name':
          // M09 naming after the hatch (D-16f): a hatched Mon with no nickname resumes here.
          return '/(home)/name';
        default:
          return assertNever(route.step);
      }
    case 'incubating':
    case 'egg-ready':
    case 'companion':
      // M11 (egg) and M13 (Mon) both render at the `(home)` group index.
      return MON_HOME_PATH;
    case 'consent-denied':
      return '/(auth)/consent?state=denied';
    case 'save-recovered':
      // M22 is not built. `(home)` finds neither egg nor Mon in an unreadable
      // save and shows the generic error screen (HomeIndexScreen) without
      // writing, so the broken save is still there for M22 to recover.
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
