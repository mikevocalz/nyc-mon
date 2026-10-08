import assert from 'node:assert/strict';
import test from 'node:test';
import { MOTION_MARKER_SELECTOR, parseMotionMarker } from './motion-markers.ts';

test('mfx- ids parse as fade targets with the suffix as name', () => {
  assert.deepEqual(parseMotionMarker('mfx-hero-title'), { kind: 'fade', name: 'hero-title' });
  assert.deepEqual(parseMotionMarker('mfx-hlynk-feat-2'), { kind: 'fade', name: 'hlynk-feat-2' });
});

test('mpx- ids parse as scrub (transform-only) targets', () => {
  assert.deepEqual(parseMotionMarker('mpx-world-a'), { kind: 'scrub', name: 'world-a' });
});

test('trg- ids parse as ScrollTrigger anchors', () => {
  assert.deepEqual(parseMotionMarker('trg-hatch'), { kind: 'trigger', name: 'hatch' });
});

test('non-marker ids and bare prefixes return null', () => {
  assert.equal(parseMotionMarker('w01-hatch-title'), null);
  assert.equal(parseMotionMarker('content'), null);
  assert.equal(parseMotionMarker('mfx-'), null);
  assert.equal(parseMotionMarker(''), null);
});

test('ids that merely contain a prefix do not match', () => {
  assert.equal(parseMotionMarker('xmfx-thing'), null);
  assert.equal(parseMotionMarker('foo-mpx-thing'), null);
});

test('the selector covers exactly the three prefixes', () => {
  assert.equal(MOTION_MARKER_SELECTOR, '[id^="mfx-"], [id^="mpx-"], [id^="trg-"]');
});
