// Every Better Auth email (ADR 0004 §5). Pure functions: input in, subject,
// HTML and text out. Copy rules: `Caller`, never "user"; no Mon speaks in
// mail; a link is always written out in the text part too.
import type { AuthMail } from './email';

/** A rendered mail without its recipient. */
export type MailContent = Omit<AuthMail, 'to'>;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

interface Layout {
  subject: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  code?: string;
  footer?: string;
}

function render({ subject, paragraphs, action, code, footer }: Layout): MailContent {
  const footerLine = footer ?? "If this wasn't you, you can ignore this email.";
  const html = [
    '<!doctype html><html lang="en"><body style="margin:0;padding:24px;font-family:system-ui,sans-serif;color:#111;background:#fff">',
    '<main style="max-width:480px;margin:0 auto">',
    '<p style="font-weight:700;letter-spacing:.04em">NYC-MON</p>',
    ...paragraphs.map((p) => `<p style="line-height:1.5">${escapeHtml(p)}</p>`),
    code === undefined
      ? ''
      : `<p style="font-size:28px;font-weight:700;letter-spacing:.2em;font-family:ui-monospace,monospace">${escapeHtml(code)}</p>`,
    action === undefined
      ? ''
      : `<p><a href="${escapeHtml(action.url)}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;text-decoration:none;border-radius:6px">${escapeHtml(action.label)}</a></p><p style="font-size:13px;color:#555;word-break:break-all">${escapeHtml(action.url)}</p>`,
    `<p style="font-size:13px;color:#555">${escapeHtml(footerLine)}</p>`,
    '</main></body></html>',
  ].join('');
  const text = [
    ...paragraphs,
    ...(code === undefined ? [] : [code]),
    ...(action === undefined ? [] : [action.url]),
    footerLine,
  ].join('\n\n');
  return { subject, html, text };
}

export function verifyEmailMail(url: string): MailContent {
  return render({
    subject: 'Confirm your NYC-MON email',
    paragraphs: ['Confirm this address to finish setting up your account.'],
    action: { label: 'Confirm email', url },
  });
}

export function resetPasswordMail(url: string): MailContent {
  return render({
    subject: 'Reset your NYC-MON password',
    paragraphs: ['Use this link to set a new password. It expires in one hour.'],
    action: { label: 'Set a new password', url },
  });
}

export function changeEmailMail(newEmail: string, url: string): MailContent {
  return render({
    subject: 'Confirm your new NYC-MON email',
    paragraphs: [`Someone asked to move this NYC-MON account to ${newEmail}. Confirm to make the change.`],
    action: { label: 'Confirm the change', url },
    footer: "If you didn't ask for this, ignore this email and your address stays the same.",
  });
}

export function twoFactorCodeMail(code: string, minutes: number): MailContent {
  return render({
    subject: 'Your NYC-MON sign-in code',
    paragraphs: [`Enter this code to finish signing in. It works for ${minutes} minutes.`],
    code,
    footer: "If you didn't try to sign in, change your password.",
  });
}

/** Provider ids as Better Auth stores them, to the names Callers know. */
function providerName(providerId: string): string {
  switch (providerId) {
    case 'google':
      return 'Google';
    case 'apple':
      return 'Apple';
    case 'credential':
      return 'Email and password';
    default:
      return providerId;
  }
}

export function signInMethodAddedMail(providerId: string): MailContent {
  const name = providerName(providerId);
  return render({
    subject: `${name} sign-in was added to your NYC-MON account`,
    paragraphs: [`${name} can now sign in to your NYC-MON account.`],
    footer: "If you didn't do this, remove it in Settings and change your password.",
  });
}

export function signInMethodRemovedMail(providerId: string): MailContent {
  const name = providerName(providerId);
  return render({
    subject: `${name} sign-in was removed from your NYC-MON account`,
    paragraphs: [`${name} can no longer sign in to your NYC-MON account.`],
    footer: "If you didn't do this, change your password.",
  });
}

export function newSurfaceMail(surfaceLabel: string): MailContent {
  return render({
    subject: 'A new sign-in to your NYC-MON account',
    paragraphs: [`Your account was just signed in on a ${surfaceLabel}. Your Mon is the same one on every screen.`],
    footer: "If this wasn't you, sign it out in Settings > Devices and change your password.",
  });
}

export function accountsMergedMail(movedMons: number): MailContent {
  const mons = movedMons === 1 ? '1 Mon' : `${movedMons} Mons`;
  return render({
    subject: 'Your NYC-MON accounts were joined',
    paragraphs: [`Two NYC-MON accounts were joined into one. ${mons} moved over, and nothing was deleted.`],
    footer: "If you didn't do this, contact support right away.",
  });
}
