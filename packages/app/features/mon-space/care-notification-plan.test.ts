import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CARE_HORIZON_MS,
  COALESCE_MS,
  MAX_CARE_NOTIFICATIONS,
  MON_SPACE_PATHNAME,
  careNotificationId,
  isCareNotificationFor,
  parseCareCallData,
  planCareNotifications,
  reconcileCareSchedule,
  type CarePlanInput,
  type PredictedCall,
} from './care-notification-plan.ts';
import { BANNED_CARE_WORDS, CARE_COPY } from './care-copy.ts';

const NOW = Date.UTC(2026, 9, 29, 15, 0);
const MIN = 60_000;
const HOUR = 60 * MIN;

function input(predictions: readonly PredictedCall[], over: Partial<CarePlanInput> = {}): CarePlanInput {
  return { monInstanceId: 'mon-1', monName: 'Squeaklet', now: NOW, predictions, paused: false, enabled: true, ...over };
}

describe('planCareNotifications', () => {
  it('schedules one notification per predicted real call, in time order', () => {
    const plan = planCareNotifications(input([
      { kind: 'social', at: NOW + 3 * HOUR },
      { kind: 'hunger', at: NOW + 1 * HOUR },
    ]));
    assert.deepEqual(plan.map((p) => [p.callKind, p.at]), [['hunger', NOW + HOUR], ['social', NOW + 3 * HOUR]]);
  });

  it('never schedules a false call, even if one is passed in', () => {
    const plan = planCareNotifications(input([
      { kind: 'false-call', at: NOW + HOUR },
      { kind: 'energy', at: NOW + 2 * HOUR },
    ]));
    assert.deepEqual(plan.map((p) => p.callKind), ['energy']);
  });

  it('schedules nothing while paused', () => {
    assert.deepEqual(planCareNotifications(input([{ kind: 'hunger', at: NOW + HOUR }], { paused: true })), []);
  });

  it('schedules nothing when alerts are off or not permitted', () => {
    assert.deepEqual(planCareNotifications(input([{ kind: 'hunger', at: NOW + HOUR }], { enabled: false })), []);
  });

  it('drops calls already open or past, and calls beyond the 24 h horizon', () => {
    const plan = planCareNotifications(input([
      { kind: 'hunger', at: NOW },
      { kind: 'cold', at: NOW - MIN },
      { kind: 'social', at: NOW + CARE_HORIZON_MS },
      { kind: 'energy', at: NOW + CARE_HORIZON_MS + 1 },
    ]));
    assert.deepEqual(plan.map((p) => p.callKind), ['social']);
  });

  it('folds calls that land within five minutes of each other into the first', () => {
    const plan = planCareNotifications(input([
      { kind: 'bedtime', at: NOW + 6 * HOUR },
      { kind: 'energy', at: NOW + 6 * HOUR + COALESCE_MS - 1 },
      { kind: 'hunger', at: NOW + 6 * HOUR + COALESCE_MS },
    ]));
    assert.deepEqual(plan.map((p) => p.callKind), ['bedtime', 'hunger']);
  });

  it('caps the plan so the iOS 64-pending limit is never near', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ kind: 'hunger' as const, at: NOW + (i + 1) * 20 * MIN }));
    assert.equal(planCareNotifications(input(many)).length, MAX_CARE_NOTIFICATIONS);
  });

  it('gives stable identifiers: same kind and order, same id, whatever the time', () => {
    const a = planCareNotifications(input([{ kind: 'hunger', at: NOW + HOUR }, { kind: 'hunger', at: NOW + 9 * HOUR }]));
    const b = planCareNotifications(input([{ kind: 'hunger', at: NOW + HOUR + 7 * MIN }, { kind: 'hunger', at: NOW + 10 * HOUR }]));
    assert.deepEqual(a.map((p) => p.identifier), b.map((p) => p.identifier));
    assert.deepEqual(a.map((p) => p.identifier), [careNotificationId('mon-1', 'hunger', 0), careNotificationId('mon-1', 'hunger', 1)]);
  });

  it('has the Mon speak, titled with its name, deep-linking to Mon Space', () => {
    const [first] = planCareNotifications(input([{ kind: 'cold', at: NOW + HOUR }]));
    assert.ok(first);
    assert.equal(first.title, 'Squeaklet');
    assert.equal(first.body, 'Squeaklet has a cold and could use medicine.');
    assert.equal(first.threadIdentifier, 'mon-care:mon-1');
    assert.deepEqual(first.data, { kind: 'mon-care-call', monInstanceId: 'mon-1', callKind: 'cold', at: NOW + HOUR, url: MON_SPACE_PATHNAME });
  });

  it('falls back to a neutral title when the Mon has no name yet', () => {
    const [first] = planCareNotifications(input([{ kind: 'hunger', at: NOW + HOUR }], { monName: '  ' }));
    assert.equal(first?.title, 'Your Mon');
  });
});

