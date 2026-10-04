import { describe, expect, it } from 'vitest';
import { isAllowedSmsNumber, parseSmsCountries, passesPhoneGate } from '../phone.ts';

const NOW = Date.UTC(2026, 9, 4);
const both = ['US', 'CA'] as const;

describe('isAllowedSmsNumber (DECISIONS #19)', () => {
  it('accepts US and Canadian mobile numbers', () => {
    expect(isAllowedSmsNumber('+12125550123', both)).toBe(true); // New York
    expect(isAllowedSmsNumber('+14165550123', both)).toBe(true); // Toronto
    expect(isAllowedSmsNumber('+17875550123', both)).toBe(true); // Puerto Rico, a US territory
  });

  it('refuses other NANP countries, premium and toll-free codes', () => {
    expect(isAllowedSmsNumber('+18765550123', both)).toBe(false); // Jamaica
    expect(isAllowedSmsNumber('+18095550123', both)).toBe(false); // Dominican Republic
    expect(isAllowedSmsNumber('+19005550123', both)).toBe(false); // premium
    expect(isAllowedSmsNumber('+18005550123', both)).toBe(false); // toll-free
  });

  it('refuses malformed and non-+1 numbers', () => {
    expect(isAllowedSmsNumber('+442071234567', both)).toBe(false);
    expect(isAllowedSmsNumber('2125550123', both)).toBe(false);
    expect(isAllowedSmsNumber('+11125550123', both)).toBe(false); // area code can't start with 1
    expect(isAllowedSmsNumber('+19115550123', both)).toBe(false); // N11
    expect(isAllowedSmsNumber('+1212555012', both)).toBe(false);
  });

  it('sends nothing when no supported country is configured', () => {
    expect(isAllowedSmsNumber('+12125550123', [])).toBe(false);
  });
});

describe('parseSmsCountries', () => {
  it('defaults to US and Canada and drops anything unsupported', () => {
    expect(parseSmsCountries(undefined)).toEqual(['US', 'CA']);
    expect(parseSmsCountries('us, ca, GB')).toEqual(['US', 'CA']);
    expect(parseSmsCountries('GB')).toEqual([]);
  });
});

describe('passesPhoneGate (ADR 0004 §4, DECISIONS #21)', () => {
  it('passes a 13+ Caller who never needed consent', () => {
    expect(passesPhoneGate({ birthYear: 2000, consentStatus: 'not-required' }, NOW)).toBe(true);
  });

  it('fails any year in the consent range', () => {
    expect(passesPhoneGate({ birthYear: 2013, consentStatus: 'not-required' }, NOW)).toBe(false);
    expect(passesPhoneGate({ birthYear: 2016, consentStatus: 'approved', phoneConsentAt: '2026-01-01' }, NOW)).toBe(false);
  });

  it('fails an unknown or invalid birth year', () => {
    expect(passesPhoneGate({ consentStatus: 'not-required' }, NOW)).toBe(false);
    expect(passesPhoneGate({ birthYear: 1999.5, consentStatus: 'not-required' }, NOW)).toBe(false);
    expect(passesPhoneGate({ birthYear: '2000', consentStatus: 'not-required' }, NOW)).toBe(false);
  });

  it('needs a second guardian approval on a consented account, even past 13', () => {
    expect(passesPhoneGate({ birthYear: 2010, consentStatus: 'approved' }, NOW)).toBe(false);
    expect(passesPhoneGate({ birthYear: 2010, consentStatus: 'approved', phoneConsentAt: null }, NOW)).toBe(false);
    expect(passesPhoneGate({ birthYear: 2010, consentStatus: 'approved', phoneConsentAt: '2026-09-01T00:00:00.000Z' }, NOW)).toBe(true);
  });

  it('fails pending and denied consent', () => {
    expect(passesPhoneGate({ birthYear: 2000, consentStatus: 'pending' }, NOW)).toBe(false);
    expect(passesPhoneGate({ birthYear: 2000, consentStatus: 'denied' }, NOW)).toBe(false);
  });
});
