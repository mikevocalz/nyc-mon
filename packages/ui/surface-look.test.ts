import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CARD_DEPTH, badgeLegacyLook, initialsOf, litWindow, skylineHeights, splitCardClasses, withoutTextColour,
} from './surface-look.ts';

test('splitCardClasses: content classes stay on the face, layout classes go to the box', () => {
  assert.deepEqual(splitCardClasses('gap-4'), { outer: '', inner: 'gap-4' });
  assert.deepEqual(splitCardClasses('md:flex-1 gap-3 p-2'), { outer: 'md:flex-1', inner: 'gap-3 p-2' });
  assert.deepEqual(splitCardClasses('w-full max-w-md mt-4 self-start'), { outer: 'w-full max-w-md mt-4 self-start', inner: '' });
  assert.deepEqual(splitCardClasses('flex-row items-center'), { outer: '', inner: 'flex-row items-center' });
  assert.deepEqual(splitCardClasses(undefined), { outer: '', inner: '' });
});

test('CARD_DEPTH: flat drops the plate, raised steps furthest', () => {
  assert.equal(CARD_DEPTH.flat, 0);
  assert.ok(CARD_DEPTH.raised > CARD_DEPTH.card);
});

test('badgeLegacyLook maps every legacy tone onto a brand tone', () => {
  assert.deepEqual(badgeLegacyLook('success'), { tone: 'leaf', fill: 'solid' });
  assert.deepEqual(badgeLegacyLook('danger'), { tone: 'apple', fill: 'solid' });
  assert.deepEqual(badgeLegacyLook('info'), { tone: 'carolina', fill: 'solid' });
  assert.deepEqual(badgeLegacyLook('accent'), { tone: 'royal', fill: 'solid' });
  assert.deepEqual(badgeLegacyLook('neutral'), { tone: 'white', fill: 'outline' });
  assert.deepEqual(badgeLegacyLook('primary'), { tone: 'district', fill: 'solid' });
});

test('initialsOf keeps two initials', () => {
  assert.equal(initialsOf('ana maria lopez'), 'AM');
  assert.equal(initialsOf('  Jo  '), 'J');
  assert.equal(initialsOf(''), '');
});

test('skylineHeights is stable and offset per row', () => {
  assert.deepEqual(skylineHeights(0), skylineHeights(0));
  assert.notDeepEqual(skylineHeights(0), skylineHeights(1));
  assert.equal(skylineHeights(3, 12).length, 12);
  for (const h of skylineHeights(2, 14)) assert.ok(h > 0 && h <= 100);
});

test('litWindow lights a sparse, fixed set', () => {
  const lit = Array.from({ length: 10 }, (_, b) => litWindow(0, b)).filter(Boolean).length;
  assert.ok(lit > 0 && lit < 10);
});

test('withoutTextColour drops colour utilities but keeps sizes', () => {
  assert.equal(withoutTextColour('text-text-muted h-6 w-6'), 'h-6 w-6');
  assert.equal(withoutTextColour('text-lg dark:text-ink-50 text-center'), 'text-lg text-center');
});
