'use client';

/**
 * Polite announcements (M01/M07). On web the destination's h1 takes focus
 * after the route swap, which is the announcement; a direct aria-live
 * announcement needs a mounted live region, so this is a no-op here.
 */
export function announcePolitely(_message: string): void {
  /* no-op on web */
}
