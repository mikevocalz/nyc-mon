'use server';

import { headers } from 'next/headers';
import { joinWaitlist, toWaitlistDistrict } from '../../../lib/waitlist.ts';
import type { WaitlistResult } from '../../../lib/waitlist.ts';

/**
 * State for `useActionState(joinWaitlistAction, { status: 'idle', email: '' })`.
 * `email` echoes what was typed so the form can re-render it after an
 * `invalid`, `rate_limited` or `error` answer. After `joined` or `under13` it
 * is empty: a confirmed sign-up needs nothing re-shown, and an under-13
 * visitor's address is not kept even in page state (ADR 0001).
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
 * `ageConfirmed` (checkbox, checked = 13 or older), `district`, `source` and
 * the hidden honeypot `website`.
 */
export async function joinWaitlistAction(_previous: WaitlistFormState, formData: FormData): Promise<WaitlistFormState> {
  const email = formString(formData, 'email');
  const source = formString(formData, 'source').trim();
  const result = await joinWaitlist({
    email,
    ageConfirmed: formData.get('ageConfirmed') !== null,
    district: toWaitlistDistrict(formString(formData, 'district')),
    source: source === '' ? undefined : source,
    website: formString(formData, 'website'),
    clientIp: visitorIp(await headers()),
  });
  const keepEmail = result.status === 'invalid' || result.status === 'rate_limited' || result.status === 'error';
  return { ...result, email: keepEmail ? email : '' };
}
