import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldScheduleEggReminder, LATER_PERMISSIONS } from './permissions-model.ts';

describe('first-run permission policy', () => {
  it('never requires camera, microphone or location in order to finish setup', () => {
    assert.deepEqual(LATER_PERMISSIONS, ['camera', 'microphone', 'location']);
  });
  it('schedules the one egg reminder only while the egg is still incubating', () => {
    assert.equal(shouldScheduleEggReminder('granted', 20_000, 10_000), true);
    assert.equal(shouldScheduleEggReminder('granted', 10_000, 10_000), false);
    assert.equal(shouldScheduleEggReminder('granted', undefined, 10_000), false);
    assert.equal(shouldScheduleEggReminder('denied', 20_000, 10_000), false);
    assert.equal(shouldScheduleEggReminder('undetermined', 20_000, 10_000), false);
    assert.equal(shouldScheduleEggReminder('unsupported', 20_000, 10_000), false);
    assert.equal(shouldScheduleEggReminder('granted', NaN, 10_000), false);
  });
});
