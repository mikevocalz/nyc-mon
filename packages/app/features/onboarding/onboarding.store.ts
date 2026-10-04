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
} as const;

export const SAVE_KEY = 'save';

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

interface OnboardingState {
  /** The stored M04 answer, loaded by {@linkcode hydrateOnboarding}. */
  ageAnswer: AgeAnswer | undefined;
  /** Local session flag, same source as {@linkcode readSessionFlag}. */
  hasSession: boolean;
  /** Writes the M04 answer to MMKV and state (M04 Continue). */
  setAgeAnswer: (birthYear: number, nowMs: number) => void;
  /** Writes the local session flag (sign-in success / sign-out). */
  setSession: (present: boolean) => void;
}

/**
 * The onboarding slice (ADR 0001): the M04 answer and the session flag live
 * in MMKV and are the only state the M01–M07 routes need before the save's
 * own caller record exists.
 */
export const useOnboarding = create<OnboardingState>()((set) => ({
  ageAnswer: undefined,
  hasSession: false,
  setAgeAnswer: (birthYear, nowMs) => {
    const answer: AgeAnswer = { birthYear, answeredAtMs: nowMs };
    onboardingStorage.set(ONBOARDING_KEYS.ageAnswer, JSON.stringify(answer));
    set({ ageAnswer: answer });
  },
  setSession: (present) => {
    if (present) onboardingStorage.set(ONBOARDING_KEYS.hasSession, '1');
    else onboardingStorage.remove(ONBOARDING_KEYS.hasSession);
    set({ hasSession: present });
  },
}));

/** Loads the persisted onboarding state once at app start (root layout or first screen). */
export function hydrateOnboarding(): void {
  useOnboarding.setState({ ageAnswer: readAgeAnswer(), hasSession: readSessionFlag() });
}
