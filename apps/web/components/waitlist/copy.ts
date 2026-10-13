import type { WaitlistField, WaitlistStatus } from '../../lib/waitlist.ts';

/**
 * Every string the waitlist form shows, on `/` and on `/get` (PS-001, PS-023).
 * Voice "ui": warm, plain and honest about scope. No counts, no countdown, no
 * scarcity. The button says `Join the waitlist` in every state but pending
 * (PS-003: no synonyms for the one CTA).
 *
 * Age screen (docs/design/site/WAITLIST_AGE_SCREEN.md, ADR 0001): the form
 * asks for a birth year with no default, and nothing shown before the answer
 * names an age, a threshold or which years are accepted. Field errors only
 * cover the year's shape (four digits, 1900 to this year), the same rules as
 * the app's M04 gate (`m04.error.*`).
 */
export const WAITLIST_COPY = {
  /** The home page's closing section; `/get` keeps its own hero above the same form. */
  section: {
    title: 'Get on the list before the first hatch.',
    body: "NYC-MON is coming to iOS and Android. Leave your email and you'll hear the day it's out.",
  },
  form: {
    /** Accessible name of the `<form>`. */
    name: 'Join the waitlist',
    emailLabel: 'Email',
    /** Mirrors the app's M04 field (`m04.field.label`, `m04.field.hint`, `m04.why`). */
    birthYearLabel: 'Birth year',
    birthYearHint: 'We ask everyone. Four digits.',
    submit: 'Join the waitlist',
    pending: 'Joining…',
    privacy: 'One email when the app is out, and no ads.',
    privacyLink: 'Privacy',
    privacyHref: '/legal/privacy',
    /** Client-side checks, shown under the field before anything is sent. */
    emailMissing: 'Enter your email address.',
    emailInvalid: 'Check the email address. It should look like name@example.com.',
    /** Shape-only checks; none of them hint at which years are accepted (M04 `m04.error.*`). */
    birthYearMissing: 'Enter the year you were born.',
    birthYearIncomplete: 'Enter all four digits of the year.',
    birthYearFuture: "That year hasn't happened yet. Check the number.",
    birthYearTooEarly: 'Check that year. It needs to be 1900 or later.',
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
  /** The message is this field's error, linked by `aria-describedby`, not a live-region update. */
  field?: WaitlistField;
  /** A link shown after the body (the under-13 note points parents to the children's privacy notice). */
  link?: { label: string; href: string };
}

/**
 * The copy for a form state. `idle` has nothing to say. Every other answer of
 * the server action maps to one message; the mapping is exhaustive over
 * `WaitlistStatus`, so a new status fails the typecheck here first.
 */
export function waitlistMessage(state: { status: WaitlistStatus | 'idle'; field?: WaitlistField }): WaitlistMessage | null {
  switch (state.status) {
    case 'idle':
      return null;
    case 'joined':
      return {
        tone: 'success',
        title: "You're on the list.",
        body: "We'll send one email when NYC-MON is out. Signed up before? Nothing changes, and you'll still get just the one.",
      };
    // Replaces the form. Kind, names no age and no threshold, and offers no
    // retry: the next step belongs to a grown-up, with their own email.
    case 'under13':
      return {
        tone: 'notice',
        body: "Thanks for wanting in. We can't add you to the waitlist, and nothing you typed was saved. Later, a parent or guardian can join from their own phone or computer to hear when NYC-MON is out.",
        link: { label: "For parents: children's privacy", href: '/legal/childrens-privacy' },
      };
    case 'invalid':
      if (state.field === 'birthYear') {
        return { tone: 'error', field: 'birthYear', body: 'Enter the year you were born, as four digits.' };
      }
      return state.field === 'email'
        ? { tone: 'error', field: 'email', body: 'Check the email address. It should look like name@example.com.' }
        : { tone: 'error', field: 'email', body: "The form didn't come through. Check your email and try again." };
    case 'rate_limited':
      return {
        tone: 'error',
        body: 'Too many tries from this connection. Try again in an hour. Your email is still in the box; enter your birth year again.',
      };
    case 'error':
      return {
        tone: 'error',
        // The year is never echoed back (the action keeps only the email), so the copy asks for it again.
        body: "We couldn't reach the waitlist just now. Your email is still in the box. Enter your birth year again, then try in a moment.",
      };
  }
}

/** Earliest birth year accepted; mirrors `MIN_BIRTH_YEAR` in @acme/core/schemas (the server checks it too). */
export const WAITLIST_MIN_BIRTH_YEAR = 1900;

/**
 * The browser-side check of the birth-year field, before anything is sent:
 * the error to show, or null when the value is a plausible year. Shape only,
 * like the app's M04 typed field: it never says which years can join.
 */
export function birthYearError(raw: string, currentYear: number): string | null {
  const copy = WAITLIST_COPY.form;
  const typed = raw.trim();
  if (typed === '') return copy.birthYearMissing;
  if (!/^[0-9]{4}$/.test(typed)) return copy.birthYearIncomplete;
  const year = Number(typed);
  if (year > currentYear) return copy.birthYearFuture;
  if (year < WAITLIST_MIN_BIRTH_YEAR) return copy.birthYearTooEarly;
  return null;
}

/** States in which the visitor's entries are shown again (the action echoes the email for these). */
export function keepsEntries(status: WaitlistStatus | 'idle'): boolean {
  return status === 'invalid' || status === 'rate_limited' || status === 'error';
}
