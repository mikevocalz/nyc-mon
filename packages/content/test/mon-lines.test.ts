import { describe, expect, it } from 'vitest';
import { hoodRattiForms } from '../mons/hood-ratti.ts';
import { MON_LINE_OCCASIONS, monLine } from '../mon-lines.ts';
import { planMonUtterance } from '../mon-voice.ts';

const squeaklet = hoodRattiForms.find((f) => f.formName === 'Squeaklet')!;
const lilRatti = hoodRattiForms.find((f) => f.formName === 'Lil’ Ratti')!;

describe('monLine (canon lines only)', () => {
  it('gives a Squeaklet its two canon words (OPEN_QUESTIONS Q32, 2026-10-23)', () => {
    expect(monLine('hello', { speciesId: squeaklet.speciesId, stage: 'Baby' })).toBe('Bet!');
    expect(monLine('first-words', { speciesId: squeaklet.speciesId, stage: 'Baby' })).toBe('Bet!');
    expect(monLine('hungry', { speciesId: squeaklet.speciesId, stage: 'Baby' })).toBe('Food?');
  });

  it('keeps every Baby line to two words, no sentence and no "Callah"', () => {
    for (const occasion of MON_LINE_OCCASIONS) {
      const line = monLine(occasion, { speciesId: squeaklet.speciesId, stage: 'Baby' });
      if (line === undefined) continue;
      expect(line.split(/\s+/).length).toBeLessThanOrEqual(2);
      expect(line).not.toMatch(/callah/i);
    }
  });

  it('has nothing where canon has no line: other forms, other stages, an Egg', () => {
    for (const occasion of MON_LINE_OCCASIONS) {
      expect(monLine(occasion, { speciesId: lilRatti.speciesId, stage: 'Small' })).toBeUndefined();
      expect(monLine(occasion, { speciesId: 'dex-999', stage: 'Baby' })).toBeUndefined();
      expect(monLine(occasion, { speciesId: squeaklet.speciesId, stage: 'Egg' })).toBeUndefined();
    }
  });

  it('every canon line plans to a voiced line with a caption', () => {
    const line = monLine('hungry', { speciesId: squeaklet.speciesId, stage: 'Baby' })!;
    const plan = planMonUtterance(line, { lineageId: 'dex-001/female/1', stage: 'Baby' });
    expect(plan.caption).toBe('Food?');
    expect(plan.voice.kind).toBe('lineage');
  });
});
