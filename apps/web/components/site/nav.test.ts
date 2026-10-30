import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isActive, navItems } from './nav.ts';

test('the walk marks only "Walk the city", the City page only "The City"', () => {
  const active = (path: string) => navItems(path).filter((item) => item.active).map((item) => item.href);
  assert.deepEqual(active('/city/walk'), ['/city/walk']);
  assert.deepEqual(active('/city'), ['/city']);
  assert.deepEqual(active('/'), ['/']);
  assert.deepEqual(active('/mons/yotes'), ['/mons']);
});

test('a path that only shares a prefix is not under the page', () => {
  assert.equal(isActive('/cityscape', '/city'), false);
  assert.equal(isActive('/city/walk', '/city/walk'), true);
});
