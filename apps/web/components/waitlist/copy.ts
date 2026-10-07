import type { WaitlistStatus } from '../../lib/waitlist.ts';

/**
 * Every string the waitlist form shows, on `/` and on `/get` (PS-001, PS-023).
 * Voice "ui": warm, plain and honest about scope. No counts, no countdown, no
 * scarcity. The button says `Join the waitlist` in every state but pending
 * (PS-003: no synonyms for the one CTA).
 */
export const WAITLIST_COPY = {
  /** The home page's closing section; `/get` keeps its own hero above the same form. */
  section: {
    eyebrow: 'The waitlist',
    title: 'Get on the list before the first hatch.',
    body: "NYC-MON is coming to iOS and Android. Leave your email and you'll hear the day it's out.",
  },
  form: {
    /** Accessible name of the `<form>`. */
    name: 'Join the waitlist',
    emailLabel: 'Email',
    ageLegend: 'Age',
    ageLabel: "I'm 13 or older",
    ageHint: 'Younger than 13? A parent or guardian can join with their own email and follow along.',
    submit: 'Join the waitlist',
    pending: 'Joining…',
    privacy: "One email when the app is out, and no ads. Under-13s can't sign up.",
    privacyLink: 'Privacy',
    privacyHref: '/legal/privacy',
    /** The honeypot's label; the field is hidden from people and from assistive technology. */
    honeypotLabel: 'Leave this field empty',
  },
} as const;

/** How a result reads: `success` replaces the form, the others sit under it. */
export type WaitlistTone = 'success' | 'notice' | 'error';

export interface WaitlistMessage {
  tone: WaitlistTone;
  /** Shown as a heading only for `success`, which takes focus. */
  title?: string;
  body: string;
  /** The message is the email field's error, linked by `aria-describedby`, not a live-region update. */
  field?: 'email';
}

/**
 * The copy for a form state. `idle` has nothing to say. Every other answer of
 * the server action maps to one message; the mapping is exhaustive over
 * `WaitlistStatus`, so a new status fails the typecheck here first.
 */
export function waitlistMessage(state: { status: WaitlistStatus | 'idle'; field?: 'email' }): WaitlistMessage | null {
  switch (state.status) {
    case 'idle':
      return null;
    case 'joined':
      return {
        tone: 'success',
        title: "You're on the list.",
        body: "We'll send one email when NYC-MON is out. Signed up before? Nothing changes, and you'll still get just the one.",
      };
    case 'under13':
      return {
        tone: 'notice',
        body: "Nothing was saved. You need to be 13 or older to join. A parent or guardian can sign up with their own email and follow along with you.",
      };
    case 'invalid':
      return state.field === 'email'
        ? { tone: 'error', field: 'email', body: 'Check the email address. It should look like name@example.com.' }
        : { tone: 'error', field: 'email', body: "The form didn't come through. Check your email and try again." };
    case 'rate_limited':
      return {
        tone: 'error',
        body: 'Too many tries from this connection. Try again in an hour. Your email is still in the box.',
      };
    case 'error':
      return {
        tone: 'error',
        body: "We couldn't reach the waitlist just now. Nothing you typed is lost, so try again in a moment.",
      };
  }
}

/** States in which the visitor's entries are shown again (the action echoes the email for these). */
export function keepsEntries(status: WaitlistStatus | 'idle'): boolean {
  return status === 'invalid' || status === 'rate_limited' || status === 'error';
}
