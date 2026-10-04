import { describe, expect, it } from 'vitest';
import { BloodlineSchema, EvolutionNodeSchema } from '../schemas/index.ts';

const leaf = (speciesId: string, dexId: number, stage: 'Mid' | 'Max') => ({
  speciesId,
  dexId,
  formName: `Form ${dexId}`,
  stage,
  evolutionDetails: [],
  evolvesTo: [],
});

describe('Bloodline evolution chain (DECISIONS.md #12)', () => {
  it('parses a nested tree with a branching node', () => {
    const mid = { ...leaf('dex-904', 904, 'Mid'), evolvesTo: [leaf('dex-905', 905, 'Max'), leaf('dex-906', 906, 'Max')] };
    const parsed = BloodlineSchema.parse({ bloodlineId: 'F99', bloodlineName: 'Test', chain: mid });
    expect(parsed.chain.evolvesTo.map((child) => child.speciesId)).toEqual(['dex-905', 'dex-906']);
  });

  it('validates nodes at every depth', () => {
    const badChild = { ...leaf('dex-905', 905, 'Max'), stage: 'Apex' };
    const mid = { ...leaf('dex-904', 904, 'Mid'), evolvesTo: [badChild] };
    expect(EvolutionNodeSchema.safeParse(mid).success).toBe(false);
  });

  it('requires evolutionDetails as a list of event ids, empty allowed', () => {
    expect(EvolutionNodeSchema.safeParse({ ...leaf('dex-905', 905, 'Max'), evolutionDetails: ['evt-1'] }).success).toBe(true);
    expect(EvolutionNodeSchema.safeParse({ ...leaf('dex-905', 905, 'Max'), evolutionDetails: [''] }).success).toBe(false);
    const { evolutionDetails: _omitted, ...missing } = leaf('dex-905', 905, 'Max');
    expect(EvolutionNodeSchema.safeParse(missing).success).toBe(false);
  });

  it('rejects a non-roster bloodline id', () => {
    expect(BloodlineSchema.safeParse({ bloodlineId: 'Yote', bloodlineName: 'Yote', chain: leaf('dex-905', 905, 'Max') }).success).toBe(false);
  });
});
