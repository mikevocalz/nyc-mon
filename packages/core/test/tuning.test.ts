import { describe, expect, it } from 'vitest';
import { advanceCare, applyCareAction, createInitialCareState, listUnmetNeeds, wouldOverfeed } from '../sim/care.ts';
import { deriveMonMood } from '../sim/scene-input.ts';
import type { SimState } from '../sim/state.ts';
import { DEFAULT_CARE_TUNING } from '../sim/tuning.ts';
import { forAll, HOUR, makeMon, MINUTE, T0 } from './harness.ts';

// D-15d interim tuning: needs-you is not the normal state.
const NEEDS = ['energy', 'fullness', 'social'] as const;
const { returnFloor, sharedMealNutrition, needsAttentionBelow } = DEFAULT_CARE_TUNING;

const hatchling = (): SimState => ({ mon: makeMon({ nickname: null }), care: createInitialCareState('mon_test', T0) });
const withFullness = (fullness: number): SimState => {
  const s = hatchling();
  return { ...s, care: { ...s.care, fullness } };
};

describe('D-15d: a Baby left alone', () => {
  it.each([2, 4])('is not in needs-you %i h after the hatch', (hours) => {
    const { state } = advanceCare(hatchling(), T0 + hours * HOUR);
    expect(listUnmetNeeds(state.care)).toEqual([]);
    expect(deriveMonMood(state.care)).not.toMatch(/^needs-(energy|social)$/);
    for (const need of NEEDS) expect(state.care[need]).toBeGreaterThan(needsAttentionBelow);
  });

  it('raises no needs-you event in the first 4 h', () => {
    const { events } = advanceCare(hatchling(), T0 + 4 * HOUR);
    expect(events.filter((e) => e.type === 'needs-attention')).toEqual([]);
  });

  it('after 24 h away every meter sits at or above the return floor, from any start at or above it', () => {
    forAll(
      1_000,
      (random) => {
        const s = hatchling();
        const lift = (v: number) => returnFloor + v * (1 - returnFloor);
        return { ...s, care: { ...s.care, energy: lift(random()), fullness: lift(random()), social: lift(random()) } };
      },
      (state) => {
        const after = advanceCare(state, T0 + 24 * HOUR).state;
        for (const need of NEEDS) expect(after.care[need]).toBeGreaterThanOrEqual(returnFloor);
      },
    );
  });

  it('a week away lands exactly on the floor, still a request and never empty', () => {
    const after = advanceCare(hatchling(), T0 + 7 * 24 * HOUR).state;
    expect(after.care.fullness).toBe(returnFloor);
    expect(after.care.social).toBe(returnFloor);
    expect(after.care.energy).toBe(returnFloor);
    expect(after.care.pendingRequest).not.toBeNull();
  });

  it('decay never raises a meter an action left below the floor', () => {
    const s = hatchling();
    const low: SimState = { ...s, care: { ...s.care, energy: 0.05 } };
    expect(advanceCare(low, T0 + 10 * HOUR).state.care.energy).toBe(0.05);
  });
});

describe('D-15d: overfeeding is judged on the after-meal value', () => {
  it('a meal that ends at or under the line is eaten, even from high Fullness', () => {
    const fed = applyCareAction(withFullness(0.92), { kind: 'feed', food: { foodClassId: 'f', nutrition: 0.05 } }, T0);
    expect(fed.outcome).toEqual({ kind: 'eaten' });
  });

  it('a meal that would take Fullness past the line overfeeds, even from moderate Fullness', () => {
    const fed = applyCareAction(withFullness(0.7), { kind: 'feed' }, T0);
    expect(fed.outcome.kind).toBe('overfed');
    expect(fed.state.care.fullness).toBe(1);
  });

  it('wouldOverfeed predicts the outcome applyCareAction reports', () => {
    forAll(
      2_000,
      (random) => ({ fullness: random(), nutrition: random() }),
      ({ fullness, nutrition }) => {
        const state = withFullness(fullness);
        const outcome = applyCareAction(state, { kind: 'feed', food: { foodClassId: 'f', nutrition } }, T0).outcome;
        expect(outcome.kind === 'overfed').toBe(wouldOverfeed(state.care, nutrition));
      },
    );
  });
});

describe('D-15e: Share a meal', () => {
  it('a feed with no food adds the shared meal and clears the request', () => {
    const hungry = advanceCare(hatchling(), T0 + 3 * HOUR).state;
    expect(hungry.care.pendingRequest).not.toBeNull();
    const fed = applyCareAction(hungry, { kind: 'feed' }, T0 + 3 * HOUR + MINUTE);
    expect(fed.outcome).toEqual({ kind: 'eaten' });
    const before = advanceCare(hungry, T0 + 3 * HOUR + MINUTE).state.care.fullness;
    expect(fed.state.care.fullness).toBeCloseTo(before + sharedMealNutrition, 12);
    expect(fed.state.care.pendingRequest).toBeNull();
  });
});
