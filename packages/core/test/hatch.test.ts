import { describe, expect, it } from 'vitest';
import { EggRecordSchema, HatchStateSchema, MonInstanceSchema } from '../schemas/index.ts';
import {
  createEggRecord,
  createHatchState,
  deriveMonInstanceId,
  HatchIntegrityError,
  type HatchEvent,
  mintMonInstance,
  resolveHatch,
  transitionHatch,
} from '../sim/hatch.ts';
import { HATCH_PRESENTATION_PHASES } from '../schemas/hatch.ts';
import type { EggRecord, HatchState, MonInstance } from '../types/index.ts';
import { MINUTE, T0 } from './harness.ts';

const egg: EggRecord = createEggRecord({
  eggId: 'egg-1',
  speciesId: 'dex-egg-test',
  hatchesIntoSpeciesId: 'dex-baby-test',
  callerId: 'caller-1',
  nickname: 'Testy',
  incubationMinutes: 30,
  createdAt: T0,
});
const READY_AT = T0 + 30 * MINUTE;

const run = (events: readonly HatchEvent[], from: HatchState = createHatchState(egg)): HatchState =>
  events.reduce((s, e) => transitionHatch(s, e, egg), from);

/** Simulates process death: persist through JSON, reload through the schema. */
const persistAndReload = (s: HatchState): HatchState => HatchStateSchema.parse(JSON.parse(JSON.stringify(s)));

const monOf = (s: HatchState): MonInstance => {
  if (s.kind !== 'presenting' && s.kind !== 'hatched') throw new Error(`no mon in ${s.kind}`);
  return s.mon;
};

describe('egg records and the offline mint', () => {
  it('reserves a monInstanceId derived only from eggId', () => {
    expect(EggRecordSchema.parse(egg)).toEqual(egg);
    expect(egg.monInstanceId).toBe(deriveMonInstanceId('egg-1'));
    expect(egg.monInstanceId).toMatch(/^mon_[0-9a-f]{32}$/);
    expect(egg.incubationEndsAt).toBe(READY_AT);
    expect(deriveMonInstanceId('egg-1')).toBe(deriveMonInstanceId('egg-1'));
    expect(deriveMonInstanceId('egg-2')).not.toBe(deriveMonInstanceId('egg-1'));
  });

  it('derives distinct ids for 10k distinct eggs', () => {
    const ids = new Set(Array.from({ length: 10_000 }, (_, i) => deriveMonInstanceId(`egg-${i}`)));
    expect(ids.size).toBe(10_000);
  });

  it('mints a Baby with hatchedAt at incubation end, independent of when it is opened', () => {
    const mon = mintMonInstance(egg);
    expect(MonInstanceSchema.parse(mon)).toEqual(mon);
    expect(mon).toMatchObject({ monInstanceId: egg.monInstanceId, stage: 'Baby', hatchedAt: READY_AT, voiceLineageId: null });
    const late = monOf(run([{ type: 'open', now: READY_AT + 5 * 24 * 60 * MINUTE }]));
    expect(late).toEqual(mon);
  });

  it('mints the Baby form the egg hatches into, not the Egg form', () => {
    const mon = mintMonInstance(egg);
    expect(mon.speciesId).toBe('dex-baby-test');
    expect(mon.speciesId).not.toBe(egg.speciesId);
    expect(resolveHatch(new Map(), egg).mon.speciesId).toBe('dex-baby-test');
    expect(monOf(run([{ type: 'open', now: READY_AT }, { type: 'skip' }])).speciesId).toBe('dex-baby-test');
  });

  it('refuses an egg whose reserved id does not match the derivation', () => {
    expect(() => mintMonInstance({ ...egg, monInstanceId: 'mon_forged' })).toThrow(HatchIntegrityError);
  });
});

