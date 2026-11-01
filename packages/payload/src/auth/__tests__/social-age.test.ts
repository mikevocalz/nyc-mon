import { describe, expect, it } from 'vitest';
import { birthYearFromAdditionalData, socialProviderForCreate } from '../social-age.ts';

describe('socialProviderForCreate (ADR 0001 age gate)', () => {
  it('reads the provider from the ID-token sign-in body', () => {
    expect(socialProviderForCreate('/sign-in/social', { provider: 'apple' }, {})).toBe('apple');
    expect(socialProviderForCreate('/sign-in/social', { provider: 'google' }, {})).toBe('google');
  });

  it('reads the provider from the redirect callback', () => {
    expect(socialProviderForCreate('/callback/:id', {}, { id: 'google' })).toBe('google');
    expect(socialProviderForCreate('/callback/apple', {}, undefined)).toBe('apple');
  });

  it('ignores other providers and paths', () => {
    expect(socialProviderForCreate('/sign-in/social', { provider: 'amazon' }, {})).toBeUndefined();
    expect(socialProviderForCreate('/oauth2/callback/:id', {}, { id: 'amazon' })).toBeUndefined();
    expect(socialProviderForCreate('/sign-up/email', { provider: 'apple' }, {})).toBeUndefined();
    expect(socialProviderForCreate(undefined, {}, {})).toBeUndefined();
  });
});

describe('birthYearFromAdditionalData', () => {
  it('returns the raw value for the caller to validate', () => {
    expect(birthYearFromAdditionalData({ additionalData: { birthYear: 2008 } })).toBe(2008);
    expect(birthYearFromAdditionalData({ additionalData: { birthYear: '2008' } })).toBe('2008');
  });

  it('is undefined when nothing was sent', () => {
    expect(birthYearFromAdditionalData({})).toBeUndefined();
    expect(birthYearFromAdditionalData({ additionalData: null })).toBeUndefined();
    expect(birthYearFromAdditionalData(undefined)).toBeUndefined();
  });
});
