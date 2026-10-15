import { describe, expect, it } from 'vitest';
import { advanceCare, applyCareAction, listUnmetNeeds } from '../sim/care.ts';
import { step } from '../sim/step.ts';
import { DEFAULT_CARE_TUNING } from '../sim/tuning.ts';
import type { SimState } from '../sim/state.ts';
import { forAll, HOUR, makeState, MINUTE, randomAction, T0 } from './harness.ts';

const NEEDS = ['energy', 'fullness', 'social'] as const;

describe('meter bounds (property)', () => {
  it('keeps energy, fullness, social and bond in [0, 1] under any action sequence', () => {
    forAll(
      2_000,
      (random) => {
        let at = T0;
        const actions = Array.from({ length: 40 }, () => {
          at += Math.floor(random() * 10 * HOUR);
          return { at, action: randomAction(random) };
        });
        return { state: makeState(random), actions };
      },
      ({ state, actions }) => {
        let s: SimState = state;
        for (const { at, action } of actions) {
          s = applyCareAction(s, action, at).state;
          for (const need of NEEDS) {
            expect(s.care[need]).toBeGreaterThanOrEqual(0);
            expect(s.care[need]).toBeLessThanOrEqual(1);
          }
          expect(s.mon.bond).toBeGreaterThanOrEqual(0);
          expect(s.mon.bond).toBeLessThanOrEqual(1);
        }
      },
    );
  });

  it('never moves updatedAt backwards, even for a stale action time', () => {
    const state = step(makeState(), T0 + 5 * HOUR, 1).state;
    const result = applyCareAction(state, { kind: 'play', quality: 1 }, T0 + HOUR);
    expect(result.state.care.updatedAt).toBe(T0 + 5 * HOUR);
  });
});

describe('meter curves are monotone between events', () => {
  it('awake: every meter is non-increasing as time passes with no actions', () => {
    forAll(
      500,
      (random) => makeState(random),
      (state) => {
        let prev = state;
        for (let k = 1; k <= 60; k++) {
          const next = advanceCare(state, T0 + k * 10 * MINUTE).state;
          if (next.care.activity.kind !== 'awake') break;
          for (const need of NEEDS) expect(next.care[need]).toBeLessThanOrEqual(prev.care[need]);
          prev = next;
        }
      },
    );
  });

  it('asleep: energy is non-decreasing, fullness and social non-increasing, until waking', () => {
    forAll(
      500,
      (random) => applyCareAction(makeState(random), { kind: 'rest' }, T0).state,
      (asleep) => {
        let prev = asleep;
        for (let k = 1; k <= 60; k++) {
          const next = advanceCare(asleep, T0 + k * 5 * MINUTE).state;
          if (next.care.activity.kind !== 'asleep') break;
          expect(next.care.energy).toBeGreaterThanOrEqual(prev.care.energy);
          expect(next.care.fullness).toBeLessThanOrEqual(prev.care.fullness);
          expect(next.care.social).toBeLessThanOrEqual(prev.care.social);
          prev = next;
        }
      },
    );
  });
});

