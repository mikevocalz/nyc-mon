import { describe, expect, it } from 'vitest';
import {
  CreateEggRequestSchema,
  EggRecordSchema,
  JournalEntrySchema,
  ModelClipMapSchema,
  MonInstanceSchema,
  PeekRoundSchema,
  PlaySessionSchema,
  ReadyNotificationDataSchema,
} from '../schemas/index.ts';
import { applyCareAction, advanceCare } from '../sim/care.ts';
import { isCallerUnder13 } from '../sim/consent.ts';
import { deriveFirstLook } from '../sim/first-look.ts';
import { createEggRecord, deriveMonInstanceId, HatchIntegrityError } from '../sim/hatch.ts';
import { appendCareToJournal, appendJournalEntry, countDaysTogether, journalEntryId } from '../sim/journal.ts';
import { MON_NAME_MAX_LENGTH, monNameErrorCopyId, validateMonName } from '../sim/mon-name.ts';
import { PEEK_MIN_QUALITY, peekQuality } from '../sim/play.ts';
import { acknowledgeEggCreate, createWriteQueue, enqueueEggCreate, toCreateEggRequest } from '../sim/queue.ts';
import { deriveAnimationIntent, IDLE_PRESENCE } from '../sim/scene-input.ts';
import type { JournalEntry, PeekRound } from '../types/index.ts';
import { forAll, HOUR, makeMon, makeState, T0 } from './harness.ts';

const ALLOW_ALL = { isBlocked: () => false };

describe('validateMonName (M09)', () => {
  it.each([
    ['   ', 'blank'],
    ['123', 'blank'],
    ['a'.repeat(MON_NAME_MAX_LENGTH + 1), 'too-long'],
    ['Pip2', 'characters'],
    ['Pip 🐀', 'characters'],
  ] as const)('%j -> %s', (raw, reason) => {
    expect(validateMonName(raw, ALLOW_ALL)).toEqual({ ok: false, reason });
  });

  it('accepts 16 characters, accents and non-Latin scripts, trimmed and NFC', () => {
    expect(validateMonName('a'.repeat(16), ALLOW_ALL)).toEqual({ ok: true, name: 'a'.repeat(16) });
    expect(validateMonName('  Zoë  ', ALLOW_ALL)).toEqual({ ok: true, name: 'Zoë' });
    expect(validateMonName('ミケ', ALLOW_ALL)).toEqual({ ok: true, name: 'ミケ' });
    expect(validateMonName('Zoë', ALLOW_ALL)).toEqual({ ok: true, name: 'Zoë' });
  });

  it('reserved fires only when the list is non-empty, case-insensitively, before blocked', () => {
    expect(validateMonName('Ratti', ALLOW_ALL)).toEqual({ ok: true, name: 'Ratti' });
    expect(validateMonName('ratti', { isBlocked: () => true }, ['Ratti'])).toEqual({ ok: false, reason: 'reserved' });
    expect(validateMonName('Pip', { isBlocked: () => true })).toEqual({ ok: false, reason: 'blocked' });
  });

  it('maps every reason to an m09 copy id', () => {
    expect(['blank', 'too-long', 'characters', 'reserved', 'blocked'].map((r) => monNameErrorCopyId(r as never))).toEqual([
      'm09.error.blank',
      'm09.error.too_long',
      'm09.error.characters',
      'm09.error.reserved',
      'm09.error.blocked',
    ]);
  });

  it('schemas reject a 17-character nickname everywhere the nickname is stored or sent', () => {
    const long = 'a'.repeat(17);
    expect(MonInstanceSchema.safeParse(makeMon({ nickname: long })).success).toBe(false);
    expect(MonInstanceSchema.safeParse(makeMon({ nickname: 'a'.repeat(16) })).success).toBe(true);
    const egg = createEggRecord({
      eggId: 'egg-1',
      speciesId: 'dex-001',
      hatchesIntoSpeciesId: 'dex-002',
      callerId: 'c',
      nickname: null,
      incubationMinutes: 15,
      createdAt: T0,
    });
    expect(EggRecordSchema.safeParse({ ...egg, nickname: long }).success).toBe(false);
    expect(CreateEggRequestSchema.safeParse({ ...toCreateEggRequest(egg), nickname: long }).success).toBe(false);
  });
});

