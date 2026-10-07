import assert from 'node:assert/strict';
import test from 'node:test';
import type { WaitlistStatus } from '../../lib/waitlist.ts';
import { keepsEntries, waitlistMessage, WAITLIST_COPY } from './copy.ts';

// A Record, so a status added to WaitlistResult fails the typecheck until it is listed here.
const ALL: Record<WaitlistStatus, true> = { joined: true, under13: true, invalid: true, rate_limited: true, error: true };
const WAITLIST_STATUSES = Object.keys(ALL) as WaitlistStatus[];

test('idle says nothing', () => {
  assert.equal(waitlistMessage({ status: 'idle' }), null);
});

test('every server status has a message with a body', () => {
  for (const status of WAITLIST_STATUSES) {
    const message = waitlistMessage({ status });
    assert.ok(message, status);
    assert.ok(message.body.length > 0, status);
  }
});

test('joined is the only success, and the only one with a heading', () => {
  for (const status of WAITLIST_STATUSES) {
    const message = waitlistMessage({ status });
    assert.equal(message?.tone === 'success', status === 'joined', status);
    assert.equal(message?.title !== undefined, status === 'joined', status);
  }
});

test('joined covers a repeat sign-up without revealing it', () => {
  const message = waitlistMessage({ status: 'joined' });
  assert.match(message?.body ?? '', /Signed up before\?/);
});

test('invalid is tied to the email field and suggests a fix (WCAG 3.3.3)', () => {
  const withField = waitlistMessage({ status: 'invalid', field: 'email' });
  assert.equal(withField?.field, 'email');
  assert.match(withField?.body ?? '', /name@example\.com/);
  assert.equal(waitlistMessage({ status: 'invalid' })?.field, 'email');
});

test('under13 says nothing was saved and offers the guardian path', () => {
  const body = waitlistMessage({ status: 'under13' })?.body ?? '';
  assert.match(body, /Nothing was saved/);
  assert.match(body, /parent or guardian/);
});

test('rate_limited names the wait; error says nothing is lost', () => {
  assert.match(waitlistMessage({ status: 'rate_limited' })?.body ?? '', /an hour/);
  assert.match(waitlistMessage({ status: 'error' })?.body ?? '', /lost/);
});

test('entries come back only for the retryable states', () => {
  assert.deepEqual(
    [...WAITLIST_STATUSES, 'idle' as const].filter(keepsEntries),
    ['invalid', 'rate_limited', 'error'],
  );
});

test('the button keeps the one CTA string', () => {
  assert.equal(WAITLIST_COPY.form.submit, 'Join the waitlist');
});

test('no pronoun for a Mon, no em dash, no scarcity words', () => {
  const strings = [
    ...Object.values(WAITLIST_COPY.section),
    ...Object.values(WAITLIST_COPY.form),
    ...WAITLIST_STATUSES.flatMap((status) => {
      const m = waitlistMessage({ status });
      return [m?.title ?? '', m?.body ?? ''];
    }),
  ].join('\n');
  assert.doesNotMatch(strings, /—/);
  assert.doesNotMatch(strings, /\b(only \d+|spots? left|hurry|limited|countdown)\b/i);
  assert.doesNotMatch(strings, /\bMon\b[^.]*\b(it|its|he|she|his|her)\b/);
});
