import assert from 'node:assert/strict';
import test from 'node:test';
import * as hold from './waitlist-hold.ts';
import { WAITLIST_AGE_HOLD_COOKIE, WAITLIST_AGE_HOLD_VALUE, waitlistHoldCookieOptions } from './waitlist-hold.ts';

test('the hold is a session cookie: no maxAge and no expires in either environment', () => {
  for (const isProduction of [true, false]) {
    const options: object = waitlistHoldCookieOptions(isProduction);
    assert.equal('maxAge' in options, false, `maxAge set (production=${isProduction})`);
    assert.equal('expires' in options, false, `expires set (production=${isProduction})`);
  }
});

test('the module no longer exports a hold lifetime', () => {
  assert.equal('WAITLIST_AGE_HOLD_SECONDS' in hold, false);
});

test('the hold cookie is httpOnly, SameSite=Lax and site-wide', () => {
  const options = waitlistHoldCookieOptions(true);
  assert.deepEqual(options, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
});

test('secure follows the deploy so the hold works on http://localhost', () => {
  assert.equal(waitlistHoldCookieOptions(true).secure, true);
  assert.equal(waitlistHoldCookieOptions(false).secure, false);
});

test('the cookie carries a fixed marker, never visitor data', () => {
  assert.equal(WAITLIST_AGE_HOLD_COOKIE, 'nycmon_waitlist_hold');
  assert.equal(WAITLIST_AGE_HOLD_VALUE, '1');
});