describe('deriveFirstLook (D-15g)', () => {
  const ids = Array.from({ length: 30_000 }, (_, i) => deriveMonInstanceId(`egg-${i}`));

  it('is stable for a given individual across 10k calls', () => {
    const id = ids[0] ?? '';
    const first = deriveFirstLook(id, false);
    for (let i = 0; i < 10_000; i++) expect(deriveFirstLook(id, false)).toBe(first);
  });

  it('leans in about two times in three over many individuals', () => {
    const hesitate = ids.filter((id) => deriveFirstLook(id, false) === 'hesitate').length / ids.length;
    expect(hesitate).toBeGreaterThan(0.32);
    expect(hesitate).toBeLessThan(0.35);
  });

  it('always leans in for a Caller under 13', () => {
    expect(ids.every((id) => deriveFirstLook(id, true) === 'lean-in')).toBe(true);
  });

  it('isCallerUnder13 reads consent status and birth year, erring under 13', () => {
    expect(isCallerUnder13({ birthYear: 2000, consentStatus: 'not-required' }, T0)).toBe(false);
    expect(isCallerUnder13({ birthYear: 2000, consentStatus: 'approved' }, T0)).toBe(true);
    expect(isCallerUnder13({ birthYear: 2016, consentStatus: 'not-required' }, T0)).toBe(true);
  });
});

describe('journal (M18, D-15a)', () => {
  const ID = 'mon_test';

  it('marks the first entry of each kind and appends the same entry only once', () => {
    let j: readonly JournalEntry[] = [];
    j = appendJournalEntry(j, { monInstanceId: ID, kind: 'fed', at: T0 });
    j = appendJournalEntry(j, { monInstanceId: ID, kind: 'fed', at: T0 + HOUR });
    j = appendJournalEntry(j, { monInstanceId: ID, kind: 'fed', at: T0 + HOUR });
    j = appendJournalEntry(j, { monInstanceId: 'mon_other', kind: 'fed', at: T0 });
    expect(j.map((e) => [e.monInstanceId, e.first])).toEqual([
      [ID, true],
      [ID, false],
      ['mon_other', true],
    ]);
    for (const e of j) expect(JournalEntrySchema.parse(e)).toEqual(e);
    expect(j[0]?.entryId).toBe(journalEntryId(ID, 'fed', T0));
  });

  it('logs meals, naps, games and waking rested; never declines, requests or needs-you', () => {
    const tired = { ...makeState(), care: { ...makeState().care, energy: 0.2 } };
    const asleep = applyCareAction(tired, { kind: 'rest' }, T0).state;
    const declined = applyCareAction(asleep, { kind: 'play', quality: 1 }, T0 + 1);
    expect(declined.outcome.kind).toBe('declined');
    expect(appendCareToJournal([], { monInstanceId: ID, at: T0 + 1, ...declined })).toEqual([]);
    const napping = applyCareAction(tired, { kind: 'rest' }, T0);
    const woken = applyCareAction(napping.state, { kind: 'feed' }, T0 + 30 * HOUR);
    const j = appendCareToJournal(appendCareToJournal([], { monInstanceId: ID, at: T0, ...napping }), {
      monInstanceId: ID,
      at: T0 + 30 * HOUR,
      ...woken,
    });
    expect(j.map((e) => e.kind)).toEqual(['rested', 'woke-rested', 'fed']);
    expect(woken.events.some((e) => e.type === 'needs-attention' || e.type === 'food-requested')).toBe(true);
  });

  it('days together counts days with an entry, never subtracts gaps, and only rises with time', () => {
    const dayKey = (at: number) => String(Math.floor(at / (24 * HOUR)));
    const j: JournalEntry[] = [0, 1, 1, 21, 22].map((day, i) => ({
      entryId: `e${i}`,
      monInstanceId: ID,
      at: T0 + day * 24 * HOUR,
      kind: 'fed',
      first: i === 0,
    }));
    expect(countDaysTogether(j, ID, T0 + 30 * 24 * HOUR, dayKey)).toBe(4);
    let last = 0;
    for (let now = T0; now < T0 + 30 * 24 * HOUR; now += 6 * HOUR) {
      const n = countDaysTogether(j, ID, now, dayKey);
      expect(n).toBeGreaterThanOrEqual(last);
      last = n;
    }
    expect(countDaysTogether(j, 'mon_other', T0 + 30 * 24 * HOUR, dayKey)).toBe(0);
  });
});

