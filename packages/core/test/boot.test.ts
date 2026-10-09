import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createEmptySave, readBootSave } from '../save/index.ts';
import { type BootSave, type BootSnapshot, resolveBootRoute } from '../sim/boot.ts';
import { createEggRecord, createHatchState, mintMonInstance, transitionHatch } from '../sim/hatch.ts';
import type { AgeAnswer, CallerProfile, ConsentStatus, SaveCurrent } from '../types/index.ts';
import { forAll, MINUTE, T0 } from './harness.ts';

const caller = (consentStatus: ConsentStatus = 'not-required'): CallerProfile => ({
  callerId: 'caller-1',
  callerName: 'Dee',
  birthYear: 2000,
  consentStatus,
  createdAt: T0,
});

const egg = (eggId = 'egg-1', createdAt = T0) =>
  createEggRecord({
    eggId,
    speciesId: 'dex-001',
    hatchesIntoSpeciesId: 'dex-002',
    callerId: 'caller-1',
    nickname: null,
    incubationMinutes: 15,
    createdAt,
  });

/** A hatched Mon after M09: boot sends a named Mon to the companion. */
const namedMon = (e: ReturnType<typeof egg>, nickname = 'Pip') => ({ ...mintMonInstance(e), nickname });

const loaded = (save: SaveCurrent): BootSave => ({ status: 'loaded', save });
const withCaller = (overrides: Partial<SaveCurrent> = {}, consent: ConsentStatus = 'not-required'): SaveCurrent => ({
  ...createEmptySave('device-a', T0),
  caller: caller(consent),
  ...overrides,
});

const snapshot = (overrides: Partial<BootSnapshot> = {}): BootSnapshot => ({
  save: { status: 'missing' },
  hasSession: false,
  ageAnswer: undefined,
  nowMs: T0,
  ...overrides,
});

const adult: AgeAnswer = { birthYear: 2000, answeredAtMs: T0 };
const child: AgeAnswer = { birthYear: 2016, answeredAtMs: T0 };

