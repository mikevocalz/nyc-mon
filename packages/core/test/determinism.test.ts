import { describe, expect, it } from 'vitest';
import { applyCareAction } from '../sim/care.ts';
import { step } from '../sim/step.ts';
import { forAll, HOUR, makeState, MINUTE, randomAction, T0, VIGNETTES } from './harness.ts';

describe('step determinism', () => {
  it('returns identical output for identical (state, now, seed) over 10k seeded runs', () => {
    forAll(
      10_000,
      (random) => ({
        state: makeState(random),
        now: T0 + Math.floor(random() * 2 * HOUR),
        seed: Math.floor(random() * 2 ** 32),
      }),
      ({ state, now, seed }) => {
        const a = step(state, now, seed, { vignettes: VIGNETTES });
        const b = step(structuredClone(state), now, seed, { vignettes: VIGNETTES });
        expect(b).toEqual(a);
      },
    );
  });

  it('does not mutate its input state', () => {
    const state = makeState();
    const snapshot = structuredClone(state);
    step(state, T0 + 10 * HOUR, 7, { vignettes: VIGNETTES });
    applyCareAction(state, { kind: 'rest' }, T0 + HOUR);
    expect(state).toEqual(snapshot);
  });

  it('gives the same result whether time advances in one step or many (split invariance)', () => {
    forAll(
      1_000,
      (random) => {
        const state = makeState(random);
        const total = Math.floor(random() * 30 * HOUR);
        const cuts = Array.from({ length: 1 + Math.floor(random() * 6) }, () => T0 + Math.floor(random() * total)).sort(
          (x, y) => x - y,
        );
        return { state, end: T0 + total, cuts };
      },
      ({ state, end, cuts }) => {
        const whole = step(state, end, 1).state;
        let split = state;
        for (const cut of [...cuts, end]) split = step(split, cut, 1).state;
        for (const need of ['energy', 'fullness', 'social'] as const) {
          expect(split.care[need]).toBeCloseTo(whole.care[need], 9);
        }
        expect(split.care.activity.kind).toBe(whole.care.activity.kind);
        expect(split.care.pendingRequest === null).toBe(whole.care.pendingRequest === null);
        if (split.care.pendingRequest !== null && whole.care.pendingRequest !== null) {
          expect(Math.abs(split.care.pendingRequest.since - whole.care.pendingRequest.since)).toBeLessThanOrEqual(1);
        }
      },
    );
  });

  it('is deterministic across replayed action sequences', () => {
    forAll(
      500,
      (random) => {
        let at = T0;
        const actions = Array.from({ length: 20 }, () => {
          at += Math.floor(random() * 3 * HOUR) + MINUTE;
          return { at, action: randomAction(random) };
        });
        return { state: makeState(random), actions };
      },
      ({ state, actions }) => {
        const run = () => actions.reduce((s, { at, action }) => applyCareAction(s, action, at).state, state);
        expect(run()).toEqual(run());
      },
    );
  });
});