describe('hatch state machine', () => {
  it('stays incubating before the end time, even when opened', () => {
    expect(run([{ type: 'open', now: READY_AT - 1 }, { type: 'skip' }]).kind).toBe('incubating');
  });

  it('plays every presentation phase in order and ends hatched', () => {
    let s = run([{ type: 'open', now: READY_AT }]);
    const seen: string[] = [];
    while (s.kind === 'presenting') {
      seen.push(s.phase);
      s = transitionHatch(s, { type: 'advance' }, egg);
    }
    expect(seen).toEqual([...HATCH_PRESENTATION_PHASES]);
    expect(s.kind).toBe('hatched');
  });

  const expected = mintMonInstance(egg);
  const phases = HATCH_PRESENTATION_PHASES.length;

  it.each(Array.from({ length: phases + 1 }, (_, k) => k))(
    'skip after %i advances yields the same individual',
    (advances) => {
      const s = run([
        { type: 'open', now: READY_AT },
        ...Array.from({ length: advances }, (): HatchEvent => ({ type: 'advance' })),
        { type: 'skip' },
      ]);
      expect(s.kind).toBe('hatched');
      expect(monOf(s)).toEqual(expected);
    },
  );

  it('skip straight from ready commits the same individual', () => {
    expect(monOf(run([{ type: 'tick', now: READY_AT }, { type: 'skip' }]))).toEqual(expected);
  });

  it.each(Array.from({ length: phases + 1 }, (_, k) => k))(
    'process death after %i advances, then reopen, yields the same individual',
    (advances) => {
      let s = run([{ type: 'open', now: READY_AT }]);
      for (let k = 0; k < advances; k++) s = transitionHatch(s, { type: 'advance' }, egg);
      s = persistAndReload(s);
      s = run([{ type: 'open', now: READY_AT + 10 * MINUTE }, { type: 'skip' }], s);
      expect(monOf(s)).toEqual(expected);
    },
  );

  it('process death at ready (before commit) mints the same individual on reopen', () => {
    const s = persistAndReload(run([{ type: 'tick', now: READY_AT }]));
    expect(monOf(run([{ type: 'open', now: READY_AT + MINUTE }], s))).toEqual(expected);
  });

  it('opening the notification twice never re-mints or restarts the hatch', () => {
    const first = run([{ type: 'open', now: READY_AT }, { type: 'advance' }, { type: 'advance' }]);
    const second = transitionHatch(first, { type: 'open', now: READY_AT + MINUTE }, egg);
    expect(second).toEqual(first);
    const done = run([{ type: 'skip' }], second);
    expect(transitionHatch(done, { type: 'open', now: READY_AT + 2 * MINUTE }, egg)).toEqual(done);
  });

  it('device A then device B produce exactly one individual', () => {
    const deviceA = run([{ type: 'open', now: READY_AT + MINUTE }, { type: 'skip' }]);
    const deviceB = run([{ type: 'open', now: READY_AT + 90 * MINUTE }]);
    expect(monOf(deviceB)).toEqual(monOf(deviceA));
    const ledger = [monOf(deviceA), monOf(deviceB)].reduce(
      (acc, mon) => acc.set(mon.monInstanceId, mon),
      new Map<string, MonInstance>(),
    );
    expect(ledger.size).toBe(1);
  });

  it('server confirmation of the same individual is adopted; a different one is a P0 error', () => {
    const s = run([{ type: 'open', now: READY_AT }]);
    const server = { ...expected, nickname: 'Server Name' };
    const confirmed = transitionHatch(s, { type: 'server-confirmed', mon: server }, egg);
    expect(confirmed).toMatchObject({ kind: 'presenting', serverConfirmed: true, mon: server });
    expect(() =>
      transitionHatch(s, { type: 'server-confirmed', mon: { ...expected, monInstanceId: 'mon_other' } }, egg),
    ).toThrow(HatchIntegrityError);
  });

  it('reconnect mid-hatch: server confirmation before the Caller opens still lands on one individual', () => {
    const s = run([{ type: 'server-confirmed', mon: expected }]);
    expect(s).toEqual({ kind: 'hatched', eggId: egg.eggId, mon: expected, serverConfirmed: true });
    expect(run([{ type: 'open', now: READY_AT }], s)).toEqual(s);
  });

  it('rejects driving one egg state with another egg', () => {
    const other = createEggRecord({ ...egg, eggId: 'egg-2' });
    expect(() => transitionHatch(createHatchState(egg), { type: 'tick', now: READY_AT }, other)).toThrow(
      HatchIntegrityError,
    );
  });
});

describe('server idempotent hatch (POST /v1/eggs/:id/hatch)', () => {
  it('returns the same MonInstance on retry and creates exactly one', () => {
    let ledger: ReadonlyMap<string, MonInstance> = new Map();
    const results = Array.from({ length: 5 }, () => {
      const r = resolveHatch(ledger, egg);
      ledger = r.ledger;
      return r;
    });
    expect(results.filter((r) => r.created)).toHaveLength(1);
    for (const r of results) expect(r.mon).toEqual(mintMonInstance(egg));
    expect(ledger.size).toBe(1);
  });

  it('server mint equals the offline client mint', () => {
    expect(resolveHatch(new Map(), egg).mon).toEqual(monOf(run([{ type: 'open', now: READY_AT }])));
  });
});
