import { describe, expect, it } from 'vitest';
import { applyCareAction } from '../sim/care.ts';
import { step } from '../sim/step.ts';
import { scheduleIdleVignettes, vignetteWeight } from '../sim/vignettes.ts';
import { forAll, HOUR, makeMon, makeState, MINUTE, T0, VIGNETTES } from './harness.ts';

describe('seeded idle-vignette scheduler', () => {
  it('is stable however the window is split', () => {
    forAll(
      300,
      (random) => ({ seed: Math.floor(random() * 2 ** 32), cut: T0 + Math.floor(random() * HOUR) }),
      ({ seed, cut }) => {
        const state = makeState();
        const whole = step(state, T0 + HOUR, seed, { vignettes: VIGNETTES }).vignettes;
        const first = step(state, cut, seed, { vignettes: VIGNETTES });
        const second = step(first.state, T0 + HOUR, seed, { vignettes: VIGNETTES });
        expect([...first.vignettes, ...second.vignettes]).toEqual(whole);
      },
    );
  });

  it('changes with the seed', () => {
    const state = makeState();
    const a = step(state, T0 + HOUR, 1, { vignettes: VIGNETTES }).vignettes;
    const b = step(state, T0 + HOUR, 2, { vignettes: VIGNETTES }).vignettes;
    expect(a).not.toEqual(b);
  });

  it('only schedules vignettes eligible for the activity and the bond', () => {
    const lowBond = { ...makeState(), mon: makeMon({ bond: 0.1 }) };
    const awake = step(lowBond, T0 + 6 * HOUR, 3, { vignettes: VIGNETTES }).vignettes;
    expect(awake.length).toBeGreaterThan(0);
    expect(awake.some((v) => v.vignetteId === 'v-awake-bonded')).toBe(false);
    const tired = makeState();
    const asleepState = applyCareAction({ ...tired, care: { ...tired.care, energy: 0 } }, { kind: 'rest' }, T0).state;
    const asleep = step(asleepState, T0 + 20 * MINUTE, 3, { vignettes: VIGNETTES }).vignettes;
    for (const v of asleep) expect(['v-asleep', 'v-any']).toContain(v.vignetteId);
  });

  it('weights bonded vignettes up as bond grows', () => {
    const def = VIGNETTES[1];
    if (def === undefined) throw new Error('fixture');
    expect(vignetteWeight(def, 0.4, 'awake')).toBe(0);
    expect(vignetteWeight(def, 1, 'awake')).toBeGreaterThan(vignetteWeight(def, 0.6, 'awake'));
    const count = (bond: number) =>
      scheduleIdleVignettes({
        table: VIGNETTES,
        bond,
        seed: 11,
        timeline: [{ from: T0, to: T0 + 24 * HOUR, activity: 'awake' }],
      }).filter((v) => v.vignetteId === 'v-awake-bonded').length;
    expect(count(1)).toBeGreaterThan(count(0.6));
  });

  it('schedules nothing for an empty table', () => {
    expect(step(makeState(), T0 + HOUR, 1).vignettes).toEqual([]);
  });
});
