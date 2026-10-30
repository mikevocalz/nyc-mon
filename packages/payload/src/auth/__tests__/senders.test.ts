import { PublishCommand } from '@aws-sdk/client-sns';
import { describe, expect, it } from 'vitest';
import { createConsoleSmsSender, createSmsSender, createSnsSmsSender, maskPhoneNumber } from '../sms.ts';
import { consumeSmsQuota, type QuotaStore } from '../sms-quota.ts';
import { isValidUsername } from '../username.ts';
import {
  accountsMergedMail,
  changeEmailMail,
  guardianConsentMail,
  newSurfaceMail,
  resetPasswordMail,
  signInMethodAddedMail,
  signInMethodRemovedMail,
  twoFactorCodeMail,
  verifyEmailMail,
  waitlistJoinedMail,
  type MailContent,
} from '../templates.ts';

describe('SMS senders (ADR 0004 §6)', () => {
  it('is off when no transport is set', () => {
    expect(createSmsSender({ sms: undefined, isProduction: true })).toBeUndefined();
  });

  it('refuses the console sender in production', () => {
    const sms = { transport: 'console' as const, allowedCountries: undefined, awsRegion: undefined, originationNumber: undefined };
    expect(() => createSmsSender({ sms, isProduction: true })).toThrow(/refused in production/);
    expect(createSmsSender({ sms, isProduction: false })?.transport).toBe('console');
  });

  it('refuses SNS without a region', () => {
    const sms = { transport: 'sns' as const, allowedCountries: undefined, awsRegion: undefined, originationNumber: undefined };
    expect(() => createSmsSender({ sms, isProduction: true })).toThrow(/AWS_REGION/);
  });

  it('console sender never logs a full number', async () => {
    const lines: string[] = [];
    await createConsoleSmsSender((line) => lines.push(line)).send({ toE164: '+12125550123', body: '123456 is your code' });
    expect(lines[0]).toContain('+1••••••0123');
    expect(lines[0]).not.toContain('2125550123');
    expect(maskPhoneNumber('+14165550199')).toBe('+1••••••0199');
  });

  it('SNS sender publishes a transactional SMS with the origination number', async () => {
    const sent: unknown[] = [];
    const client = { send: async (command: unknown) => { sent.push(command); return {}; } };
    await createSnsSmsSender({ region: 'us-east-1', originationNumber: '+18885550100', client: client as never }).send({
      toE164: '+12125550123',
      body: '123456 is your NYC-MON sign-in code.',
    });
    const command = sent[0];
    expect(command).toBeInstanceOf(PublishCommand);
    const input = (command as PublishCommand).input;
    expect(input.PhoneNumber).toBe('+12125550123');
    expect(input.MessageAttributes?.['AWS.SNS.SMS.SMSType']?.StringValue).toBe('Transactional');
    expect(input.MessageAttributes?.['AWS.MM.SMS.OriginationNumber']?.StringValue).toBe('+18885550100');
  });
});

describe('daily SMS quota', () => {
  function memoryStore(): QuotaStore {
    const rows = new Map<string, string>();
    return {
      findVerificationValue: async (id) => (rows.has(id) ? { value: rows.get(id) ?? '0' } : null),
      createVerificationValue: async ({ identifier, value }) => rows.set(identifier, value),
      updateVerificationByIdentifier: async (id, { value }) => rows.set(id, value),
    };
  }

  it('allows the budget and refuses the next send that day', async () => {
    const store = memoryStore();
    const now = Date.UTC(2026, 9, 4, 12);
    for (let i = 0; i < 3; i += 1) await consumeSmsQuota(store, 'number:+12125550123', 3, now);
    await expect(consumeSmsQuota(store, 'number:+12125550123', 3, now)).rejects.toMatchObject({ body: { code: 'SMS_LIMIT_REACHED' } });
    // A new UTC day starts a new budget.
    await expect(consumeSmsQuota(store, 'number:+12125550123', 3, now + 86_400_000)).resolves.toBeUndefined();
  });
});

describe('usernames (ADR 0004 §1)', () => {
  it('accepts plain handles', () => {
    expect(isValidUsername('maya_b')).toBe(true);
    expect(isValidUsername('bx.caller7')).toBe(true);
  });

  it('refuses contact-info shapes and bad edges', () => {
    expect(isValidUsername('me@example.com')).toBe(false);
    expect(isValidUsername('caller2125550123')).toBe(false); // reads as a phone number
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidUsername('a'.repeat(21))).toBe(false);
    expect(isValidUsername('.dot')).toBe(false);
    expect(isValidUsername('dot.')).toBe(false);
    expect(isValidUsername('do..t')).toBe(false);
    expect(isValidUsername('Upper')).toBe(false);
  });
});