describe('care actions', () => {
  it('requests food autonomously once Fullness falls below the request line', () => {
    const state = makeState();
    const { events, state: after } = advanceCare(state, T0 + 3 * HOUR);
    const request = events.find((e) => e.type === 'food-requested');
    expect(request).toBeDefined();
    // 0.5 → 0.4 at 1/20 per hour is 2 hours.
    expect(request?.at).toBe(T0 + 2 * HOUR);
    expect(after.care.pendingRequest).toEqual({ need: 'fullness', since: T0 + 2 * HOUR });
  });

  it('feeding clears the request and raises bond more when answering one', () => {
    const hungry = advanceCare(makeState(), T0 + 3 * HOUR).state;
    expect(hungry.care.pendingRequest).not.toBeNull();
    const fed = applyCareAction(hungry, { kind: 'feed', food: { foodClassId: 'f', nutrition: 0.4 } }, T0 + 3 * HOUR);
    expect(fed.outcome).toEqual({ kind: 'eaten' });
    expect(fed.state.care.pendingRequest).toBeNull();
    expect(fed.state.mon.bond).toBeCloseTo(
      hungry.mon.bond + DEFAULT_CARE_TUNING.feedBondGain + DEFAULT_CARE_TUNING.answeredRequestBondGain,
      12,
    );
  });

  it('overfeeding makes the Mon sluggish, never sick, and sluggishness ends on its own', () => {
    let s = makeState();
    s = applyCareAction(s, { kind: 'feed', food: { foodClassId: 'f', nutrition: 0.5 } }, T0).state;
    const over = applyCareAction(s, { kind: 'feed', food: { foodClassId: 'f', nutrition: 0.5 } }, T0 + MINUTE);
    expect(over.outcome.kind).toBe('overfed');
    expect(over.state.care.sluggishUntil).toBe(T0 + MINUTE + DEFAULT_CARE_TUNING.sluggishDurationMs);
    const declined = applyCareAction(over.state, { kind: 'feed', food: { foodClassId: 'f', nutrition: 0.1 } }, T0 + 2 * MINUTE);
    expect(declined.outcome).toEqual({ kind: 'declined', reason: 'sluggish' });
    const later = advanceCare(over.state, T0 + 2 * HOUR);
    expect(later.events.some((e) => e.type === 'sluggish-ended')).toBe(true);
    expect(later.state.care.sluggishUntil).toBeNull();
  });

  it('sluggish Energy drains faster than normal', () => {
    const base = makeState();
    const sluggish: SimState = { ...base, care: { ...base.care, sluggishUntil: T0 + 10 * HOUR } };
    const a = advanceCare(base, T0 + HOUR).state.care.energy;
    const b = advanceCare(sluggish, T0 + HOUR).state.care.energy;
    expect(b).toBeLessThan(a);
  });

  it('sleeping recovers Energy and the Mon wakes itself when full', () => {
    const tired: SimState = { ...makeState(), care: { ...makeState().care, energy: 0.2 } };
    const asleep = applyCareAction(tired, { kind: 'rest' }, T0);
    expect(asleep.outcome).toEqual({ kind: 'fell-asleep' });
    const later = advanceCare(asleep.state, T0 + 4 * HOUR);
    expect(later.state.care.activity.kind).toBe('awake');
    expect(later.events.find((e) => e.type === 'woke')).toEqual({ type: 'woke', cause: 'rested', at: T0 + 2.4 * HOUR });
  });

  it('waking early costs Social; feeding or playing while asleep is declined', () => {
    const tired: SimState = { ...makeState(), care: { ...makeState().care, energy: 0.2 } };
    const asleep = applyCareAction(tired, { kind: 'rest' }, T0).state;
    expect(applyCareAction(asleep, { kind: 'play', quality: 1 }, T0 + MINUTE).outcome).toEqual({
      kind: 'declined',
      reason: 'asleep',
    });
    const woke = applyCareAction(asleep, { kind: 'wake' }, T0 + 10 * MINUTE);
    expect(woke.outcome).toEqual({ kind: 'woke', early: true });
    const socialBefore = advanceCare(asleep, T0 + 10 * MINUTE).state.care.social;
    expect(woke.state.care.social).toBeCloseTo(socialBefore - DEFAULT_CARE_TUNING.earlyWakeSocialCost, 12);
  });

  it('play raises Social and bond, costs Energy, and needs enough Energy', () => {
    const s = makeState();
    const played = applyCareAction(s, { kind: 'play', quality: 1 }, T0);
    expect(played.state.care.social).toBeGreaterThan(s.care.social);
    expect(played.state.mon.bond).toBeGreaterThan(s.mon.bond);
    expect(played.state.care.energy).toBeLessThan(s.care.energy);
    const exhausted: SimState = { ...s, care: { ...s.care, energy: 0.05 } };
    expect(applyCareAction(exhausted, { kind: 'play', quality: 1 }, T0).outcome.kind).toBe('declined');
  });

  it('reports needs-you crossings and lists unmet needs', () => {
    const { events, state } = advanceCare(makeState(), T0 + 24 * HOUR);
    expect(events.some((e) => e.type === 'needs-attention' && e.need === 'fullness')).toBe(true);
    expect(listUnmetNeeds(state.care)).toContain('fullness');
  });
});
