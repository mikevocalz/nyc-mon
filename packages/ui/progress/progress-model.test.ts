import assert from 'node:assert/strict';
import test from 'node:test';
import { DISTRICTS } from '../district/index.ts';
import {
  blockFills, clampInt, isIndeterminate, litCount, percentLabel, progressA11y, progressFraction, quantize,
  resolveSize, ringAngles, skylineHeights,
} from './progress-model.ts';

test('progressFraction clamps and survives bad input', () => {
  assert.equal(progressFraction(50, 100), 0.5);
  assert.equal(progressFraction(150, 100), 1);
  assert.equal(progressFraction(-5, 100), 0);
  assert.equal(progressFraction(5, 0), 0);
  assert.equal(progressFraction(Number.NaN, 100), 0);
  assert.equal(progressFraction(undefined), 0);
});

test('no value or the flag means indeterminate', () => {
  assert.equal(isIndeterminate(undefined), true);
  assert.equal(isIndeterminate(Number.NaN), true);
  assert.equal(isIndeterminate(40, true), true);
  assert.equal(isIndeterminate(40), false);
});

test('progressA11y: determinate reports value; indeterminate drops aria-valuenow and sets busy', () => {
  const on = progressA11y({ value: 30, max: 60, label: 'Upload' });
  assert.equal(on.role, 'progressbar');
  assert.equal(on['aria-valuenow'], 30);
  assert.equal(on['aria-valuemax'], 60);
  assert.equal(on['aria-valuetext'], '50%');
  assert.equal(on['aria-busy'], false);
  assert.equal(on['aria-label'], 'Upload');
  const busy = progressA11y({ indeterminate: true });
  assert.equal(busy['aria-valuenow'], undefined);
  assert.equal(busy['aria-busy'], true);
  assert.equal(busy['aria-valuetext'], 'Loading');
  assert.equal(progressA11y({ value: 500, max: 100 })['aria-valuenow'], 100);
  assert.equal(progressA11y({ value: 1, max: -4 })['aria-valuemax'], 100);
});

test('litCount: started shows one, nearly done never shows all', () => {
  assert.equal(litCount(0, 10), 0);
  assert.equal(litCount(0.01, 10), 1);
  assert.equal(litCount(0.55, 10), 5);
  assert.equal(litCount(0.999, 10), 9);
  assert.equal(litCount(1, 10), 10);
  assert.equal(litCount(0.5, 0), 0);
});

test('blockFills builds left to right with one partial block', () => {
  assert.deepEqual(blockFills(0.5, 4), [1, 1, 0, 0]);
  const partial = blockFills(0.6, 4);
  assert.deepEqual(partial.slice(0, 2), [1, 1]);
  assert.ok(Math.abs(partial[2]! - 0.4) < 1e-9);
  assert.equal(partial[3], 0);
  assert.deepEqual(blockFills(2, 3), [1, 1, 1]);
});

test('quantize rounds down to whole floors', () => {
  assert.equal(quantize(0.49, 4), 0.25);
  assert.equal(quantize(0.5, 4), 0.5);
  assert.equal(quantize(1, 4), 1);
});

test('skylines are deterministic, in range, and shaped by district', () => {
  assert.deepEqual(skylineHeights(12, 'downtown', 3), skylineHeights(12, 'downtown', 3));
  for (const d of DISTRICTS) {
    for (const h of skylineHeights(40, d, 2)) assert.ok(h > 0 && h <= 1, `${d} ${h}`);
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  assert.ok(mean(skylineHeights(80, 'harlem')) < mean(skylineHeights(80, 'megacity')));
});

test('size, angle and int helpers', () => {
  const sizes = { sm: 10, md: 20 };
  assert.equal(resolveSize('sm', sizes, 'md'), 10);
  assert.equal(resolveSize(33, sizes, 'md'), 33);
  assert.equal(resolveSize(undefined, sizes, 'md'), 20);
  assert.deepEqual(ringAngles(4), [0, 90, 180, 270]);
  assert.equal(clampInt(20, 2, 8, 5), 8);
  assert.equal(clampInt(undefined, 2, 8, 5), 5);
  assert.equal(percentLabel(0.456), '46%');
});
