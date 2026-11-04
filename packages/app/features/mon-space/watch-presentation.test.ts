import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInitialCareState } from '@acme/core/sim';
import type { MonInstance } from '@acme/core/types';
import { watchPresentation } from './watch-presentation.ts';

const now = Date.UTC(2026, 10, 2, 12);
const mon: MonInstance = {
  monInstanceId: 'watch-mon', callerId: 'caller', speciesId: 'dex-002', nickname: 'Pip',
  stage: 'Baby', hatchedAt: now, bond: 0, gender: null, voiceLineageId: null,
  originBlock: null, habitatTags: [], activeHours: null,
};
const care = createInitialCareState(mon.monInstanceId, now);

test('a first-day Baby never receives the later Baby’s words on the Watch', () => {
  const early = watchPresentation(mon, care, now);
  assert.equal(early.speciesId, 'dex-002');
  assert.ok(early.hello.length > 0);
  assert.notEqual(early.hello, 'Bet!');
  assert.notEqual(early.hungry, 'Food?');
  assert.deepEqual(watchPresentation(mon, care, now + 60000), early,
    'a minute tick must not change a cached reply and spend another WidgetKit reload');
  const later = watchPresentation(mon, care, now + 24 * 60 * 60 * 1000);
  assert.equal(later.hello, 'Bet!');
  assert.equal(later.hungry, 'Food?');
});

test('missing canon never produces invented words for another Mon', () => {
  const subject = { ...mon, speciesId: 'dex-999', stage: 'Small' as const };
  const result = watchPresentation(subject, care, now);
  assert.equal(result.hello, '');
  assert.equal(result.hungry, '');
});
