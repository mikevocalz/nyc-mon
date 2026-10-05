'use client';

/**
 * PLATFORM FORK (web / SSR): notifications are local on the phone only
 * (ADR 0001), so the M06 sheet is never shown on web. Every entry point
 * reports `unsupported` and declines to schedule.
 */

export type NotifyPermission = 'undetermined' | 'granted' | 'denied' | 'unsupported';

export function getNotifyPermission(): Promise<NotifyPermission> {
  return Promise.resolve('unsupported');
}

export function requestNotifyPermission(): Promise<NotifyPermission> {
  return Promise.resolve('unsupported');
}

/** One egg-ready notification (M23), fired at `incubationEndsAt`. */
export interface ReadyNotification {
  eggId: string;
  endsAtMs: number;
  title: string;
  body: string;
}

export function scheduleReadyNotification(_input: ReadyNotification): Promise<boolean> {
  return Promise.resolve(false);
}
