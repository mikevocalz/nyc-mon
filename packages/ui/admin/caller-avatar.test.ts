import assert from 'node:assert/strict';
import { test } from 'node:test';
import { callerAvatarPresentation, safeCallerAvatarSource } from './caller-avatar.ts';

for (const [label, value] of [
  ['missing', undefined], ['null', null], ['empty', ''], ['blank', '  '],
  ['non-string', 42], ['script', 'javascript:alert(1)'],
  ['HTML data', 'data:text/html,<script>alert(1)</script>'],
  ['image data', 'data:image/svg+xml,<svg/>'], ['blob', 'blob:https://example.com/id'],
  ['protocol-relative', '//example.com/photo.png'], ['backslash', '/\\example.com/photo.png'],
  ['HTTP', 'http://example.com/photo.png'], ['credentials', 'https://user:pass@example.com/photo.png'],
  ['control character', 'https://example.com/\nphoto.png'], ['relative', 'photo.png'],
] as const) {
  test(`avatar rejects ${label}`, () => assert.equal(safeCallerAvatarSource(value), null));
}

test('uses the existing HTTPS profile photo, including signed query strings', () => {
  const source = 'https://media.example.com/avatars/u1.png?token=sample&expires=123';
  assert.equal(safeCallerAvatarSource(source), source);
});

test('supports root-relative uploads without inventing a host', () => {
  assert.equal(safeCallerAvatarSource('/avatars/u1.png'), '/avatars/u1.png');
});

test('normalizes surrounding whitespace', () => {
  assert.equal(safeCallerAvatarSource(' https://media.example.com/u1.png '), 'https://media.example.com/u1.png');
});

test('missing photo produces a labelled generic fallback', () => {
  assert.deepEqual(callerAvatarPresentation(null, null, '00042'), {
    source: null, label: 'No profile photo for user 00042',
  });
});

test('broken photo is removed instead of repeatedly requesting it', () => {
  const source = 'https://media.example.com/u1.png';
  assert.deepEqual(callerAvatarPresentation(source, source, 'u1'), {
    source: null, label: 'No profile photo for user u1',
  });
});

test('a changed profile image is tried after the old image failed', () => {
  assert.deepEqual(callerAvatarPresentation('/new.png', '/old.png', 'u1'), {
    source: '/new.png', label: 'Profile photo for user u1',
  });
});
