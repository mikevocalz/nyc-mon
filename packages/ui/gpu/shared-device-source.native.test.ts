import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coerceSkiaPointer } from './coerce-skia-pointer.ts';

// Skia.getNativeDevice() declares bigint but returns the pointer as a string
// on iOS at runtime; importDevice expects bigint — the uncoerced path threw
// "Value is a string, expected a number" (A12X iPad, iPadOS 26.7.1).

test('a bigint pointer passes through unchanged', () => {
  assert.equal(coerceSkiaPointer(0x1234abcdn), 0x1234abcdn);
});

test('a decimal string pointer parses as decimal', () => {
  assert.equal(coerceSkiaPointer('305441453'), 305441453n);
});

test('a hex-prefixed string pointer parses as hex', () => {
  assert.equal(coerceSkiaPointer('0x1234abcd'), 0x1234abcdn);
});

test('an unprefixed hex string parses via the 0x fallback', () => {
  assert.equal(coerceSkiaPointer('1234abcd'), 0x1234abcdn);
});

test('uppercase 0X prefix parses', () => {
  assert.equal(coerceSkiaPointer('0X1234ABCD'), 0x1234abcdn);
});
