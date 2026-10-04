import assert from 'node:assert/strict';
import test from 'node:test';
import { MULTI_BROWSE_SHARE, autoplayStep, nativeSliderLayout, slideLabels } from './card-slider-native-model.ts';

test('uncontained matches the web slider metrics', () => {
  const l = nativeSliderLayout('uncontained', 390, 6, 2, 16);
  assert.equal(l.visible, 2);
  assert.equal(l.maxIndex, 4);
  assert.equal(l.itemWidth, (390 - 16) / 2);
  assert.equal(l.stride, l.itemWidth + 16);
});

test('hero and multi-browse settle on every card, one at a time', () => {
  const hero = nativeSliderLayout('hero', 390, 6, 3, 16);
  assert.deepEqual([hero.visible, hero.maxIndex, hero.itemWidth], [1, 5, 390]);
  const multi = nativeSliderLayout('multiBrowse', 400, 6, 1, 8);
  assert.deepEqual([multi.visible, multi.maxIndex], [1, 5]);
  assert.equal(multi.itemWidth, Math.round(400 * MULTI_BROWSE_SHARE));
});

test('an empty slider has nowhere to go', () => {
  assert.equal(nativeSliderLayout('hero', 390, 0, 1, 16).maxIndex, 0);
});

test('autoplay steps, wraps with loop, and stops without it', () => {
  assert.equal(autoplayStep(0, 3, false), 1);
  assert.equal(autoplayStep(3, 3, false), null);
  assert.equal(autoplayStep(3, 3, true), 0);
  assert.equal(autoplayStep(0, 0, true), null);
});

test('each card gets a spoken label', () => {
  assert.deepEqual(slideLabels(3), ['Card 1 of 3', 'Card 2 of 3', 'Card 3 of 3']);
});
