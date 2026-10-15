import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createEggRecord, createHatchState, createInitialCareState, transitionHatch } from '@acme/core/sim';
import type { CareState } from '@acme/core/types';
import { HATCH_COPY } from '../hatch/copy.ts';
import { resolveHatchEntry } from '../hatch/hatch-sequence.ts';
import { detailLine, incubationView, minutesLeft, timeLine } from '../hatch/incubation-model.ts';
import { COMPANION_COPY } from './copy.ts';
import { askRoute, homeStatus } from './home-model.ts';
import { msToNextMinute } from './minute-clock-math.ts';

const T0 = new Date(2026, 9, 8, 15, 0, 0).getTime();
const egg = createEggRecord({
  eggId: 'egg-1',
  speciesId: 'dex-001',
  hatchesIntoSpeciesId: 'dex-002',
  callerId: 'caller-1',
  nickname: null,
  incubationMinutes: 15,
  createdAt: T0,
});
const END = egg.incubationEndsAt;
const care = (patch: Partial<CareState>): CareState => ({ ...createInitialCareState('mon-1', T0), energy: 0.8, fullness: 0.8, social: 0.8, ...patch });

describe('M11 incubation view (no writes)', () => {
  const hatch = createHatchState(egg);
  it('counts down, then reads ready on the edge and overdue only when entered late', () => {
    assert.equal(incubationView(hatch, egg, END - 1, T0, false), 'counting');
    assert.equal(incubationView(hatch, egg, END, T0, false), 'ready');
    assert.equal(incubationView(hatch, egg, END + 10 * 60_000, END + 30_000, false), 'ready');
    assert.equal(incubationView(hatch, egg, END + 10 * 60_000, END + 60_000, false), 'overdue');
  });
  it('stays ready once latched, even when the clock moves back', () => {
    assert.equal(incubationView(hatch, egg, END - 5 * 60_000, T0, true), 'ready');
  });
  it('reads a presenting hatch as resume', () => {
    const presenting = transitionHatch(hatch, { type: 'open', now: END }, egg);
    assert.equal(incubationView(presenting, egg, END, END, false), 'resume');
  });
  it('rounds minutes up and never says "0 min"', () => {
    assert.equal(minutesLeft(END, END - 61_000), 2);
    assert.equal(timeLine('counting', END, END - 30_000), HATCH_COPY['m11.time.under_minute']);
    assert.equal(timeLine('counting', END, END - 61_000), '2 min left');
  });
  it('words an overdue egg without blame', () => {
    const line = detailLine('overdue', 'Metro Egg', END, END + 2 * 86_400_000, 'en-US');
    assert.ok(line?.startsWith('Ready since '));
    assert.equal(detailLine('overdue', 'Metro Egg', END, END + 86_400_000, 'en-US'), HATCH_COPY['m11.time.overdue.yesterday']);
  });
});

describe('M12 entry', () => {
  const base = { incubationEndsAt: END, hasMon: false, fromM11: false, nowMs: END };
  it('opens at once from M11, waits on the pre state from a notification', () => {
    assert.deepEqual(resolveHatchEntry({ ...base, hatch: createHatchState(egg), fromM11: true }), { kind: 'open-now' });
    assert.deepEqual(resolveHatchEntry({ ...base, hatch: createHatchState(egg) }), { kind: 'pre' });
  });
  it('sends an early entry home and resumes a presenting hatch at its phase', () => {
    assert.deepEqual(resolveHatchEntry({ ...base, hatch: createHatchState(egg), nowMs: END - 1 }), { kind: 'early' });
    const presenting = transitionHatch(transitionHatch(createHatchState(egg), { type: 'open', now: END }, egg), { type: 'advance' }, egg);
    assert.deepEqual(resolveHatchEntry({ ...base, hatch: presenting }), { kind: 'resume', phase: 'scanner' });
  });
  it('treats a second entry after the hatch as already hatched', () => {
    const hatched = transitionHatch(createHatchState(egg), { type: 'skip' }, egg);
    assert.equal(transitionHatch(hatched, { type: 'skip' }, egg), hatched);
    assert.deepEqual(resolveHatchEntry({ ...base, hatch: undefined, hasMon: true }), { kind: 'already' });
    assert.deepEqual(resolveHatchEntry({ ...base, hatch: undefined }), { kind: 'unknown-egg' });
  });
});

describe('M13 answer the ask', () => {
  it('routes food first, then sleep, energy and social; says hi when content', () => {
    assert.equal(askRoute(care({ fullness: 0.1, energy: 0.1 })), '/(home)/feed');
    assert.equal(askRoute(care({ activity: { kind: 'asleep', since: T0 } })), '/(home)/rest');
    assert.equal(askRoute(care({ energy: 0.1 })), '/(home)/rest');
    assert.equal(askRoute(care({ social: 0.1 })), '/(home)/social');
    assert.equal(askRoute(care({})), undefined);
  });
  it('names what the Mon wants and lists several asks', () => {
    assert.equal(homeStatus(care({})).text, COMPANION_COPY['m13.status.content']);
    assert.equal(homeStatus(care({ fullness: 0.1 })).text, COMPANION_COPY['m13.status.food']);
    assert.equal(homeStatus(care({ fullness: 0.1, social: 0.1 })).text, 'Needs you: Fullness, Social');
    assert.equal(homeStatus(care({ fullness: 0.1 })).tone, 'request');
  });
});

describe('copy rules', () => {
  const all = [...Object.values(HATCH_COPY), ...Object.values(COMPANION_COPY)];
  it('has no pronoun for an individual Mon, no "device", no "streak"', () => {
    for (const text of all) {
      assert.doesNotMatch(text, /\b(he|she|him|her|his|hers)\b/i, text);
      assert.doesNotMatch(text, /\bdevice\b|\bstreak/i, text);
    }
  });
  it('never names a later life stage', () => {
    for (const text of all) assert.doesNotMatch(text, /\b(Small|Mid|Max)\b/, text);
  });
});

describe('minute clock', () => {
  it('waits for the next minute boundary', () => {
    assert.equal(msToNextMinute(60_000 * 5 + 15_000), 45_000);
    assert.equal(msToNextMinute(60_000 * 5), 60_000);
  });
});