describe('resolveBootRoute (M01)', () => {
  it('no save -> first-run', () => {
    expect(resolveBootRoute(snapshot())).toEqual({ kind: 'first-run' });
  });

  it('save with caller: null and no session -> first-run', () => {
    expect(resolveBootRoute(snapshot({ save: loaded(createEmptySave('d', T0)) }))).toEqual({ kind: 'first-run' });
  });

  it('save unreadable -> save-recovered with the loader reason', () => {
    expect(resolveBootRoute(snapshot({ save: { status: 'unreadable', reason: 'corrupt' } }))).toEqual({
      kind: 'save-recovered',
      reason: 'corrupt',
    });
  });

  it('an egg whose timer is running -> incubating', () => {
    const e = egg();
    const save = withCaller({ eggs: [e], hatches: [createHatchState(e)] });
    expect(resolveBootRoute(snapshot({ save: loaded(save), nowMs: e.incubationEndsAt - 1 }))).toEqual({
      kind: 'incubating',
      eggId: 'egg-1',
    });
  });

  it('an egg at or past incubationEndsAt, not hatched -> egg-ready (overdue too)', () => {
    const e = egg();
    const save = withCaller({ eggs: [e], hatches: [createHatchState(e)] });
    for (const nowMs of [e.incubationEndsAt, e.incubationEndsAt + 48 * 60 * MINUTE]) {
      expect(resolveBootRoute(snapshot({ save: loaded(save), nowMs }))).toEqual({ kind: 'egg-ready', eggId: 'egg-1' });
    }
  });

  it('a hatch interrupted mid-presentation resumes at egg-ready, never a second individual', () => {
    const e = egg();
    const ready = transitionHatch(createHatchState(e), { type: 'tick', now: e.incubationEndsAt }, e);
    const presenting = transitionHatch(ready, { type: 'open', now: e.incubationEndsAt }, e);
    expect(presenting.kind).toBe('presenting');
    const save = withCaller({ eggs: [e], hatches: [presenting] });
    expect(resolveBootRoute(snapshot({ save: loaded(save), nowMs: e.incubationEndsAt + 1 }))).toEqual({
      kind: 'egg-ready',
      eggId: 'egg-1',
    });
  });

  it('a Mon in the save -> companion', () => {
    const e = egg();
    const mon = namedMon(e);
    const save = withCaller({ eggs: [e], hatches: [createHatchState(e)], mons: [mon] });
    expect(resolveBootRoute(snapshot({ save: loaded(save), nowMs: e.incubationEndsAt + 1 }))).toEqual({
      kind: 'companion',
      monInstanceId: mon.monInstanceId,
    });
  });

  it('a hatched hatch state whose Mon is not in mons yet -> companion with that individual', () => {
    const e = egg();
    const mon = namedMon(e);
    const save = withCaller({
      eggs: [e],
      hatches: [{ kind: 'hatched', eggId: e.eggId, mon, serverConfirmed: false }],
    });
    expect(resolveBootRoute(snapshot({ save: loaded(save), nowMs: e.incubationEndsAt + 1 }))).toEqual({
      kind: 'companion',
      monInstanceId: mon.monInstanceId,
    });
  });

  it('a hatched Mon with no nickname resumes at naming (M09), never the companion', () => {
    const e = egg();
    const unnamed = mintMonInstance(e);
    expect(unnamed.nickname).toBeNull();
    const inMons = withCaller({ eggs: [e], hatches: [createHatchState(e)], mons: [unnamed] });
    expect(resolveBootRoute(snapshot({ save: loaded(inMons), nowMs: e.incubationEndsAt + 1 }))).toEqual({
      kind: 'resume-onboarding',
      step: 'mon-name',
    });
    const onlyHatch = withCaller({
      eggs: [e],
      hatches: [{ kind: 'hatched', eggId: e.eggId, mon: unnamed, serverConfirmed: false }],
    });
    expect(resolveBootRoute(snapshot({ save: loaded(onlyHatch), nowMs: e.incubationEndsAt + 1 }))).toEqual({
      kind: 'resume-onboarding',
      step: 'mon-name',
    });
  });

  it('a Mon wins over another egg still incubating', () => {
    const first = egg('egg-1');
    const second = egg('egg-2', T0 + 60 * MINUTE);
    const save = withCaller({ eggs: [first, second], mons: [namedMon(first)] });
    expect(resolveBootRoute(snapshot({ save: loaded(save), nowMs: T0 + 61 * MINUTE })).kind).toBe('companion');
  });

  it('with several eggs, the earliest ready egg wins, then the earliest incubating one', () => {
    const late = egg('egg-b', T0 + 10 * MINUTE);
    const early = egg('egg-a', T0);
    const save = withCaller({ eggs: [late, early] });
    expect(resolveBootRoute(snapshot({ save: loaded(save), nowMs: T0 + 1 }))).toEqual({
      kind: 'incubating',
      eggId: 'egg-a',
    });
    expect(resolveBootRoute(snapshot({ save: loaded(save), nowMs: T0 + 30 * MINUTE }))).toEqual({
      kind: 'egg-ready',
      eggId: 'egg-a',
    });
    expect(resolveBootRoute(snapshot({ save: loaded(save), nowMs: early.incubationEndsAt }))).toEqual({
      kind: 'egg-ready',
      eggId: 'egg-a',
    });
  });

  it('consent denied wins over every save content', () => {
    const e = egg();
    const save = withCaller({ eggs: [e], mons: [namedMon(e)] }, 'denied');
    expect(resolveBootRoute(snapshot({ save: loaded(save), hasSession: true }))).toEqual({ kind: 'consent-denied' });
  });

  it('consent pending plays on locally', () => {
    const e = egg();
    const save = withCaller({ eggs: [e] }, 'pending');
    expect(resolveBootRoute(snapshot({ save: loaded(save) })).kind).toBe('incubating');
  });

  it('a Caller with no egg and no Mon resumes at the egg choice', () => {
    expect(resolveBootRoute(snapshot({ save: loaded(withCaller()) }))).toEqual({
      kind: 'resume-onboarding',
      step: 'egg-choice',
    });
  });

  it('a session with no save on this device -> restore from the server, never a new Caller', () => {
    expect(resolveBootRoute(snapshot({ hasSession: true }))).toEqual({ kind: 'restore' });
    expect(resolveBootRoute(snapshot({ hasSession: true, ageAnswer: adult }))).toEqual({ kind: 'restore' });
  });

  it('after restore, a server profile with no Caller name resumes at the Caller name', () => {
    expect(resolveBootRoute(snapshot({ hasSession: true, save: loaded(createEmptySave('d', T0)) }))).toEqual({
      kind: 'resume-onboarding',
      step: 'caller-name',
    });
  });

  it('after restore, a restored save routes like any returning save', () => {
    const e = egg();
    const mon = namedMon(e);
    const restored = withCaller({ eggs: [e], mons: [mon] });
    expect(resolveBootRoute(snapshot({ hasSession: true, save: loaded(restored) }))).toEqual({
      kind: 'companion',
      monInstanceId: mon.monInstanceId,
    });
  });

  it('property: restore is returned exactly when a session exists and no save is on the device', () => {
    forAll(
      5_000,
      (random) => randomSnapshot(random),
      (snap) => {
        const isRestore = resolveBootRoute(snap).kind === 'restore';
        expect(isRestore).toBe(snap.hasSession && snap.save.status === 'missing');
      },
    );
  });

  it('without a session, a missing save never asks for restore', () => {
    expect(resolveBootRoute(snapshot({ ageAnswer: adult })).kind).not.toBe('restore');
  });

  describe('P1: the create intent needs a stored age answer', () => {
    it('no Caller, no session, stored 13+ answer -> resume at create-account', () => {
      expect(resolveBootRoute(snapshot({ ageAnswer: adult }))).toEqual({
        kind: 'resume-onboarding',
        step: 'create-account',
      });
    });

    it('no Caller, no session, stored answer that needs consent -> guardian-consent, never create-account', () => {
      expect(resolveBootRoute(snapshot({ ageAnswer: child }))).toEqual({
        kind: 'resume-onboarding',
        step: 'guardian-consent',
      });
    });

    it('property: create-account is unreachable without a stored age answer', () => {
      forAll(
        10_000,
        (random) => randomSnapshot(random),
        (snap) => {
          const route = resolveBootRoute(snap);
          if (route.kind === 'resume-onboarding' && route.step === 'create-account') {
            expect(snap.ageAnswer).toBeDefined();
          }
          if (route.kind === 'resume-onboarding' && route.step === 'guardian-consent') {
            expect(snap.ageAnswer).toBeDefined();
          }
        },
      );
    });
  });

  it('is pure: the same snapshot gives the same route over 10k seeded runs, and the input is untouched', () => {
    forAll(
      10_000,
      (random) => randomSnapshot(random),
      (snap) => {
        const before = JSON.stringify(snap);
        const a = resolveBootRoute(snap);
        const b = resolveBootRoute(structuredClone(snap));
        expect(b).toEqual(a);
        expect(JSON.stringify(snap)).toBe(before);
      },
    );
  });

  it('reads no clock but nowMs and does no I/O (source scan)', () => {
    const source = readFileSync(join(import.meta.dirname, '..', 'sim', 'boot.ts'), 'utf8');
    expect(source).not.toMatch(/\bDate\b|performance\.|\bfetch\b|setTimeout|await|Promise/);
  });
});

