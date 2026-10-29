'use client';

import type { CarePlanInput } from './care-notification-plan.ts';

/**
 * PLATFORM FORK (web / SSR): local notifications exist on the phone only
 * (ADR 0001). The native fork schedules care calls.
 */
export function syncCareNotifications(_input: Omit<CarePlanInput, 'enabled'>): Promise<void> {
  return Promise.resolve();
}

export function cancelAllCareNotifications(): Promise<void> {
  return Promise.resolve();
}
