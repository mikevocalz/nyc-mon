import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { allowsLocalReminder, isLegacyMealReminder, legacyMealReminderIds } from './reminder-policy.ts';

describe('allowsLocalReminder', () => {
  it('never lets a meal set a phone reminder', () => {
    for (const kind of ['breakfast', 'lunch', 'dinner'] as const) {
      assert.equal(allowsLocalReminder({ kind, recurrence: 'daily' }), false, kind);
      assert.equal(allowsLocalReminder({ kind, recurrence: 'none' }), false, kind);
    }
  });

  it('keeps one-off reminders for play dates and battles', () => {
    assert.equal(allowsLocalReminder({ kind: 'play-date', recurrence: 'none' }), true);
    assert.equal(allowsLocalReminder({ kind: 'battle' }), true);
  });

  it('refuses any daily repeat, whatever the kind', () => {
    assert.equal(allowsLocalReminder({ kind: 'custom', recurrence: 'daily' }), false);
  });
});

describe('isLegacyMealReminder', () => {
  const meal = (kind: string) => ({ identifier: `id-${kind}`, content: { data: { scheduleEventId: 'e1', monId: 'm1', kind } } });

  it('matches the daily meal payload older builds scheduled', () => {
    assert.equal(isLegacyMealReminder(meal('breakfast')), true);
    assert.equal(isLegacyMealReminder(meal('lunch')), true);
    assert.equal(isLegacyMealReminder(meal('dinner')), true);
  });

  it('leaves play dates, battles, egg alerts and care calls alone', () => {
    assert.equal(isLegacyMealReminder(meal('battle')), false);
    assert.equal(isLegacyMealReminder({ identifier: 'egg-ready-e', content: { data: { eggId: 'e', url: '/(home)/hatch' } } }), false);
    assert.equal(
      isLegacyMealReminder({ identifier: 'mon-care:m:hunger:0', content: { data: { kind: 'mon-care-call', callKind: 'hunger' } } }),
      false,
    );
    assert.equal(isLegacyMealReminder({ identifier: 'x', content: {} }), false);
    assert.equal(isLegacyMealReminder({ identifier: 'x', content: { data: null } }), false);
  });

  it('collects only the meal identifiers', () => {
    assert.deepEqual(legacyMealReminderIds([meal('breakfast'), meal('battle'), meal('dinner')]), ['id-breakfast', 'id-dinner']);
  });
});

describe('event-integrations.native.ts', () => {
  const source = readFileSync(new URL('./event-integrations.native.ts', import.meta.url), 'utf8');

  it('no longer carries meal-time notification copy', () => {
    assert.doesNotMatch(source, /Breakfast time|Lunch time|Dinner time|ready to eat/);
  });

  it('no longer schedules a DAILY trigger', () => {
    assert.doesNotMatch(source, /SchedulableTriggerInputTypes\.DAILY/);
  });
});
