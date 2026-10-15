import assert from 'node:assert/strict';
import test from 'node:test';
import { isHeadsetAndroid } from './headset.ts';

test('Quest and PICO report as headsets; phones, iOS and the web do not', () => {
  assert.equal(isHeadsetAndroid('android', { Manufacturer: 'Oculus', Brand: 'oculus' }), true);
  assert.equal(isHeadsetAndroid('android', { Manufacturer: 'Meta', Brand: 'Meta' }), true);
  assert.equal(isHeadsetAndroid('android', { Manufacturer: 'Pico', Brand: 'Pico' }), true);
  assert.equal(isHeadsetAndroid('android', { Manufacturer: 'Google', Brand: 'google' }), false);
  assert.equal(isHeadsetAndroid('android', { Manufacturer: 'Metal Corp' }), false);
  assert.equal(isHeadsetAndroid('android', undefined), false);
  assert.equal(isHeadsetAndroid('ios', { Manufacturer: 'Oculus' }), false);
  assert.equal(isHeadsetAndroid('web', undefined), false);
});
