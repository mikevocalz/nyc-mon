import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cityCardLayout } from './layout.ts';

test('every City grid item overrides RNW content alignment so its panel fills the track', () => {
  for (const district of ['downtown', 'midtown', 'harlem', 'megacity'] as const) {
    const classes = cityCardLayout(district).split(' ');
    assert.ok(classes.includes('grid'));
    assert.ok(classes.includes('content-stretch'));
    assert.ok(classes.includes('min-w-0'));
  }
});

test('City keeps the leading two-row span and full-width final district', () => {
  assert.match(cityCardLayout('downtown'), /md:col-span-7 md:row-span-2/);
  for (const district of ['midtown', 'harlem'] as const) {
    assert.match(cityCardLayout(district), /md:col-span-5/);
    assert.doesNotMatch(cityCardLayout(district), /row-span/);
  }
  assert.match(cityCardLayout('megacity'), /md:col-span-12/);
});
