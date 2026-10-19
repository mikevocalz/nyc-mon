'use client';

import { create } from 'zustand';
import { AgeAnswerSchema } from '@acme/core/schemas';
import type { AgeAnswer } from '@acme/core/types';
import { onboardingStorage } from './storage';

/**
 * Storage keys (MMKV `nyc-mon`). `save` is the single sim save value, in
 * `nyc-mon-save`; the session flag is written by the sign-in flow so the
 * boot route can resolve without a network call (M01 never awaits one).
 */
export const ONBOARDING_KEYS = {
  ageAnswer: 'age-answer',
  hasSession: 'has-session',
  consentRequested: 'consent-requested',
  notifyOff: 'notify-off',
  permissionsPending: 'permissions-pending',
  permissionReview: 'permission-review',
} as const;

export const SAVE_KEY = 'save';

/**
 * First-run setup checkpoint. Only callers who actually start their first
 * incubation enter this flow, so existing installs never get re-onboarded.
 * Synchronous MMKV reads keep cold-start routing deterministic.
 */
export type PermissionReview = 'pending' | 'complete';

export function readPermissionReview(): PermissionReview | undefined {
  const raw = onboardingStorage.getString(ONBOARDING_KEYS.permissionReview);
  if (raw === 'pending' || raw === 'complete') return raw;
  return onboardingStorage.getString(ONBOARDING_KEYS.permissionsPending) === '1' ? 'pending' : undefined;
}

export function startPermissionReview(): void {
  if (readPermissionReview() !== 'complete') {
    onboardingStorage.set(ONBOARDING_KEYS.permissionReview, 'pending');
    onboardingStorage.remove(ONBOARDING_KEYS.permissionsPending);
    useOnboarding.setState({ permissionsPending: true });
  }
}

export function completePermissionReview(): void {
  onboardingStorage.set(ONBOARDING_KEYS.permissionReview, 'complete');
  onboardingStorage.remove(ONBOARDING_KEYS.permissionsPending);
  useOnboarding.setState({ permissionsPending: false });
}


/** Parses the stored M04 answer. A malformed value is treated as unanswered (Law 5 at the boundary). */
export function readAgeAnswer(): AgeAnswer | undefined {
  const raw = onboardingStorage.getString(ONBOARDING_KEYS.ageAnswer);
  if (raw === undefined) return undefined;
  try {
    const parsed = AgeAnswerSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/** True when a local session flag exists. Written on sign-in / sign-out; never read over the network. */
export function readSessionFlag(): boolean {
  return onboardingStorage.getString(ONBOARDING_KEYS.hasSession) === '1';
}

/** A newly-created egg still needs to show the final optional setup step. */
export function readPermissionsPending(): boolean {
  return readPermissionReview() === 'pending';
}

/**
 * True when M05 has sent a consent email. The caller record does not exist
 * yet at that point (M07 comes later), so the pending marker lives here and
 * is folded into the caller's `consentStatus` when M07 writes it.
 */
export function readConsentRequested(): boolean {
  return onboardingStorage.getString(ONBOARDING_KEYS.consentRequested) === '1';
}

/** Marks the consent email as sent (M05 send success). */
export function writeConsentRequested(): void {
  onboardingStorage.set(ONBOARDING_KEYS.consentRequested, '1');
}

/**
 * Why the "notifications are off" status shows on M11 / the inbox
 * (M06 `08-handoff.md` § States):
 * - `not-now` — the Caller declined before the OS prompt ran; the follow-up
 *   action re-asks (`m11.status.notify_off.action.ask` reopens M06).
 * - `denied` — the OS prompt said no (or Android's repeated-denial block);
 *   only Settings can change it (`action.settings`).
 * - `schedule-failed` — permission granted but the schedule call failed;
 *   same action as `not-now`.
 */
export type NotifyOffState = 'not-now' | 'denied' | 'schedule-failed';

const NOTIFY_OFF_STATES: readonly NotifyOffState[] = ['not-now', 'denied', 'schedule-failed'];

/** The stored notifications-off state. An unknown value reads as unset (Law 5 at the boundary). */
export function readNotifyOff(): NotifyOffState | undefined {
  const raw = onboardingStorage.getString(ONBOARDING_KEYS.notifyOff);
  return NOTIFY_OFF_STATES.find((state) => state === raw);
}

interface OnboardingState {
  /** The stored M04 answer, loaded by {@linkcode hydrateOnboarding}. */
  ageAnswer: AgeAnswer | undefined;
  /** Local session flag, same source as {@linkcode readSessionFlag}. */
  hasSession: boolean;
  /** The M06 outcome the M11 status row and the inbox read. `undefined` = notifications fine or never asked. */
  notifyOff: NotifyOffState | undefined;
  permissionsPending: boolean;
  /** Writes the M04 answer to MMKV and state (M04 Continue). */
  setAgeAnswer: (birthYear: number, nowMs: number) => void;
  /** Writes the local session flag (sign-in success / sign-out). */
  setSession: (present: boolean) => void;
  /** Records or clears the notifications-off state (M06 close paths). */
  setNotifyOff: (state: NotifyOffState | undefined) => void;
  setPermissionsPending: (pending: boolean) => void;
}

/**
 * The onboarding slice (ADR 0001): the M04 answer and the session flag live
 * in MMKV and are the only state the M01–M07 routes need before the save's
 * own caller record exists.
 */
export const useOnboarding = create<OnboardingState>()((set) => ({
  ageAnswer: undefined,
  hasSession: false,
  notifyOff: undefined,
  permissionsPending: false,
  setAgeAnswer: (birthYear, nowMs) => {
    const answer: AgeAnswer = { birthYear, answeredAtMs: nowMs };
    onboardingStorage.set(ONBOARDING_KEYS.ageAnswer, JSON.stringify(answer));
    set({ ageAnswer: answer });
  },
  setSession: (present) => {
    if (present) onboardingStorage.set(ONBOARDING_KEYS.hasSession, '1');
    else {
      onboardingStorage.remove(ONBOARDING_KEYS.hasSession);
      onboardingStorage.remove(ONBOARDING_KEYS.permissionsPending);
      onboardingStorage.remove(ONBOARDING_KEYS.permissionReview);
    }
    set({ hasSession: present, ...(!present ? { permissionsPending: false } : {}) });
  },
  setNotifyOff: (state) => {
    if (state === undefined) onboardingStorage.remove(ONBOARDING_KEYS.notifyOff);
    else onboardingStorage.set(ONBOARDING_KEYS.notifyOff, state);
    set({ notifyOff: state });
  },
  setPermissionsPending: (pending) => {
    if (pending) startPermissionReview();
    else completePermissionReview();
  },
}));

/** Loads the persisted onboarding state once at app start (root layout or first screen). */
export function hydrateOnboarding(): void {
  useOnboarding.setState({
    ageAnswer: readAgeAnswer(),
    hasSession: readSessionFlag(),
    notifyOff: readNotifyOff(),
    permissionsPending: readPermissionsPending(),
  });
}
