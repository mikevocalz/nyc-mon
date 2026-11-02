// EXPO_PUBLIC_GAME_FREERUN parsing: the free-run loop is opt-in — only an
// explicit truthy value selects it, everything else keeps the rAF loop.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseGameFreerunFlag } from './frame-pacing.ts';

test('the flag opts in only on an explicit truthy value', () => {
  for (const value of ['1', 'true', 'TRUE', ' true ']) {
    assert.equal(parseGameFreerunFlag(value), true, String(value));
  }
});

test('anything else keeps the rAF loop', () => {
  for (const value of [undefined, null, '', '0', 'false', 'off', 'ahb', 'yes']) {
    assert.equal(parseGameFreerunFlag(value), false, String(value));
  }
});
