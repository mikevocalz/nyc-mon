import assert from 'node:assert/strict';
import test from 'node:test';
import { cornerPieces } from './accent-frame-model.ts';
import { itemSide, segmentServed, stationStates } from './timeline-model.ts';
import { DISTRICTS, DISTRICT_TONES, resolveAccent, resolveTone, TONE_CLASSES } from './tones.ts';

test('every district has a tone and accent with class strings', () => {
  for (const d of DISTRICTS) {
    const { tone, accent } = DISTRICT_TONES[d];
    assert.notEqual(tone, accent);
    assert.match(TONE_CLASSES[tone].face, /^bg-/);
  }
});

test('resolveTone: tokens and NeonBlade presets override, unknown colours fall back to the district', () => {
  assert.equal(resolveTone('harlem'), 'brick');
  assert.equal(resolveTone('downtown', 'cyan'), 'carolina');
  assert.equal(resolveTone('downtown', 'pink'), 'apple');
  assert.equal(resolveTone('midtown', 'leaf'), 'leaf');
  assert.equal(resolveTone('midtown', 'brick'), 'brick');
  assert.equal(resolveTone('megacity', '#ff00ff'), 'carolina');
  assert.equal(resolveTone('midtown', 'silver'), 'orange');
});

test('resolveAccent never repeats the tone', () => {
  for (const d of DISTRICTS) {
    for (const t of ['orange', 'royal', 'carolina', 'leaf', 'apple', 'brick', 'white'] as const) {
      assert.notEqual(resolveAccent(d, t), t);
    }
  }
});

test('stationStates: served up to the active stop, upcoming after; none active means all served', () => {
  assert.deepEqual(stationStates([{}, { active: true }, {}]), ['served', 'current', 'upcoming']);
  assert.deepEqual(stationStates([{}, {}]), ['served', 'served']);
  const states = stationStates([{}, {}, { active: true }, {}]);
  assert.equal(segmentServed(states, 0), true);
  assert.equal(segmentServed(states, 1), true);
  assert.equal(segmentServed(states, 2), false);
});

test('itemSide: alternate zig-zags on regular screens, stacks on compact', () => {
  assert.equal(itemSide('left', 3, false), 'right');
  assert.equal(itemSide('right', 0, false), 'left');
  assert.deepEqual([0, 1, 2].map((i) => itemSide('alternate', i, false)), ['right', 'left', 'right']);
  assert.deepEqual([0, 1].map((i) => itemSide('alternate', i, true)), ['right', 'right']);
});

test('corner pieces: setback steps inward, cornice carries dentils, square is one L', () => {
  assert.equal(cornerPieces('square', 4).length, 2);
  const setback = cornerPieces('setback', 4);
  assert.deepEqual(setback.map((p) => p.x), [0, 0, 4, 4, 8, 8]);
  const cornice = cornerPieces('cornice', 4);
  assert.equal(cornice.filter((p) => p.shade === 'side').length, 6);
  assert.equal(cornice[0]!.height, 7);
});
