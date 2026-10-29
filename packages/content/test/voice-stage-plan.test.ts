import { isBabble } from '@acme/core';
import { describe, expect, it } from 'vitest';
import { FALLBACK_MON_LINGO, parseMonLingo } from '../lingo/index.ts';
import { babbleInventory, gateMonLine, monSpeechRequest, monVoiceRef, planMonUtterance, readMonVoiceRef } from '../mon-voice.ts';

const NOW = Date.UTC(2026, 9, 29, 12);
const HOUR = 3_600_000;
const LINEAGES = { ratti: 'dex-001/female/1', kittee: 'dex-008/male/2', yotito: 'dex-061/female/3' } as const;

describe('Decision 32 through the planner: one gate for every surface', () => {
  it('an Egg babbles in its lineage voice, pitched highest, with its egg and family sounds available', () => {
    const ref = monVoiceRef({ voiceLineageId: LINEAGES.ratti, stage: 'Egg' }, NOW)!;
    expect(ref.voiceStage).toBe('baby-talk');
    const plan = planMonUtterance('Hello Callah, I love you!', ref);
    expect(plan.gated).toBe(true);
    expect(plan.voiceStage).toBe('baby-talk');
    expect(isBabble(plan.caption, babbleInventory({ lineageId: LINEAGES.ratti }, 'Egg'))).toBe(true);
    expect(plan.caption).not.toMatch(/hello|callah|caller|love/i);
    expect(plan.voice).toMatchObject({ kind: 'lineage', lineageId: LINEAGES.ratti, pitchFactor: 1.45 });
    expect(babbleInventory({ lineageId: LINEAGES.ratti }, 'Egg').sounds).toEqual(expect.arrayContaining(['mm', 'skree']));
  });

  it('a Squeaklet babbles for 24 hours after hatching, then says Bet!, never a sentence or Callah', () => {
    const squeaklet = { voiceLineageId: LINEAGES.ratti, stage: 'Baby' as const, hatchedAt: NOW - 2 * HOUR };
    const day1 = planMonUtterance('Bet!', monVoiceRef(squeaklet, NOW)!);
    expect(day1.voiceStage).toBe('baby-talk');
    expect(day1.gated).toBe(true);
    expect(day1.caption).not.toMatch(/bet/i);

    const day2Ref = monVoiceRef(squeaklet, NOW + 23 * HOUR)!;
    expect(planMonUtterance('Bet!', day2Ref)).toMatchObject({ voiceStage: 'limited', gated: false, caption: 'Bet!' });
    expect(planMonUtterance('Food?', day2Ref).caption).toBe('Food?');
    for (const bad of ["Yeah Callah, I'm good.", 'Food now please', 'Callah!']) {
      const plan = planMonUtterance(bad, day2Ref);
      expect(plan.gated, bad).toBe(true);
      expect(plan.caption, bad).not.toMatch(/callah|caller|good|please/i);
    }
  });

  it.each([
    ['Kittee Cee', LINEAGES.kittee, ['mrrp', 'prrrt']],
    ['Yotito', LINEAGES.yotito, ['yiip', 'awooo']],
    ['Hood Ratti', LINEAGES.ratti, ['skree', 'chk']],
  ] as const)('%s babbles with its own family sound and keeps one lineage', (_name, lineageId, sounds) => {
    const inventory = babbleInventory({ lineageId }, 'Baby');
    expect(inventory.sounds).toEqual(sounds);
    const ref = monVoiceRef({ voiceLineageId: lineageId, stage: 'Baby', hatchedAt: NOW }, NOW)!;
    const plan = planMonUtterance('Hi there!', ref);
    expect(isBabble(plan.caption, inventory)).toBe(true);
    expect(plan.ref?.lineageId).toBe(lineageId);
  });

  it('a later form is untouched, and a client claim never grants more speech than the stage allows', () => {
    expect(planMonUtterance("Yeah Callah, I'm good.", { lineageId: LINEAGES.ratti, stage: 'Small', voiceStage: 'full' }).gated).toBe(false);
    expect(gateMonLine('I am a big talker now', { lineageId: LINEAGES.ratti, stage: 'Egg', voiceStage: 'full' }).voiceStage).toBe('baby-talk');
    expect(gateMonLine('I am a big talker now', { lineageId: LINEAGES.ratti, stage: 'Baby', voiceStage: 'full' }).voiceStage).toBe('limited');
  });

  it('the same turn babbles the same on every surface (seeded), and differs across turns', () => {
    const ref = { lineageId: LINEAGES.ratti, stage: 'Egg' as const, voiceStage: 'baby-talk' as const };
    expect(planMonUtterance('hi', ref, FALLBACK_MON_LINGO, { seed: 't1' }).caption).toBe(planMonUtterance('hi', ref, FALLBACK_MON_LINGO, { seed: 't1' }).caption);
    const many = new Set(Array.from({ length: 12 }, (_, i) => planMonUtterance('hi', ref, FALLBACK_MON_LINGO, { seed: `t${i}` }).caption));
    expect(many.size).toBeGreaterThan(6);
  });

  it('carries the voice stage through mon.voice JSON and the speech request', () => {
    const ref = monVoiceRef({ voiceLineageId: LINEAGES.ratti, stage: 'Baby', hatchedAt: NOW }, NOW)!;
    expect(readMonVoiceRef(JSON.parse(JSON.stringify(ref)))).toEqual(ref);
    expect(readMonVoiceRef({ ...ref, voiceStage: 'shouting' })).toEqual({ lineageId: ref.lineageId, stage: 'Baby' });
    expect(monSpeechRequest('Bwa!', ref)).toEqual({ text: 'Bwa!', lineageId: ref.lineageId, stage: 'Baby', voiceStage: 'baby-talk' });
  });

  it('lingo served before the babble rows still babbles, from the fallback syllables', () => {
    const old = parseMonLingo({ ...JSON.parse(JSON.stringify(FALLBACK_MON_LINGO)), babble: undefined })!;
    expect(old.babble).toEqual([]);
    expect(babbleInventory({ lineageId: LINEAGES.ratti }, 'Baby', old).syllables.length).toBeGreaterThan(0);
    expect(planMonUtterance('hello', { lineageId: LINEAGES.ratti, stage: 'Egg' }, old).gated).toBe(true);
  });
});
