import type { EggRecord, HatchPresentationPhase, HatchState, IncubationMinutes, MonInstance } from '../types/index.ts';
import { assertNever } from './assert-never.ts';
import { hash128, toHex32 } from './random.ts';

const PHASES: readonly HatchPresentationPhase[] = ['case-open', 'scanner', 'crack', 'burst', 'emerge', 'attention'];

/** Thrown when two different individuals claim one egg. A P0 (Law 6). */
export class HatchIntegrityError extends Error {
  override readonly name = 'HatchIntegrityError';
}

/**
 * The one `monInstanceId` an egg can ever produce. Client and server both call
 * this, so an offline mint and the server's reservation are the same id.
 */
export function deriveMonInstanceId(eggId: string): string {
  return `mon_${hash128(`nyc-mon/egg/${eggId}`).map(toHex32).join('')}`;
}

export interface CreateEggInput {
  readonly eggId: string;
  readonly speciesId: string;
  readonly callerId: string;
  readonly nickname: string | null;
  readonly incubationMinutes: IncubationMinutes;
  readonly createdAt: number;
}

export function createEggRecord(input: CreateEggInput): EggRecord {
  return {
    ...input,
    monInstanceId: deriveMonInstanceId(input.eggId),
    incubationEndsAt: input.createdAt + input.incubationMinutes * 60_000,
  };
}

/**
 * Mints the individual an egg hatches into. A pure function of the EggRecord:
 * `hatchedAt` is the incubation end, not the device clock, so device A, device B
 * and the server replay all mint the identical MonInstance.
 */
export function mintMonInstance(egg: EggRecord): MonInstance {
  if (egg.monInstanceId !== deriveMonInstanceId(egg.eggId)) {
    throw new HatchIntegrityError(`Egg ${egg.eggId} reserves ${egg.monInstanceId}, expected the derived id`);
  }
  return {
    monInstanceId: egg.monInstanceId,
    speciesId: egg.speciesId,
    nickname: egg.nickname,
    callerId: egg.callerId,
    hatchedAt: egg.incubationEndsAt,
    // TODO(canon): starting bond for a hatchling.
    bond: 0,
    stage: 'Baby',
    voiceLineageId: null,
  };
}

export function createHatchState(egg: EggRecord): HatchState {
  return {
    kind: 'incubating',
    eggId: egg.eggId,
    monInstanceId: egg.monInstanceId,
    incubationEndsAt: egg.incubationEndsAt,
  };
}

export type HatchEvent =
  | { readonly type: 'tick'; readonly now: number }
  /** Hatch screen opened: notification tap, deep link, resume, or a second open. */
  | { readonly type: 'open'; readonly now: number }
  | { readonly type: 'advance' }
  | { readonly type: 'skip' }
  | { readonly type: 'server-confirmed'; readonly mon: MonInstance };

function assertSameIndividual(expected: string, mon: MonInstance): void {
  if (mon.monInstanceId !== expected) {
    throw new HatchIntegrityError(`Egg is bound to ${expected}; server returned ${mon.monInstanceId}`);
  }
}

/**
 * Hatch state machine. Atomic: the individual is committed on the first
 * `ready → presenting` edge and every later transition carries that same
 * MonInstance. Idempotent: replaying any event sequence never mints twice.
 */
export function transitionHatch(state: HatchState, event: HatchEvent, egg: EggRecord): HatchState {
  if (state.eggId !== egg.eggId) {
    throw new HatchIntegrityError(`Hatch state for ${state.eggId} driven with egg ${egg.eggId}`);
  }
  switch (event.type) {
    case 'tick':
      return state.kind === 'incubating' && event.now >= state.incubationEndsAt
        ? { kind: 'ready', eggId: state.eggId, monInstanceId: state.monInstanceId }
        : state;
    case 'open': {
      const ticked = transitionHatch(state, { type: 'tick', now: event.now }, egg);
      return ticked.kind === 'ready'
        ? { kind: 'presenting', eggId: ticked.eggId, mon: mintMonInstance(egg), phase: 'case-open', serverConfirmed: false }
        : ticked;
    }
    case 'advance': {
      if (state.kind !== 'presenting') return state;
      const next = PHASES[PHASES.indexOf(state.phase) + 1];
      return next === undefined
        ? { kind: 'hatched', eggId: state.eggId, mon: state.mon, serverConfirmed: state.serverConfirmed }
        : { ...state, phase: next };
    }
    case 'skip':
      switch (state.kind) {
        case 'incubating':
          return state;
        case 'ready':
          return { kind: 'hatched', eggId: state.eggId, mon: mintMonInstance(egg), serverConfirmed: false };
        case 'presenting':
          return { kind: 'hatched', eggId: state.eggId, mon: state.mon, serverConfirmed: state.serverConfirmed };
        case 'hatched':
          return state;
        default:
          return assertNever(state);
      }
    case 'server-confirmed':
      switch (state.kind) {
        case 'incubating':
        case 'ready':
          assertSameIndividual(state.monInstanceId, event.mon);
          return { kind: 'hatched', eggId: state.eggId, mon: event.mon, serverConfirmed: true };
        case 'presenting':
        case 'hatched':
          assertSameIndividual(state.mon.monInstanceId, event.mon);
          return { ...state, mon: event.mon, serverConfirmed: true };
        default:
          return assertNever(state);
      }
    default:
      return assertNever(event);
  }
}

/** Server-side idempotent hatch: the existing individual on retry, a mint otherwise. */
export function resolveHatch(
  ledger: ReadonlyMap<string, MonInstance>,
  egg: EggRecord,
): { readonly ledger: ReadonlyMap<string, MonInstance>; readonly mon: MonInstance; readonly created: boolean } {
  const existing = ledger.get(egg.eggId);
  if (existing !== undefined) return { ledger, mon: existing, created: false };
  const mon = mintMonInstance(egg);
  return { ledger: new Map(ledger).set(egg.eggId, mon), mon, created: true };
}
