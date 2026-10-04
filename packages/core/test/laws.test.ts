import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CareStateSchema, MonInstanceSchema } from '../schemas/index.ts';
import { applyCareAction } from '../sim/care.ts';
import { applyEvolution, PHASE1_FEATURE_FLAGS } from '../sim/evolution.ts';
import { step } from '../sim/step.ts';
import type { EvolutionEvent } from '../types/index.ts';
import { forAll, HOUR, makeMon, makeState, randomAction, T0 } from './harness.ts';

const SIM_DIR = join(import.meta.dirname, '..', 'sim');

describe('Law 3: the sim core is pure TypeScript', () => {
  const files = readdirSync(SIM_DIR).filter((f) => f.endsWith('.ts'));
  const stripComments = (code: string): string => code.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  const sources = files.map((f) => ({ file: f, text: stripComments(readFileSync(join(SIM_DIR, f), 'utf8')) }));

  it('scans every sim file', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(sources)('$file imports only relative modules', ({ text }) => {
    const specifiers = [...text.matchAll(/(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    const dynamic = [...text.matchAll(/(?:import|require)\s*\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
    for (const spec of [...specifiers, ...dynamic]) expect(spec).toMatch(/^\.\.?\//);
  });

  it.each(sources)('$file touches no react, three, expo, DOM, clock or ambient randomness', ({ text }) => {
    expect(text).not.toMatch(/['"](react|react-native|three|expo)[-/'"]/);
    expect(text).not.toMatch(/\b(window|document|navigator|localStorage|requestAnimationFrame)\b/);
    expect(text).not.toMatch(/\bDate\.now\b|\bnew Date\b|\bperformance\.now\b|\bMath\.random\b/);
  });
});

describe('Law 7: Baby stays Baby', () => {
  it('step never changes the lifecycle stage, over long seeded runs with actions', () => {
    forAll(
      2_000,
      (random) => ({ state: makeState(random), random }),
      ({ state, random }) => {
        let s = state;
        let at = T0;
        for (let k = 0; k < 20; k++) {
          at += Math.floor(random() * 48 * HOUR);
          s = applyCareAction(step(s, at, k).state, randomAction(random), at).state;
        }
        expect(s.mon.stage).toBe('Baby');
        expect(s.mon.monInstanceId).toBe(state.mon.monInstanceId);
      },
    );
  });

  const event: EvolutionEvent = {
    eventId: 'evo-test',
    speciesId: 'species-test',
    fromStage: 'Baby',
    toStage: 'Small',
    toSpeciesId: null,
    minBond: 0.2,
  };

  it('blocks an authored EvolutionEvent while the Phase 1 flag is off', () => {
    expect(applyEvolution(makeMon({ bond: 1 }), event, PHASE1_FEATURE_FLAGS)).toEqual({
      kind: 'blocked',
      reason: 'feature-disabled',
    });
  });

  it('with the flag on, evolves one adjacent stage and keeps the same individual', () => {
    const flags = { evolutionEnabled: true };
    const mon = makeMon({ bond: 0.5 });
    const result = applyEvolution(mon, event, flags);
    expect(result).toEqual({ kind: 'evolved', mon: { ...mon, stage: 'Small' } });
    expect(applyEvolution(mon, { ...event, toStage: 'Mid' }, flags)).toEqual({ kind: 'blocked', reason: 'not-adjacent' });
    expect(applyEvolution(makeMon({ bond: 0.1 }), event, flags)).toEqual({ kind: 'blocked', reason: 'bond-too-low' });
    expect(applyEvolution(mon, { ...event, fromStage: 'Small' }, flags)).toEqual({
      kind: 'blocked',
      reason: 'stage-mismatch',
    });
  });
});

describe('Law 8: faint is never death', () => {
  it('CareState and MonInstance carry no hp, health, death or sickness field', () => {
    const keys = [...Object.keys(CareStateSchema.shape), ...Object.keys(MonInstanceSchema.shape)];
    for (const key of keys) expect(key).not.toMatch(/hp|health|dead|death|sick|faint|alive/i);
  });

  it('a fully neglected Mon still exists, keeps its id and stage, and can be cared for', () => {
    const neglected = step(makeState(), T0 + 365 * 24 * HOUR, 9).state;
    expect(neglected.mon.stage).toBe('Baby');
    expect(neglected.care.fullness).toBe(0);
    const fed = applyCareAction(neglected, { kind: 'feed', foodClassId: 'f', nutrition: 0.5 }, T0 + 365 * 24 * HOUR);
    expect(fed.outcome.kind).toBe('eaten');
    expect(fed.state.care.fullness).toBe(0.5);
  });

  it('no sim source names a death, egg-reset or deletion path', () => {
    for (const file of readdirSync(SIM_DIR).filter((f) => f.endsWith('.ts'))) {
      const code = readFileSync(join(SIM_DIR, file), 'utf8').replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '');
      expect(code).not.toMatch(/\b(die|died|death|dead|kill|delete\w*|revertToEgg|resetToEgg)\b/i);
    }
  });
});
