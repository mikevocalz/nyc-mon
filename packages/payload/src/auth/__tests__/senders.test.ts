import { PublishCommand } from '@aws-sdk/client-sns';
import { describe, expect, it } from 'vitest';
import { createConsoleSmsSender, createSmsSender, createSnsSmsSender, maskPhoneNumber } from '../sms.ts';
import { consumeSmsQuota, type QuotaStore } from '../sms-quota.ts';
import { isValidUsername } from '../username.ts';
import { twoFactorCodeMail, verifyEmailMail } from '../templates.ts';

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
});
