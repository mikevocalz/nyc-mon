// M20 Account: provider labels, the password check and failure lines.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuthError } from '@acme/auth';
import { accountErrorId, hasPassword, looksLikeEmail, providerCopyId } from './account-model.ts';

const fail = (code: string, status: number) => ({ ok: false as const, error: new AuthError(code, code, status) });

test('provider labels', () => {
  assert.equal(providerCopyId('credential'), 'settings.account.provider.credential');
  assert.equal(providerCopyId('apple'), 'settings.account.provider.apple');
  assert.equal(providerCopyId('weird'), 'settings.account.provider.other');
});

test('Change password shows only with an email-and-password account', () => {
  assert.equal(hasPassword([{ id: '1', providerId: 'apple', createdAt: undefined }]), false);
  assert.equal(hasPassword([{ id: '1', providerId: 'credential', createdAt: undefined }]), true);
});

test('email check', () => {
  assert.equal(looksLikeEmail(' a@b.co '), true);
  assert.equal(looksLikeEmail('a@b'), false);
});

test('failure lines', () => {
  assert.equal(accountErrorId(fail('NETWORK', 0)), 'settings.account.error.offline');
  assert.equal(accountErrorId(fail('INVALID_PASSWORD', 400)), 'settings.account.error.password_wrong');
  assert.equal(accountErrorId(fail('USER_ALREADY_EXISTS', 422)), 'settings.account.error.email_taken');
  assert.equal(accountErrorId(fail('SESSION_EXPIRED', 400)), 'settings.account.error.reauth');
  assert.equal(accountErrorId(fail('X', 500)), 'settings.account.error.generic');
});