describe('care copy', () => {
  it('never uses Law 8, guilt or urgency (no exclamation marks)', () => {
    for (const [key, line] of Object.entries(CARE_COPY)) assert.doesNotMatch(line, BANNED_CARE_WORDS, key);
  });

  it('has a title and body for every real call kind, and nothing for a false call', () => {
    for (const kind of ['hunger', 'energy', 'social', 'cold', 'bedtime']) {
      assert.ok(`notify.call.${kind}.title` in CARE_COPY, kind);
      assert.ok(`notify.call.${kind}.body` in CARE_COPY, kind);
    }
    assert.equal(Object.keys(CARE_COPY).some((k) => k.includes('false')), false);
  });

  it('uses a canon line in place of the body when one exists', () => {
    const [first] = planCareNotifications(input([{ kind: 'hunger', at: NOW + HOUR }], { lines: { hunger: 'Food?' } }));
    assert.equal(first?.body, 'Food?');
    const [blank] = planCareNotifications(input([{ kind: 'hunger', at: NOW + HOUR }], { lines: { hunger: ' ' } }));
    assert.equal(blank?.body, 'Squeaklet is asking for food.');
  });
});

describe('parseCareCallData', () => {
  it('accepts the payload the planner writes', () => {
    const [first] = planCareNotifications(input([{ kind: 'social', at: NOW + HOUR }]));
    assert.deepEqual(parseCareCallData(first?.data), first?.data);
  });

  it('rejects other payloads', () => {
    assert.equal(parseCareCallData({ eggId: 'e', url: '/(home)/hatch' }), null);
    assert.equal(parseCareCallData({ kind: 'mon-care-call', monInstanceId: 'm', callKind: 'false-call', at: 1, url: MON_SPACE_PATHNAME }), null);
    assert.equal(parseCareCallData({ kind: 'mon-care-call', monInstanceId: '', callKind: 'hunger', at: 1, url: MON_SPACE_PATHNAME }), null);
    assert.equal(parseCareCallData({ kind: 'mon-care-call', monInstanceId: 'm', callKind: 'hunger', at: 1, url: 'https://evil.example' }), null);
    assert.equal(parseCareCallData(null), null);
  });
});

describe('reconcileCareSchedule', () => {
  const desired = planCareNotifications(input([{ kind: 'hunger', at: NOW + HOUR }, { kind: 'social', at: NOW + 2 * HOUR }]));
  const asScheduled = (plan: typeof desired) => plan.map((p) => ({ identifier: p.identifier, content: { body: p.body, data: p.data } }));

  it('does nothing when the phone already holds the plan', () => {
    assert.deepEqual(reconcileCareSchedule(asScheduled(desired), desired, 'mon-1'), { cancel: [], schedule: [] });
  });

  it('cancels and re-adds a call whose time moved, so a reschedule never duplicates', () => {
    const moved = planCareNotifications(input([{ kind: 'hunger', at: NOW + HOUR + 10 * MIN }, { kind: 'social', at: NOW + 2 * HOUR }]));
    const out = reconcileCareSchedule(asScheduled(desired), moved, 'mon-1');
    assert.deepEqual(out.cancel, [careNotificationId('mon-1', 'hunger', 0)]);
    assert.deepEqual(out.schedule.map((p) => p.identifier), [careNotificationId('mon-1', 'hunger', 0)]);
  });

  it('cancels calls that are no longer predicted (answered, paused, alerts off)', () => {
    const out = reconcileCareSchedule(asScheduled(desired), [], 'mon-1');
    assert.deepEqual(out.cancel.sort(), desired.map((p) => p.identifier).sort());
    assert.deepEqual(out.schedule, []);
  });

  it('leaves other Mons, egg alerts and schedule reminders alone', () => {
    const others = [
      { identifier: careNotificationId('mon-2', 'hunger', 0), content: { data: { kind: 'mon-care-call' } } },
      { identifier: 'egg-ready-e1', content: { data: { eggId: 'e1' } } },
      { identifier: 'abc', content: { data: { scheduleEventId: 'x', kind: 'battle' } } },
    ];
    assert.deepEqual(reconcileCareSchedule(others, [], 'mon-1').cancel, []);
  });

  it('matches only this Mon by identifier prefix', () => {
    assert.equal(isCareNotificationFor(careNotificationId('mon-1', 'cold', 0), 'mon-1'), true);
    assert.equal(isCareNotificationFor(careNotificationId('mon-10', 'cold', 0), 'mon-1'), false);
  });
});
