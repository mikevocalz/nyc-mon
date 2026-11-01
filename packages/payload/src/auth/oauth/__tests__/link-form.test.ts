import { describe, expect, it } from 'vitest';
import { credentialsError, hasFieldErrors, linkCopyFor, nameFromEmail, signInErrors, signUpErrors } from '../link-form';

const NOW = Date.UTC(2026, 9, 28, 12);

describe('signInErrors', () => {
  it('asks for each empty field instead of reporting a mismatch', () => {
    expect(signInErrors({ email: '', password: '' })).toEqual({ email: 'Enter your email', password: 'Enter your password' });
    expect(signInErrors({ email: '   ', password: 'x' })).toEqual({ email: 'Enter your email' });
    expect(signInErrors({ email: 'a@b.test', password: '' })).toEqual({ password: 'Enter your password' });
  });

  it('accepts a filled form', () => {
    expect(hasFieldErrors(signInErrors({ email: 'a@b.test', password: 'whatever' }))).toBe(false);
  });

  it('catches an address with no @ before the server does', () => {
    expect(signInErrors({ email: 'mike', password: 'x' })).toEqual({ email: 'Enter an email address like name@example.com' });
  });
});

describe('signUpErrors', () => {
  const good = { email: 'caller@example.com', password: 'correct-horse', birthYear: '1990' };

  it('accepts an adult with a 10+ character password', () => {
    expect(signUpErrors(good, NOW)).toEqual({});
  });

  it('asks for each empty field', () => {
    expect(signUpErrors({ email: '', password: '', birthYear: '' }, NOW)).toEqual({
      email: 'Enter your email',
      password: 'Enter a password',
      birthYear: 'Enter the year you were born',
    });
  });

  it('holds the password to the server minimum of 10 characters', () => {
    expect(signUpErrors({ ...good, password: 'short' }, NOW)).toEqual({ password: 'Use at least 10 characters' });
  });

  it('refuses a birth year that is not a plausible four-digit year', () => {
    expect(signUpErrors({ ...good, birthYear: '19x0' }, NOW).birthYear).toBe('Enter a four-digit year, like 1990');
    expect(signUpErrors({ ...good, birthYear: '1850' }, NOW).birthYear).toBe('Enter a four-digit year, like 1990');
    expect(signUpErrors({ ...good, birthYear: '2030' }, NOW).birthYear).toBe('Enter a four-digit year, like 1990');
  });

  it('applies the linking 18+ rule: a year that could belong to a 17-year-old is refused', () => {
    expect(signUpErrors({ ...good, birthYear: '2008' }, NOW).birthYear).toBe('Linking is for adults 18 and over.');
    expect(signUpErrors({ ...good, birthYear: '2007' }, NOW)).toEqual({});
  });
});

describe('credentialsError', () => {
  it('mentions a reset only when one can be sent', () => {
    expect(credentialsError(true)).toBe("That email and password don't match. Check both, or reset your password.");
    expect(credentialsError(false)).toBe("That email and password don't match. Check both and try again.");
  });
});

describe('nameFromEmail', () => {
  it('uses the part before the @ as the starting display name', () => {
    expect(nameFromEmail('Mike.Allen@example.com')).toBe('Mike.Allen');
    expect(nameFromEmail('@example.com')).toBe('Caller');
  });
});

describe('linkCopyFor', () => {
  it('points an Alexa Caller at the Alexa app', () => {
    const copy = linkCopyFor('alexa');
    expect(copy.unlinkNote).toBe('You can unlink any time in the Alexa app.');
    expect(copy.startAgain).toBe('Start again from the Alexa app.');
  });

  it('tells a companion Caller that signing out of the companion unlinks it', () => {
    const copy = linkCopyFor('companion');
    expect(copy.unlinkNote).toBe('You can unlink any time by signing out of the companion.');
    expect(copy.startAgain).toBe('Start again from the companion.');
    expect(copy.unlinkNote).not.toMatch(/Alexa/);
  });
});
