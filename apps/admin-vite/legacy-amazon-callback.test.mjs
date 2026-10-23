import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legacyAmazonCallback } from './src/legacy-amazon-callback.ts';

const LOCAL = { NODE_ENV: 'development', AMAZON_LWA_LOCAL_LEGACY_CALLBACK: 'true' };

test('forwards legacy Amazon callbacks on the same origin with OAuth parameters intact', () => {
  const response = legacyAmazonCallback(new Request('http://localhost:5174/payload-api/auth/oauth2/callback/amazon?code=a%2Bb&state=c%2Fd&error=access_denied'), LOCAL);
  assert.equal(response?.status, 307);
  assert.equal(response.headers.get('location'), 'http://localhost:5174/payload-api/auth/callback/amazon?code=a%2Bb&state=c%2Fd&error=access_denied');
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
});

test('does not redirect unrelated routes or request bodies', () => {
  for (const path of ['/payload-api/auth/callback/amazon', '/payload-api/auth/oauth2/callback/google', '/payload-api/auth/sign-in/social']) {
    assert.equal(legacyAmazonCallback(new Request('http://localhost:5174' + path), LOCAL), undefined);
  }
  assert.equal(legacyAmazonCallback(new Request('http://localhost:5174/payload-api/auth/oauth2/callback/amazon', { method: 'POST', body: 'private' }), LOCAL), undefined);
});

test('never redirects outside opted-in local development', () => {
  const url = 'http://localhost:5174/payload-api/auth/oauth2/callback/amazon?code=a&state=b';
  assert.equal(legacyAmazonCallback(new Request(url), { NODE_ENV: 'production', AMAZON_LWA_LOCAL_LEGACY_CALLBACK: 'true' }), undefined);
  assert.equal(legacyAmazonCallback(new Request(url), { NODE_ENV: 'development' }), undefined);
  assert.equal(legacyAmazonCallback(new Request('https://evil.example/payload-api/auth/oauth2/callback/amazon?code=a'), LOCAL), undefined);
});
