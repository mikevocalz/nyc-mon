/**
 * The waitlist's under-13 hold (docs/design/site/WAITLIST_AGE_SCREEN.md).
 * After admin-vite answers `under13`, the server action sets this cookie so a
 * reload or a second try with another year gets the same answer for a while.
 * Value `1`, httpOnly, SameSite=Lax; it holds no email, no year, no IP.
 * Kept out of `actions.ts` because a 'use server' module may export only
 * async functions.
 */
export const WAITLIST_AGE_HOLD_COOKIE = 'nycmon_waitlist_hold';

/** How long the hold lasts: one hour, the same window as the per-IP rate limit. */
export const WAITLIST_AGE_HOLD_SECONDS = 60 * 60;
