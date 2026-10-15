import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectHardwareFamily,
  retainHardwareFamily,
  type HardwareEvidence,
} from './hardware-family.ts';

const none: HardwareEvidence = {
  os: 'ios',
  headset: false,
  isPad: false,
  smallestScreenDp: null,
  divisionSeen: false,
  hardwareColumn: false,
};

test('no evidence is unknown, never an ordinary phone', () => {
  assert.equal(detectHardwareFamily(none), 'unknown');
  assert.equal(detectHardwareFamily({ ...none, os: 'android', smallestScreenDp: 411 }), 'unknown');
});

test('a reported hinge division identifies a foldable', () => {
  assert.equal(detectHardwareFamily({ ...none, os: 'android', smallestScreenDp: 673, divisionSeen: true }), 'foldable');
});

test('an Apple reserved hardware column identifies a dual-screen device', () => {
  assert.equal(detectHardwareFamily({ ...none, hardwareColumn: true }), 'foldable');
});

test('iPad is a tablet', () => {
  assert.equal(detectHardwareFamily({ ...none, isPad: true }), 'tablet');
});

test('Android sw600dp screen is a tablet; the window size plays no part', () => {
  assert.equal(detectHardwareFamily({ ...none, os: 'android', smallestScreenDp: 600 }), 'tablet');
  assert.equal(detectHardwareFamily({ ...none, os: 'android', smallestScreenDp: 599 }), 'unknown');
  // smallestScreenDp is ignored on iOS: an iPhone screen size says nothing.
  assert.equal(detectHardwareFamily({ ...none, smallestScreenDp: 700 }), 'unknown');
});

test('Quest/PICO headset wins over every other signal', () => {
  assert.equal(
    detectHardwareFamily({ ...none, os: 'android', headset: true, smallestScreenDp: 800, divisionSeen: true }),
    'headset',
  );
});

test('web runtime never classifies hardware for navigation', () => {
  assert.equal(detectHardwareFamily({ ...none, os: 'web', divisionSeen: true }), 'unknown');
});

test('scenario 5: unknown at startup then verified foldable resolves and stays resolved', () => {
  const startup = retainHardwareFamily('unknown', 'unknown');
  assert.equal(startup, 'unknown');
  const unfolded = retainHardwareFamily(startup, 'foldable');
  assert.equal(unfolded, 'foldable');
  // Folding to the cover drops the hinge event; the family must not regress.
  assert.equal(retainHardwareFamily(unfolded, 'unknown'), 'foldable');
});

test('a foldable first read as a tablet upgrades to foldable and never back', () => {
  assert.equal(retainHardwareFamily('tablet', 'foldable'), 'foldable');
  assert.equal(retainHardwareFamily('foldable', 'tablet'), 'foldable');
});

test('a verified phone that later reports a hinge becomes a foldable', () => {
  assert.equal(retainHardwareFamily('phone', 'foldable'), 'foldable');
  assert.equal(retainHardwareFamily('phone', 'unknown'), 'phone');
});
