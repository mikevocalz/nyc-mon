import type { CareState, MonInstance } from '@acme/core';
import type { FamiliarPerson } from '../presence/types.ts';
import type { InventoryItem } from '../mcp/schemas.ts';

/**
 * Data-access seam: everything the tools need that lives behind the existing
 * stack. Two backends, one interface — see ADR 0003 and system-design §1.
 *
 *   Production  → the `/v1` contract on the admin-vite host
 *                 (GET /v1/me/mons, PUT /v1/mons/:id/care, POST /v1/eggs…),
 *                 authenticated as the linked Caller. FamiliarPerson +
 *                 inventory have no `/v1` surface yet; they sit behind
 *                 the same seam until Payload collections exist.
 *   Dev / demo  → fixtures, so the simulator runs with no Postgres.
 *
 * TODO(v1): implement `V1CallerData` with fetch + the Caller's session token.
 * Every method below is intentionally unimplemented — tools must not guess.
 */
export interface CallerData {
  /** The Caller's Mons; `/v1/me/mons` equivalent. */
  listMons(callerId: string): Promise<MonInstance[]>;
  /** The Caller's "active" Mon (DECISIONS #18: Home asks which is active). */
  resolveActiveMon(callerId: string, monId?: string): Promise<MonInstance | null>;
  getCareState(monInstanceId: string): Promise<CareState | null>;
  /** Mutations go through the care contract so seq ordering + idempotency hold. */
  applyCareAction(
    monInstanceId: string,
    action: { kind: 'feed'; itemId: string } | { kind: 'play'; quality: number } | { kind: 'soothe' },
    idempotencyKey: string,
  ): Promise<CareState | null>;
  listInventory(callerId: string): Promise<InventoryItem[]>;
  listFamiliarPeople(callerId: string): Promise<FamiliarPerson[]>;
  getFamiliarPerson(callerId: string, personId: string): Promise<FamiliarPerson | null>;
  /** Incubation state for the Caller's outstanding egg, if any. */
  getIncubation(callerId: string): Promise<{ eggId: string; incubationEndsAt: number } | null>;
}

const NOT_IMPLEMENTED = 'TODO(data): bind CallerData to /v1 + Payload (see src/data/caller.ts)';

function unimplemented(): never {
  throw new Error(NOT_IMPLEMENTED);
}

/** Placeholder backend — swap for `V1CallerData` (prod) or fixtures (demo). */
export const stubCallerData: CallerData = {
  listMons: unimplemented,
  resolveActiveMon: unimplemented,
  getCareState: unimplemented,
  applyCareAction: unimplemented,
  listInventory: unimplemented,
  listFamiliarPeople: unimplemented,
  getFamiliarPerson: unimplemented,
  getIncubation: unimplemented,
};
