import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONTROL_TONES, DISTRICTS, DISTRICT_CHART_TONE, DISTRICT_NAME, DISTRICT_TONE, DISTRICT_TONES, THEMES, TONES, TONE_CLASSES,
  resolveControlTone, resolveTone,
} from './index.ts';

test('one district list drives names, tones, chart tones and themes', () => {
  assert.deepEqual([...DISTRICTS], ['downtown', 'midtown', 'harlem', 'megacity']);
  for (const map of [DISTRICT_NAME, DISTRICT_TONE, DISTRICT_TONES, DISTRICT_CHART_TONE, THEMES]) {
    assert.deepEqual(Object.keys(map).sort(), [...DISTRICTS].sort());
  }
});

test('control and surface resolvers agree on the district tone', () => {
  for (const d of DISTRICTS) assert.equal(resolveControlTone(undefined, d), resolveTone(d));
});

test('every tone carries every class role', () => {
  assert.deepEqual(Object.keys(TONE_CLASSES).sort(), [...TONES].sort());
  for (const t of CONTROL_TONES) {
    for (const v of Object.values(TONE_CLASSES[t])) assert.ok(typeof v === 'string' && v.length > 0);
  }
  // Harlem controls keep the lighter edge they shipped with.
  assert.equal(TONE_CLASSES.brick.controlBorder, 'border-orange-700');
  assert.equal(TONE_CLASSES.brick.border, 'border-orange-800');
});
