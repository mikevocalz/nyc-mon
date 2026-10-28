import { randomUUID } from 'node:crypto';
import type { Payload } from 'payload';
import { eggs as starterEggs } from '@acme/content/eggs';
import { EGGS_SLUG } from '../../../collections/Eggs.ts';
import { MON_INSTANCES_SLUG } from '../../../collections/MonInstances.ts';
import { deriveMonInstanceId } from '../../../collections/core.ts';
import { MIN_SERVICE_KEY_LENGTH, ON_BEHALF_OF_HEADER, SERVICE_KEY_HEADER } from './service-caller.ts';

/**
 * Judge seed: prepares one dedicated judge account with a hatched Mon so a
 * judge's first care action does not wait out real incubation.
 *
 * The only shortcut is time: the starter egg is written with its shortest
 * incubation (15 minutes) already elapsed. Hatching then goes through the real
 * `POST /v1/eggs/:id/hatch` handler under service delegation, so the adult and
 * consent checks, the egg integrity check and minting are the game's own. Care
 * state is never written: the first care write starts from the hatchling state.
 * Nothing here sets acceptance flags, writes receipts or touches other accounts.
 */

/** Database names that mark a judge or disposable test database. */
const JUDGE_DATABASE = /^nycmon_(judge|nvidia_test)(_[a-z0-9]+)*$/;
const INCUBATION_MINUTES = 15;

export type JudgeSeedGuard =
  | { readonly ok: true; readonly database: string; readonly email: string }
  | { readonly ok: false; readonly reason: string };

export function judgeSeedGuard(env: Record<string, string | undefined>): JudgeSeedGuard {
  if (env.NVIDIA_JUDGE_SEED !== 'yes') return { ok: false, reason: 'Set NVIDIA_JUDGE_SEED=yes to seed the judge account.' };
  let database = '';
  try {
    const url = new URL(env.DATABASE_URL ?? '');
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') throw new Error('protocol');
    database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  } catch {
    return { ok: false, reason: 'DATABASE_URL is missing or is not a PostgreSQL URL.' };
  }
  if (!JUDGE_DATABASE.test(database)) {
    return { ok: false, reason: `Refusing: database "${database}" is not a judge or test database (name must start nycmon_judge or nycmon_nvidia_test).` };
  }
  const email = env.NVIDIA_JUDGE_CALLER_EMAIL?.trim() ?? '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, reason: 'Set NVIDIA_JUDGE_CALLER_EMAIL to the judge account email.' };
  if ((env.V1_MCP_SERVICE_KEY ?? '').length < MIN_SERVICE_KEY_LENGTH) {
    return { ok: false, reason: 'V1_MCP_SERVICE_KEY is required to hatch through the real route.' };
  }
  return { ok: true, database, email };
}

export interface JudgeSeedDeps {
  readonly payload: Payload;
  /** The real hatch handler (`handleHatchEgg`); injected for tests. */
  readonly hatch: (request: Request, eggId: string) => Promise<Response>;
  readonly serviceKey: string;
  readonly now?: () => number;
  readonly newEggId?: () => string;
}

export type JudgeSeedResult =
  | { readonly kind: 'seeded'; readonly callerId: string; readonly eggId: string; readonly monInstanceId: string }
  | { readonly kind: 'already-seeded'; readonly callerId: string; readonly monInstanceId: string }
  | { readonly kind: 'refused'; readonly reason: string }
  | { readonly kind: 'failed'; readonly status: number; readonly eggId: string };

export async function seedJudgeMon(deps: JudgeSeedDeps, input: { readonly email: string }): Promise<JudgeSeedResult> {
  const { payload } = deps;
  const users = await payload.find({ collection: 'users', where: { email: { equals: input.email } }, limit: 1, depth: 0, overrideAccess: true });
  const user = users.docs[0] as Record<string, unknown> | undefined;
  if (user === undefined) {
    return { kind: 'refused', reason: 'No judge account with that email. Have the judge account sign up through the real flow first; this seed never creates users.' };
  }
  const callerId = String(user.id);

  const mons = await payload.find({ collection: MON_INSTANCES_SLUG, where: { callerId: { equals: callerId } }, limit: 1, depth: 0, overrideAccess: true });
  const mon = mons.docs[0] as Record<string, unknown> | undefined;
  if (mon !== undefined) return { kind: 'already-seeded', callerId, monInstanceId: String(mon.monInstanceId) };

  const existingEggs = await payload.find({ collection: EGGS_SLUG, where: { callerId: { equals: callerId } }, limit: 1, depth: 0, overrideAccess: true });
  if (existingEggs.docs.length > 0) {
    return { kind: 'refused', reason: 'This account already has an egg (one egg per Caller). Use a fresh judge account.' };
  }

  const starter = starterEggs[0];
  if (starter === undefined) return { kind: 'refused', reason: 'No starter egg in content.' };
  const now = (deps.now ?? Date.now)();
  const eggId = (deps.newEggId ?? randomUUID)();
  const createdAtMs = now - INCUBATION_MINUTES * 60_000;
  await payload.create({
    collection: EGGS_SLUG,
    data: {
      eggId, monInstanceId: deriveMonInstanceId(eggId), speciesId: starter.speciesId,
      hatchesIntoSpeciesId: starter.hatchesIntoSpeciesId, callerId, nickname: null,
      incubationMinutes: INCUBATION_MINUTES, createdAtMs, incubationEndsAt: createdAtMs + INCUBATION_MINUTES * 60_000, hatched: false,
    },
    depth: 0,
    overrideAccess: true,
  });

  const request = new Request(`http://judge-seed.invalid/v1/eggs/${encodeURIComponent(eggId)}/hatch`, {
    method: 'POST',
    headers: { [SERVICE_KEY_HEADER]: deps.serviceKey, [ON_BEHALF_OF_HEADER]: callerId },
  });
  const response = await deps.hatch(request, eggId);
  if (!response.ok) return { kind: 'failed', status: response.status, eggId };
  const body = (await response.json()) as { data?: { mon?: { monInstanceId?: unknown } } };
  return { kind: 'seeded', callerId, eggId, monInstanceId: String(body.data?.mon?.monInstanceId ?? deriveMonInstanceId(eggId)) };
}
