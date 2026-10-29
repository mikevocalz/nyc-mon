import { eggs as starterEggs } from '@acme/content/eggs';
import { starterBloodlines } from '@acme/content/starters';
import { AdoptMonRequestSchema, CareStateSchema, EggRecordSchema } from '@acme/core/schemas';
import type { AdoptMonRequest, CareState, EvolutionNode, MonInstance } from '@acme/core/types';
import { deriveMonGender, deriveMonInstanceId, deriveVoiceLineageId, mintMonInstance } from '@acme/core/sim';
import { createPayloadRequest } from 'payload';
import type { Payload, PayloadRequest, User } from 'payload';
import type {} from '../../../payload-types.ts';
import { CARE_STATES_SLUG, parseLastSeqByDevice, toCareState } from '../../../collections/CareStates.ts';
import { EGGS_SLUG, toEggRecord } from '../../../collections/Eggs.ts';
import { parseRecord } from '../../../collections/guards.ts';
import { MON_INSTANCES_SLUG } from '../../../collections/MonInstances.ts';
import {
  asRecord, authenticateCaller, findCareDoc, getPayloadInstance, handleAPIError, monFromDoc, v1Error, v1Ok, withTransaction,
} from './game.ts';
import { runIdempotent } from './idempotency.ts';
import { createFixedWindowLimiter } from './rate-limit.ts';

/**
 * `POST /v1/mons/adopt`: claims a Mon that hatched on the Caller's device but
 * that the server has no record of. That happens when the egg was created
 * offline and never sent, or when the server lost its data (a reset dev
 * database). Without a server Mon, `PUT /v1/mons/:id/care` answers 404 and
 * the device's queue can never drain.
 *
 * The client chooses no ids and no owner. The Mon's id must be the one
 * derived from the egg id, gender and voice lineage must be the egg-derived
 * values, the egg must be a starter egg from content, the species must sit at
 * the stated stage in that egg's Bloodline, and the owner is the signed-in
 * Caller. The Mon is minted from the egg exactly as a hatch would mint it,
 * then moved to the stage, bond and name the device holds, through the
 * collection hooks that guard every Mon write (never backwards a stage, named
 * once).
 *
 * Idempotent twice over: a Mon that already exists for this Caller comes back
 * unchanged with `adopted: false`, and an `Idempotency-Key` replays the first
 * response. Rate-limited per Caller.
 */

/** Clock skew allowed between the device and the server, in either direction. */
export const ADOPT_CLOCK_SKEW_MS = 5 * 60_000;

/** Dependencies for {@link createAdoptMonHandler}; tests pass a fake Payload. */
export interface AdoptMonDeps {
  readonly getPayload: () => Promise<Payload>;
  readonly now?: () => number;
  readonly serviceKey?: string;
  /** Per-Caller limiter; returns false once the Caller is over budget. */
  readonly rateLimit: (callerId: string) => boolean;
  /** Builds the request the Local API calls share (one transaction). Defaults to `createPayloadRequest`. */
  readonly makeReq?: (payload: Payload, user: Record<string, unknown>, request: Request) => Promise<PayloadRequest>;
}

async function defaultMakeReq(payload: Payload, user: Record<string, unknown>, request: Request): Promise<PayloadRequest> {
  return createPayloadRequest({ user: user as unknown as User, req: { headers: request.headers } as Partial<PayloadRequest>, payload });
}

