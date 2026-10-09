'use client';

/**
 * PLATFORM FORK (web / SSR): notifications are local on the phone only
 * (ADR 0001), so there is no response to route. The native fork routes the
 * hatch-ready tap to M12.
 */
export function useReadyNotificationRouting(): void {
  /* no-op on web */
}