describe('readBootSave', () => {
  it('undefined raw value -> missing', () => {
    expect(readBootSave(undefined)).toEqual({ status: 'missing' });
  });

  it('a valid blob -> loaded', () => {
    const save = withCaller();
    expect(readBootSave(JSON.stringify(save))).toEqual({ status: 'loaded', save });
  });

  it.each([
    ['not json', 'corrupt'],
    ['{"version":99}', 'future-version'],
    ['{"version":1}', 'invalid'],
  ] as const)('%s -> unreadable (%s)', (raw, reason) => {
    expect(readBootSave(raw)).toEqual({ status: 'unreadable', reason });
  });
});

function randomSnapshot(random: () => number): BootSnapshot {
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;
  const e = egg('egg-r', T0);
  const consent = pick(['not-required', 'pending', 'approved', 'denied'] as const);
  const saves: BootSave[] = [
    { status: 'missing' },
    { status: 'unreadable', reason: pick(['corrupt', 'future-version', 'missing-migration', 'invalid'] as const) },
    loaded(createEmptySave('d', T0)),
    loaded(withCaller({}, consent)),
    loaded(withCaller({ eggs: [e], hatches: [createHatchState(e)] }, consent)),
    loaded(withCaller({ eggs: [e], mons: [namedMon(e)] }, consent)),
  ];
  return {
    save: pick(saves),
    hasSession: random() < 0.5,
    ageAnswer: random() < 0.4 ? undefined : { birthYear: 1950 + Math.floor(random() * 76), answeredAtMs: T0 },
    nowMs: T0 + Math.floor(random() * 60 * MINUTE),
  };
}
