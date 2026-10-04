'use client';

import type { ScheduleStorage } from './schedule-storage.types';

/**
 * Web/SSR storage. The native resolver swaps this module for
 * schedule-storage.native.ts and MMKV.
 */
export const scheduleStorage: ScheduleStorage = {
  getString: (key) => globalThis.localStorage?.getItem(key) ?? undefined,
  set: (key, value) => globalThis.localStorage?.setItem(key, value),
  remove: (key) => globalThis.localStorage?.removeItem(key),
};
