'use server';

import { cookies, headers } from 'next/headers';
import { joinWaitlist, toBirthYear, toWaitlistDistrict } from '../../../lib/waitlist.ts';
import type { WaitlistResult } from '../../../lib/waitlist.ts';
import { WAITLIST_AGE_HOLD_COOKIE, WAITLIST_AGE_HOLD_VALUE, waitlistHoldCookieOptions } from '../../../lib/waitlist-hold.ts';

/**
 * State for `useActionState(joinWaitlistAction, { status: 'idle', email: '' })`.
 * `email` echoes what was typed so the form can re-render it after an
 * `invalid`, `rate_limited` or `error` answer. After `joined` or `under13` it
 * is empty: a confirmed sign-up needs nothing re-shown, and an under-13
 * visitor's address is not kept even in page state (ADR 0001). The birth year
 * is never echoed: a retry starts from an empty field.
 */
export type WaitlistFormState = (WaitlistResult | { status: 'idle' }) & { email: string };

function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

/**
 * The visitor's IP: first hop of `X-Forwarded-For` (set by Vercel at the web
 * edge), else `X-Real-IP`. `joinWaitlist` vouches for it to admin-vite.
 */
function visitorIp(requestHeaders: Headers): string | undefined {
  const first = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (first !== undefined && first !== '') return first;
  const real = requestHeaders.get('x-real-ip')?.trim();
  return real === undefined || real === '' ? undefined : real;
}

/**
 * Server action behind the waitlist form (PS-001). Fields: `email`,
 * `birthYear` (the neutral age screen: four digits, no default), `district`,
 * `source` and the hidden honeypot `website`.
 *
 * Age screen (docs/design/site/WAITLIST_AGE_SCREEN.md): admin-vite decides
 * under-13 from the year and stores nothing. When it answers `under13`, this
 * action sets an httpOnly session cookie that carries no personal data and
 * ends when the browser closes; while it is present, a re-post (reload, back button, another year)
 * gets the same `under13` answer without the year or address being sent
 * anywhere. The form itself also stays in its result state.
 */
export async function joinWaitlistAction(_previous: WaitlistFormState, formData: FormData): Promise<WaitlistFormState> {
  const jar = await cookies();
  if (jar.get(WAITLIST_AGE_HOLD_COOKIE) !== undefined) return { status: 'under13', email: '' };

  const email = formString(formData, 'email');
  const source = formString(formData, 'source').trim();
  const result = await joinWaitlist({
    email,
    birthYear: toBirthYear(formData.get('birthYear')),
    district: toWaitlistDistrict(formString(formData, 'district')),
    source: source === '' ? undefined : source,
    website: formString(formData, 'website'),
    clientIp: visitorIp(await headers()),
  });
  if (result.status === 'under13') {
    jar.set(WAITLIST_AGE_HOLD_COOKIE, WAITLIST_AGE_HOLD_VALUE, waitlistHoldCookieOptions(process.env.NODE_ENV === 'production'));
  }
  const keepEmail = result.status === 'invalid' || result.status === 'rate_limited' || result.status === 'error';
  return { ...result, email: keepEmail ? email : '' };
}
