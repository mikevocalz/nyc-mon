'use client';

import type { KeyValueStorage } from './storage.types';

/**
 * Web/SSR storage. The native resolver swaps this module for
 * storage.native.ts and MMKV (`nyc-mon` for onboarding keys, `nyc-mon-save`
 * for the single sim save value).
 */
export const onboardingStorage: KeyValueStorage = {
  getString: (key) => globalThis.localStorage?.getItem(key) ?? undefined,
  set: (key, value) => globalThis.localStorage?.setItem(key, value),
  remove: (key) => globalThis.localStorage?.removeItem(key),
};

export const saveStorage: KeyValueStorage = {
  getString: (key) => globalThis.localStorage?.getItem(`save:${key}`) ?? undefined,
  set: (key, value) => globalThis.localStorage?.setItem(`save:${key}`, value),
  remove: (key) => globalThis.localStorage?.removeItem(`save:${key}`),
};
