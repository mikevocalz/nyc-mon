import type { CareAction, CareState, EggRecord, MonInstance } from '@acme/core';

/** One Mon with its stored care state, as `/v1/me/mons` returns it. */
export interface MonWithCare {
  readonly mon: MonInstance;
  readonly care: CareState;
}

/** One unhatched egg, as `/v1/me/eggs` returns it. */
export interface IncubatingEgg {
  readonly egg: EggRecord;
  readonly readyToHatch: boolean;
}

/** One care action a tool asks `/v1` to apply. */
export interface CareWriteIntent {
  readonly callerId: string;
  readonly monInstanceId: string;
  readonly action: CareAction;
  /** Epoch ms the action happens at, used only on the first send of an intent. */
  readonly at: number;
  /** Stable for one intent across retries, e.g. derived from the JSON-RPC request id. */
  readonly intentKey: string;
}

/**
 * Everything the tools read or write for one linked Caller. The production
 * implementation is `V1CallerData` (`./v1.ts`) over admin-vite's `/v1`
 * contract (ADR 0001 §1.4). Methods throw the errors in `./errors.ts`.
 */
export interface CallerData {
  /** `GET /v1/me/mons`. */
  listMons(callerId: string): Promise<readonly MonWithCare[]>;
  /** `GET /v1/me/eggs`. */
  listIncubatingEggs(callerId: string): Promise<readonly IncubatingEgg[]>;
  /**
   * `PUT /v1/mons/:id/care` with one write. `intentKey` names one Caller
   * intent (one tool call); sending the same intent again reuses its
   * Idempotency-Key, seq and `at`, so `/v1` replays instead of applying twice.
   * Throws `WriteUnconfirmedError` when the write was sent but not answered.
   */
  applyCare(write: CareWriteIntent): Promise<MonWithCare>;
}