function findNode(node: EvolutionNode, speciesId: string): EvolutionNode | undefined {
  if (node.speciesId === speciesId) return node;
  for (const child of node.evolvesTo) {
    const hit = findNode(child, speciesId);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

/** Why the request is not a Mon this egg could have become, or null when it is. */
export function adoptRuleViolation(input: AdoptMonRequest, nowMs: number): string | null {
  const { egg, mon, care } = input;
  if (mon.monInstanceId !== deriveMonInstanceId(egg.eggId)) return 'monInstanceId is not the id derived from the egg.';
  if (care.monInstanceId !== mon.monInstanceId) return 'care is for a different Mon.';
  const starter = starterEggs.find((e) => e.speciesId === egg.speciesId);
  if (starter === undefined || starter.hatchesIntoSpeciesId !== egg.hatchesIntoSpeciesId) {
    return 'The egg is not a starter egg.';
  }
  const bloodline = starterBloodlines.find(({ bloodline: b }) => b.bloodlineId === starter.bloodlineId)?.bloodline;
  const baby = bloodline === undefined ? undefined : findNode(bloodline.chain, egg.hatchesIntoSpeciesId);
  const form = baby === undefined ? undefined : findNode(baby, mon.speciesId);
  if (form === undefined || form.stage !== mon.stage || mon.stage === 'Egg') {
    return `${mon.speciesId} at stage ${mon.stage} is not a form this egg grows into.`;
  }
  if (mon.gender !== null && mon.gender !== deriveMonGender(egg.eggId)) return 'gender is not the egg-derived gender.';
  if (mon.voiceLineageId !== null && mon.voiceLineageId !== deriveVoiceLineageId(egg)) {
    return 'voiceLineageId is not the egg-derived voice lineage.';
  }
  const latest = nowMs + ADOPT_CLOCK_SKEW_MS;
  const incubationEndsAt = egg.createdAt + egg.incubationMinutes * 60_000;
  if (incubationEndsAt > latest) return 'The egg has not finished incubating.';
  if (care.updatedAt > latest) return 'care is from the future.';
  if (care.updatedAt < egg.createdAt) return 'care predates the egg.';
  return null;
}

interface AdoptResult {
  readonly mon: MonInstance;
  readonly care: CareState;
  readonly ackedSeq: number;
  readonly adopted: boolean;
}

function seqFor(careDoc: Record<string, unknown> | undefined, deviceId: string): number {
  if (careDoc === undefined) return 0;
  return parseLastSeqByDevice(careDoc.lastSeqByDevice ?? {})[deviceId] ?? 0;
}

async function findOne(payload: Payload, req: PayloadRequest, collection: string, field: string, value: string) {
  const result = await payload.find({
    collection: collection as never,
    where: { [field]: { equals: value } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  });
  return asRecord(result.docs[0]);
}

function careData(care: CareState, deviceId: string, appliedThroughSeq: number) {
  return {
    monInstanceId: care.monInstanceId,
    energy: care.energy,
    fullness: care.fullness,
    social: care.social,
    updatedAtMs: care.updatedAt,
    lastFedAt: care.lastFedAt,
    lastRestedAt: care.lastRestedAt,
    lastSocialAt: care.lastSocialAt,
    activity: care.activity,
    sluggishUntil: care.sluggishUntil,
    pendingRequest: care.pendingRequest,
    lastSeqByDevice: { [deviceId]: appliedThroughSeq },
  };
}

/**
 * The Mon the server already holds. A Mon the hatch route minted has no care
 * row until its first care write; the device's state becomes that row, so its
 * queued writes are not replayed onto a fresh hatchling.
 */
async function existingResult(payload: Payload, req: PayloadRequest, monDoc: Record<string, unknown>, input: AdoptMonRequest): Promise<AdoptResult> {
  const mon = monFromDoc(monDoc);
  const careDoc = await findCareDoc(payload, req, mon.monInstanceId);
  if (careDoc === undefined) {
    await payload.create({
      collection: CARE_STATES_SLUG,
      data: careData(input.care, input.deviceId, input.appliedThroughSeq),
      depth: 0,
      overrideAccess: true,
      req,
    });
    return { mon, care: input.care, ackedSeq: input.appliedThroughSeq, adopted: false };
  }
  const care = parseRecord(CareStateSchema, toCareState(careDoc), 'care');
  return { mon, care, ackedSeq: seqFor(careDoc, input.deviceId), adopted: false };
}

async function adopt(payload: Payload, req: PayloadRequest, callerId: string, input: AdoptMonRequest, nowMs: number): Promise<Response> {
  const { egg: clientEgg, mon: clientMon, deviceId, appliedThroughSeq } = input;

  const monDoc = await findOne(payload, req, MON_INSTANCES_SLUG, 'eggId', clientEgg.eggId);
  if (monDoc !== undefined) {
    if (String(monDoc.callerId) !== callerId) return v1Error('INVALID_RECORD', 'This Mon belongs to another Caller.', 409);
    return v1Ok(await existingResult(payload, req, monDoc, input));
  }

  const eggDoc = await findOne(payload, req, EGGS_SLUG, 'eggId', clientEgg.eggId);
  if (eggDoc !== undefined && String(eggDoc.callerId) !== callerId) {
    return v1Error('INVALID_RECORD', 'eggId already belongs to another Caller.', 409);
  }

  // The server's own egg row wins when it has one (POST /v1/eggs ran earlier),
  // and its clock decides when that egg may hatch, as on the hatch route.
  const serverEgg = eggDoc === undefined ? undefined : parseRecord(EggRecordSchema, toEggRecord(eggDoc), 'egg');
  if (serverEgg !== undefined && serverEgg.incubationEndsAt > nowMs) {
    return v1Error('NOT_READY', 'Egg is not ready to hatch.', 409);
  }

  try {
    const result = await withTransaction(req, async () => {
      const egg =
        serverEgg === undefined
          ? parseRecord(
              EggRecordSchema,
              {
                eggId: clientEgg.eggId,
                monInstanceId: clientMon.monInstanceId,
                speciesId: clientEgg.speciesId,
                hatchesIntoSpeciesId: clientEgg.hatchesIntoSpeciesId,
                callerId,
                nickname: null,
                incubationMinutes: clientEgg.incubationMinutes,
                createdAt: clientEgg.createdAt,
                incubationEndsAt: clientEgg.createdAt + clientEgg.incubationMinutes * 60_000,
              },
              'egg',
            )
          : serverEgg;
      if (serverEgg === undefined) {
        await payload.create({
          collection: EGGS_SLUG,
          data: {
            eggId: egg.eggId,
            monInstanceId: egg.monInstanceId,
            speciesId: egg.speciesId,
            hatchesIntoSpeciesId: egg.hatchesIntoSpeciesId,
            callerId,
            nickname: null,
            incubationMinutes: egg.incubationMinutes,
            createdAtMs: egg.createdAt,
            incubationEndsAt: egg.incubationEndsAt,
            hatched: false,
          },
          depth: 0,
          overrideAccess: true,
          req,
        });
      }

      const minted = mintMonInstance(egg);
      const created = asRecord(
        await payload.create({
          collection: MON_INSTANCES_SLUG,
          data: { ...minted, eggId: egg.eggId, serverConfirmedAt: new Date(nowMs) } as never,
          depth: 0,
          overrideAccess: true,
          req,
        }),
      );
      let mon = monFromDoc(created);
      const grown = {
        ...(clientMon.speciesId !== mon.speciesId ? { speciesId: clientMon.speciesId } : {}),
        ...(clientMon.stage !== mon.stage ? { stage: clientMon.stage } : {}),
        ...(clientMon.bond !== mon.bond ? { bond: clientMon.bond } : {}),
        ...(clientMon.nickname !== null && mon.nickname === null ? { nickname: clientMon.nickname } : {}),
      };
      if (Object.keys(grown).length > 0 && created !== undefined) {
        mon = monFromDoc(
          await payload.update({
            collection: MON_INSTANCES_SLUG,
            id: created.id as string | number,
            data: grown as never,
            depth: 0,
            overrideAccess: true,
            req,
          }),
        );
      }

      await payload.create({
        collection: CARE_STATES_SLUG,
        data: careData(input.care, deviceId, appliedThroughSeq),
        depth: 0,
        overrideAccess: true,
        req,
      });
      return { mon, care: input.care, ackedSeq: appliedThroughSeq, adopted: true };
    });
    return v1Ok(result);
  } catch (error) {
    // Two adopts for the same egg raced: the unique index let one through. Answer with that one.
    const raced = await findOne(payload, req, MON_INSTANCES_SLUG, 'eggId', clientEgg.eggId).catch(() => undefined);
    if (raced !== undefined && String(raced.callerId) === callerId) {
      return v1Ok(await existingResult(payload, req, raced, input));
    }
    return handleAPIError(error);
  }
}

async function safeJSON(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export function createAdoptMonHandler(deps: AdoptMonDeps): (request: Request) => Promise<Response> {
  const makeReq = deps.makeReq ?? defaultMakeReq;
  return async (request) => {
    const payload = await deps.getPayload();
    const nowMs = deps.now?.() ?? Date.now();
    try {
      const caller = await authenticateCaller(payload, request, { serviceKey: deps.serviceKey, nowMs });
      if (caller instanceof Response) return caller;
      if (!deps.rateLimit(caller.callerId)) return v1Error('INVALID_RECORD', 'Too many requests. Wait a minute.', 429);
      const req = await makeReq(payload, caller.user, request);
      return await runIdempotent(payload, { callerId: caller.callerId }, request, async () => {
        const parsed = AdoptMonRequestSchema.safeParse(await safeJSON(request));
        if (!parsed.success) return v1Error('INVALID_RECORD', parsed.error.message, 400);
        const violation = adoptRuleViolation(parsed.data, nowMs);
        if (violation !== null) return v1Error('INVALID_RECORD', violation, 400);
        return adopt(payload, req, caller.callerId, parsed.data, nowMs);
      });
    } catch (error) {
      return handleAPIError(error);
    }
  };
}

/** Ten adopts a minute per Caller: a device sends one per local-only Mon, and DECISIONS.md #18 allows two. */
export const handleAdoptMon = createAdoptMonHandler({
  getPayload: getPayloadInstance,
  rateLimit: createFixedWindowLimiter({ limit: 10, windowMs: 60_000 }),
});