describe('Peek (D-15b)', () => {
  const round = (hiddenAt: PeekRound['hiddenAt'], guesses: PeekRound['guesses']): PeekRound => ({ hiddenAt, guesses });

  it('quality is 0.6 + 0.4 × first-try finds, so a wrong guess still counts', () => {
    expect(peekQuality([])).toBeUndefined();
    expect(peekQuality([round('left', ['right', 'left'])])).toBe(PEEK_MIN_QUALITY);
    expect(peekQuality([round('left', ['left'])])).toBe(1);
    expect(peekQuality([round('left', ['left']), round('middle', ['left', 'right', 'middle'])])).toBeCloseTo(0.8, 12);
  });

  it('every quality it returns is in [0.6, 1] and a play at that quality is accepted and raises Social', () => {
    const spots = ['left', 'middle', 'right'] as const;
    forAll(
      1_000,
      (random) =>
        Array.from({ length: 1 + Math.floor(random() * 6) }, () => {
          const hiddenAt = spots[Math.floor(random() * 3)] ?? 'left';
          return random() < 0.5 ? round(hiddenAt, [hiddenAt]) : round(hiddenAt, [...spots.filter((s) => s !== hiddenAt).slice(0, 1), hiddenAt]);
        }),
      (rounds) => {
        for (const r of rounds) expect(PeekRoundSchema.parse(r)).toEqual(r);
        const quality = peekQuality(rounds) ?? Number.NaN;
        expect(quality).toBeGreaterThanOrEqual(PEEK_MIN_QUALITY);
        expect(quality).toBeLessThanOrEqual(1);
        const s = makeState();
        const played = applyCareAction(s, { kind: 'play', quality }, T0);
        expect(played.outcome).toEqual({ kind: 'played' });
        expect(played.state.care.social).toBeGreaterThan(s.care.social);
      },
    );
  });

  it('a round must end on the hiding spot; the play session seam parses', () => {
    expect(PeekRoundSchema.safeParse(round('left', ['right'])).success).toBe(false);
    const session = {
      sessionId: 's1',
      monInstanceIds: ['mon_test'],
      participants: [{ callerId: 'caller-1' }],
      startedAt: T0,
      rounds: [round('middle', ['middle'])],
    };
    expect(PlaySessionSchema.parse(session)).toEqual(session);
    expect(PlaySessionSchema.safeParse({ ...session, participants: [] }).success).toBe(false);
  });
});

describe('egg-create queue (M10 B4)', () => {
  const egg = createEggRecord({
    eggId: 'egg-offline',
    speciesId: 'dex-001',
    hatchesIntoSpeciesId: 'dex-002',
    callerId: 'caller-1',
    nickname: null,
    incubationMinutes: 30,
    createdAt: T0,
  });

  it('a queued create replays with the same eggId after a simulated reconnect, then clears on the answer', () => {
    const request = toCreateEggRequest(egg);
    expect(CreateEggRequestSchema.parse(request)).toEqual(request);
    let q = enqueueEggCreate(createWriteQueue('device-a'), request, T0);
    // Offline send fails: nothing acknowledges, the entry stays.
    const replay = q.eggCreates.map((e) => e.request);
    expect(replay).toEqual([request]);
    // Re-queuing the same egg (a retry path) never duplicates it.
    q = enqueueEggCreate(q, request, T0 + HOUR);
    expect(q.eggCreates).toHaveLength(1);
    // Reconnect: the server answers for the same eggId.
    q = acknowledgeEggCreate(q, { eggId: egg.eggId, monInstanceId: egg.monInstanceId, incubationEndsAt: egg.incubationEndsAt });
    expect(q.eggCreates).toEqual([]);
    expect(q.nextSeq).toBe(1);
  });

  it('a server answer with another individual is a HatchIntegrityError', () => {
    const q = enqueueEggCreate(createWriteQueue('device-a'), toCreateEggRequest(egg), T0);
    expect(() => acknowledgeEggCreate(q, { eggId: egg.eggId, monInstanceId: 'mon_other', incubationEndsAt: 0 })).toThrow(
      HatchIntegrityError,
    );
  });
});

describe('animation intents: hatch, attention, refuse', () => {
  const s = makeState();
  const asleep = applyCareAction({ ...s, care: { ...s.care, energy: 0.2 } }, { kind: 'rest' }, T0).state.care;

  it.each(['hatch', 'attention', 'refuse'] as const)('%s cue plays while running', (intent) => {
    expect(deriveAnimationIntent(s.care, { ...IDLE_PRESENCE, nowMs: 0, cue: { intent, untilMs: 1 } })).toBe(intent);
  });

  it('a tap (attention) on a sleeping Mon keeps it asleep; refuse still plays', () => {
    expect(deriveAnimationIntent(asleep, { ...IDLE_PRESENCE, cue: { intent: 'attention', untilMs: 1 } })).toBe('sleep');
    expect(deriveAnimationIntent(asleep, { ...IDLE_PRESENCE, cue: { intent: 'refuse', untilMs: 1 } })).toBe('refuse');
  });

  it('the clip map has its own hatch slot; evolve is not reused', () => {
    expect(Object.keys(ModelClipMapSchema.shape)).toEqual(
      expect.arrayContaining(['hatch', 'attention', 'refuse', 'evolve']),
    );
    expect(advanceCare(s, T0 + HOUR).state.mon.stage).toBe('Baby');
  });
});

describe('ReadyNotificationDataSchema (Law 5)', () => {
  it('accepts the payload M11 schedules and rejects anything else', () => {
    expect(ReadyNotificationDataSchema.parse({ eggId: 'egg-1', url: '/(home)/hatch' })).toEqual({
      eggId: 'egg-1',
      url: '/(home)/hatch',
    });
    for (const bad of [null, {}, { eggId: '' , url: '/(home)/hatch' }, { eggId: 'egg-1', url: '/elsewhere' }]) {
      expect(ReadyNotificationDataSchema.safeParse(bad).success).toBe(false);
    }
  });
});
