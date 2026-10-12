import assert from 'node:assert/strict';
import test from 'node:test';
import type { WaitlistStatus } from '../../lib/waitlist.ts';
import { birthYearError, keepsEntries, waitlistMessage, WAITLIST_COPY } from './copy.ts';

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
  const message = waitlistMessage({ status: 'under13' });
  assert.match(message?.body ?? '', /nothing you typed was saved/);
  assert.match(message?.body ?? '', /parent or guardian can join with their own email/);
  assert.equal(message?.link?.href, '/legal/childrens-privacy');
});

test('under13 does not coach: no age, no threshold, no retry', () => {
  const message = waitlistMessage({ status: 'under13' });
  const text = `${message?.body ?? ''} ${message?.link?.label ?? ''}`;
  assert.doesNotMatch(text, /\d/);
  assert.doesNotMatch(text, /\b(try again|another year|older|old enough|check|change|age)\b/i);
});

test('the age screen is neutral before it is answered: nothing names an age or the line', () => {
  const beforeAnswer = Object.values(WAITLIST_COPY.form).join('\n');
  assert.doesNotMatch(beforeAnswer, /\b13\b|thirteen|older|younger|under-?\s?1|old enough|confirm/i);
  assert.doesNotMatch(beforeAnswer, /\b(19|20)\d\d\b(?<!1900)/);
});

test('birthYearError checks the shape only, with M04 wording', () => {
  const now = 2026;
  assert.equal(birthYearError('', now), WAITLIST_COPY.form.birthYearMissing);
  assert.equal(birthYearError('   ', now), WAITLIST_COPY.form.birthYearMissing);
  assert.equal(birthYearError('199', now), WAITLIST_COPY.form.birthYearIncomplete);
  assert.equal(birthYearError('19a0', now), WAITLIST_COPY.form.birthYearIncomplete);
  assert.equal(birthYearError('2027', now), WAITLIST_COPY.form.birthYearFuture);
  assert.equal(birthYearError('1899', now), WAITLIST_COPY.form.birthYearTooEarly);
  // Every plausible year passes the browser check, under 13 or not: the server decides.
  for (const year of ['2026', '2020', '2013', '2012', '1990', '1900']) assert.equal(birthYearError(year, now), null, year);
});

test('invalid birthYear is tied to the year field and does not hint at accepted years', () => {
  const message = waitlistMessage({ status: 'invalid', field: 'birthYear' });
  assert.equal(message?.field, 'birthYear');
  assert.doesNotMatch(message?.body ?? '', /\b(19|20)\d\d\b|13|older/);
});

test('rate_limited names the wait; error keeps the email and asks for the year again', () => {
  assert.match(waitlistMessage({ status: 'rate_limited' })?.body ?? '', /an hour/);
  const error = waitlistMessage({ status: 'error' })?.body ?? '';
  assert.match(error, /email is still in the box/);
  assert.match(error, /birth year again/);
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
      return [m?.title ?? '', m?.body ?? '', m?.link?.label ?? ''];
    }),
  ].join('\n');
  assert.doesNotMatch(strings, /—/);
  assert.doesNotMatch(strings, /\b(only \d+|spots? left|hurry|limited|countdown)\b/i);
  assert.doesNotMatch(strings, /\bMon\b[^.]*\b(it|its|he|she|his|her)\b/);
});
