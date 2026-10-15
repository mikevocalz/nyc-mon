import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMediaScope } from './media-scope.ts';

test('media scope runs a setup only when its query matches', () => {
  const ran: string[] = [];
  const scope = createMediaScope((q) => q === '(min-width: 768px)');
  scope.add('(min-width: 768px)', () => ran.push('desktop'));
  scope.add('(max-width: 767px)', () => ran.push('phone'));
  scope.revert();
  assert.deepEqual(ran, ['desktop']);
});