describe('mail templates', () => {
  it('writes the link into the text part and escapes HTML', () => {
    const mail = verifyEmailMail('https://example.com/verify?token=a&b="c"');
    expect(mail.text).toContain('https://example.com/verify?token=a&b="c"');
    expect(mail.html).toContain('token=a&amp;b=&quot;c&quot;');
    expect(mail.html).not.toContain('"c"');
  });

  it('puts the 2FA code in both parts', () => {
    const mail = twoFactorCodeMail('482913', 5);
    expect(mail.text).toContain('482913');
    expect(mail.html).toContain('482913');
    expect(mail.text).toContain('5 minutes');
  });

  it('renders the waitlist confirmation in the shared layout with a CTA to the site', () => {
    const mail = waitlistJoinedMail();
    expect(mail.subject).toBe("You're on the NYC-MON waitlist");
    expect(mail.text).toContain('the app is out');
    // The CTA's URL is written out in the text part, like every mail's link.
    expect(mail.text).toContain('https://nyc-mon.city');
    expect(mail.html).toContain('https://nyc-mon.city');
  });

  it('echoes the form promise without breaking it: the confirmation names itself', () => {
    // The form says "one email when the app is out, and no ads". The mail
    // sent on join is a second email, so it says plainly that it is the
    // confirmation and the launch mail is the only other one.
    const mail = waitlistJoinedMail();
    expect(mail.text).toContain('confirmation');
    expect(mail.text).toContain('when the app is out');
    expect(mail.text).toContain('no ads');
  });

  it('follows the copy deck for the verify and reset mails (M03)', () => {
    const verify = verifyEmailMail('https://example.com/verify');
    expect(verify.subject).toBe('Confirm your NYC-MON email');
    expect(verify.text).toContain('finish setting up your NYC-MON account');
    expect(verify.text).toContain("didn't sign up");

    const reset = resetPasswordMail('https://example.com/reset');
    expect(reset.subject).toBe('Reset your NYC-MON password');
    expect(reset.text).toContain('expires in one hour');
    expect(reset.text).toContain('password stays the same');
  });

  it('uses the right article before each surface name', () => {
    expect(newSurfaceMail('phone').text).toContain('on a phone');
    expect(newSurfaceMail('Apple Vision Pro').text).toContain('on an Apple Vision Pro');
  });

  it('points account notices only at remedies that ship', () => {
    // No "Devices" list or method-removal control exists in Settings; a
    // password change signs out the other sessions.
    const added = signInMethodAddedMail('google');
    expect(added.text).toContain('change your password');
    const removed = signInMethodRemovedMail('google');
    expect(removed.text).toContain('change your password');
    const surface = newSurfaceMail('web browser');
    expect(surface.text).toContain('change your password');
    expect(surface.text).not.toContain('Settings > Devices');
    const merged = accountsMergedMail(2);
    expect(merged.text).toContain('reply to this email');
  });

  it('keeps every subject and text part inside the copy contract', () => {
    const mails: MailContent[] = [
      verifyEmailMail('https://example.com/v'),
      resetPasswordMail('https://example.com/r'),
      changeEmailMail('new@example.com', 'https://example.com/c'),
      twoFactorCodeMail('123456', 5),
      signInMethodAddedMail('google'),
      signInMethodRemovedMail('credential'),
      newSurfaceMail('phone'),
      accountsMergedMail(3),
      guardianConsentMail(1, 14, 'https://example.com'),
      waitlistJoinedMail(),
    ];
    // The deck's rules for voice "ui": no em or en dashes, no exclamation
    // marks, no "user" for a Caller, none of the site's banned hype words
    // (tooling/site-qa/copy-lint.mjs).
    const offVoice = /[—–!]|\busers?\b|unlock|reimagin|seamless|next[\s-]+gen|AI[\s-]+powered|immersive|best friend|the future is here|elevat|supercharg|journey/i;
    for (const mail of mails) {
      expect(mail.subject).not.toMatch(offVoice);
      expect(mail.text).not.toMatch(offVoice);
    }
  });
});
