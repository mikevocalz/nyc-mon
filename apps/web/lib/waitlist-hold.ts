/**
 * The waitlist's under-13 hold (docs/design/site/WAITLIST_AGE_SCREEN.md).
 * After admin-vite answers `under13`, the server action sets this cookie so a
 * reload or a second try with another year gets the same answer until the
 * browser session ends. Value `1`, httpOnly, SameSite=Lax; it holds no email,
 * no year, no IP. Kept out of `actions.ts` because a 'use server' module may
 * export only async functions.
 *
 * A session cookie (no Max-Age, no Expires) by product decision, 2026-10-14:
 * a timed hold also blocked a parent on the same shared browser for its whole
 * lifetime, and a fixed hour had no basis beyond matching the rate-limit
 * window. Closing the browser clears it.
 */
export const WAITLIST_AGE_HOLD_COOKIE = 'nycmon_waitlist_hold';

/** The cookie's value. It means "held" and nothing else. */
export const WAITLIST_AGE_HOLD_VALUE = '1';

export interface WaitlistHoldCookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
}

/**
 * Options for `cookies().set(WAITLIST_AGE_HOLD_COOKIE, …)`. Deliberately
 * carries no `maxAge` or `expires`, so the browser drops the cookie when the
 * session ends. `secure` follows the deploy: production only, so the cookie
 * still works on http://localhost.
 */
export function waitlistHoldCookieOptions(isProduction: boolean): WaitlistHoldCookieOptions {
  return { httpOnly: true, secure: isProduction, sameSite: 'lax', path: '/' };
}
