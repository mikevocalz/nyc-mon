import {
  CareStateSchema,
  CreateEggRequestSchema,
  EggRecordSchema,
  MonInstanceSchema,
  PutCareRequestSchema,
} from '@acme/core/schemas';
import type { MonInstance } from '@acme/core/types';
import {
  applyCareWrites,
  createInitialCareState,
  deriveMonInstanceId,
  mintMonInstance,
} from '@acme/core/sim';
import { APIError, commitTransaction, createLocalReq, getPayload, initTransaction, killTransaction } from 'payload';
import type { Payload, PayloadRequest, User } from 'payload';
import type {} from '../../../payload-types.ts';
import { CARE_STATES_SLUG, toCareState } from '../../../collections/CareStates.ts';
import { EGGS_SLUG } from '../../../collections/Eggs.ts';
import { parseRecord } from '../../../collections/guards.ts';
import { MON_INSTANCES_SLUG, toMonInstance } from '../../../collections/MonInstances.ts';

export type V1ErrorCode =
  | 'UNAUTHORIZED'
  | 'CONSENT_REQUIRED'
  | 'INVALID_RECORD'
  | 'NOT_FOUND'
  | 'NOT_READY'
  | 'INTERNAL_ERROR';

export function v1Error(code: V1ErrorCode, message: string, status: number): Response {
  return Response.json({ ok: false, error: { code, message } }, { status });
}

function v1Ok<T>(data: T): Response {
  return Response.json({ ok: true, data }, { status: 200 });
}

interface V1Context {
  payload: Payload;
  callerId: string;
  req: PayloadRequest;
}

async function getPayloadInstance(): Promise<Payload> {
  const { default: config } = await import('../../../payload.config.ts');
  return getPayload({ config });
}

async function buildContext(request: Request): Promise<V1Context | Response> {
  const payload = await getPayloadInstance();
  const { user } = await payload.auth({ headers: request.headers });
  if (user === null) {
    return v1Error('UNAUTHORIZED', 'Sign in required.', 401);
  }

  const callerId = String((user as { id?: string | number }).id ?? '');
  if (callerId === '') {
    return v1Error('INTERNAL_ERROR', 'Authenticated user has no id.', 500);
  }

  const consentStatus = (user as { consentStatus?: string }).consentStatus;
  if (consentStatus === 'pending' || consentStatus === 'denied') {
    return v1Error('CONSENT_REQUIRED', 'Guardian consent is required.', 403);
  }

  const req = await createLocalReq(
    { user: user as unknown as User, req: { headers: request.headers } as Partial<PayloadRequest> },
    payload,
  );
  return { payload, callerId, req };
}

async function withTransaction<T>(req: PayloadRequest, fn: () => Promise<T>): Promise<T> {
  const ownTransaction = await initTransaction(req);
  try {
    const result = await fn();
    if (ownTransaction) await commitTransaction(req);
    return result;
  } catch (error) {
    if (ownTransaction) await killTransaction(req);
    throw error;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
}

async function safeParseJSON(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function handleAPIError(error: unknown): Response {
  if (error instanceof APIError) {
    const data = error.data as Record<string, unknown> | undefined;
    const code = typeof data?.code === 'string' ? data.code : 'INTERNAL_ERROR';
    return Response.json({ ok: false, error: { code, message: error.message } }, { status: error.status });
  }
  if (error instanceof Error) {
    return v1Error('INTERNAL_ERROR', error.message, 500);
  }
  return v1Error('INTERNAL_ERROR', 'Unknown error.', 500);
}

function monFromDoc(raw: unknown): MonInstance {
  const doc = asRecord(raw);
  if (doc === undefined) throw new Error('mon document is not a record');
  return parseRecord(MonInstanceSchema, toMonInstance(doc), 'mon');
}

async function findCareDoc(payload: Payload, req: PayloadRequest, monInstanceId: string): Promise<Record<string, unknown> | undefined> {
  const result = await payload.find({
    collection: CARE_STATES_SLUG,
    where: { monInstanceId: { equals: monInstanceId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  });
  return asRecord(result.docs[0]);
}

/** GET /v1/me/mons */
export async function handleListMyMons(request: Request): Promise<Response> {
  const context = await buildContext(request);
  if (context instanceof Response) return context;
  const { payload, callerId, req } = context;

  const monDocs = await payload.find({
    collection: MON_INSTANCES_SLUG,
    where: { callerId: { equals: callerId } },
    limit: 0,
    depth: 0,
    overrideAccess: true,
    req,
  });

  const result = [];

  for (const raw of monDocs.docs) {
    const mon = monFromDoc(raw);
    const careDoc = await findCareDoc(payload, req, mon.monInstanceId);
    const careState =
      careDoc === undefined
        ? createInitialCareState(mon.monInstanceId, mon.hatchedAt)
        : parseRecord(CareStateSchema, toCareState(careDoc), 'care');
    result.push({ mon, care: careState });
  }

  return v1Ok({ mons: result });
}

/** POST /v1/eggs */
export async function handleCreateEgg(request: Request): Promise<Response> {
  const context = await buildContext(request);
  if (context instanceof Response) return context;
  const { payload, callerId, req } = context;

  const body = await safeParseJSON(request);
  const parsed = CreateEggRequestSchema.safeParse(body);
  if (!parsed.success) {
    return v1Error('INVALID_RECORD', parsed.error.message, 400);
  }
  const input = parsed.data;

  const nowMs = Date.now();
  const monInstanceId = deriveMonInstanceId(input.eggId);

  const existing = await payload.find({
    collection: EGGS_SLUG,
    where: { eggId: { equals: input.eggId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  });
  if (existing.docs.length > 0) {
    const doc = asRecord(existing.docs[0]);
    if (doc !== undefined && String(doc.callerId) === callerId) {
      return v1Ok({
        eggId: String(doc.eggId),
        monInstanceId: String(doc.monInstanceId),
        incubationEndsAt: Number(doc.incubationEndsAt),
      });
    }
    return v1Error('INVALID_RECORD', 'eggId already belongs to another caller.', 409);
  }

  try {
    const created = await withTransaction(req, async () =>
      payload.create({
        collection: EGGS_SLUG,
        data: {
          eggId: input.eggId,
          monInstanceId,
          speciesId: input.speciesId,
          hatchesIntoSpeciesId: input.hatchesIntoSpeciesId,
          callerId,
          nickname: input.nickname,
          incubationMinutes: input.incubationMinutes,
          createdAtMs: nowMs,
          incubationEndsAt: nowMs + input.incubationMinutes * 60_000,
          hatched: false,
        },
        depth: 0,
        overrideAccess: true,
        req,
      }),
    );

    const doc = asRecord(created);
    return v1Ok({
      eggId: String(doc?.eggId ?? input.eggId),
      monInstanceId: String(doc?.monInstanceId ?? monInstanceId),
      incubationEndsAt: Number(doc?.incubationEndsAt ?? nowMs + input.incubationMinutes * 60_000),
    });
  } catch (error) {
    return handleAPIError(error);
  }
}

/** POST /v1/eggs/:id/hatch */
export async function handleHatchEgg(request: Request, eggId: string): Promise<Response> {
  const context = await buildContext(request);
  if (context instanceof Response) return context;
  const { payload, callerId, req } = context;

  const eggResult = await payload.find({
    collection: EGGS_SLUG,
    where: { eggId: { equals: eggId }, callerId: { equals: callerId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  });
  const eggDoc = asRecord(eggResult.docs[0]);
  if (eggDoc === undefined) {
    return v1Error('NOT_FOUND', `Egg ${eggId} not found.`, 404);
  }

  const eggRecord = parseRecord(EggRecordSchema, toEggRecord(eggDoc), 'egg');
  if (eggRecord.monInstanceId !== deriveMonInstanceId(eggRecord.eggId)) {
    return v1Error('INVALID_RECORD', 'monInstanceId does not match the derived id.', 409);
  }

  const existingMon = await payload.find({
    collection: MON_INSTANCES_SLUG,
    where: { eggId: { equals: eggId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  });
  if (existingMon.docs.length > 0) {
    const mon = monFromDoc(existingMon.docs[0]);
    return v1Ok({ mon });
  }

  if (eggRecord.incubationEndsAt > Date.now()) {
    return v1Error('NOT_READY', 'Egg is not ready to hatch.', 409);
  }

  try {
    const minted = mintMonInstance(eggRecord);
    const monToCreate = {
      ...minted,
      stage: 'Baby' as const,
      serverConfirmedAt: new Date(),
    };
    const created = await withTransaction(req, async () =>
      payload.create({
        collection: MON_INSTANCES_SLUG,
        data: monToCreate as never,
        depth: 0,
        overrideAccess: true,
        req,
      }),
    );

    const mon = monFromDoc(created);
    return v1Ok({ mon });
  } catch (error) {
    const monAfterRace = await payload.find({
      collection: MON_INSTANCES_SLUG,
      where: { eggId: { equals: eggId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    });
    if (monAfterRace.docs.length > 0) {
      const mon = monFromDoc(monAfterRace.docs[0]);
      return v1Ok({ mon });
    }
    return handleAPIError(error);
  }
}

/** POST /v1/mons/:id/care */
export async function handleApplyCare(request: Request, monInstanceId: string): Promise<Response> {
  const context = await buildContext(request);
  if (context instanceof Response) return context;
  const { payload, callerId, req } = context;

  const body = await safeParseJSON(request);
  const parsed = PutCareRequestSchema.safeParse(body);
  if (!parsed.success) {
    return v1Error('INVALID_RECORD', parsed.error.message, 400);
  }
  const { writes } = parsed.data;

  for (const write of writes) {
    if (write.monInstanceId !== monInstanceId) {
      return v1Error('INVALID_RECORD', 'Care write is for a different Mon.', 400);
    }
  }

  const monResult = await payload.find({
    collection: MON_INSTANCES_SLUG,
    where: { monInstanceId: { equals: monInstanceId }, callerId: { equals: callerId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  });
  const monDoc = asRecord(monResult.docs[0]);
  if (monDoc === undefined) {
    return v1Error('NOT_FOUND', `Mon ${monInstanceId} not found.`, 404);
  }
  const mon = monFromDoc(monDoc);

  try {
    const result = await withTransaction(req, async () => {
      const careDoc = await findCareDoc(payload, req, monInstanceId);
      const state =
        careDoc === undefined
          ? { mon, care: createInitialCareState(mon.monInstanceId, mon.hatchedAt) }
          : { mon, care: parseRecord(CareStateSchema, toCareState(careDoc), 'care') };

      const previousSeqs = asRecord(careDoc?.lastSeqByDevice) ?? {};
      const startingSeqs: Record<string, number> = {};
      for (const [deviceId, seq] of Object.entries(previousSeqs)) {
        if (typeof seq === 'number') startingSeqs[deviceId] = seq;
      }

      const next = applyCareWrites({ state, lastSeqByDevice: startingSeqs }, writes);
      const nextCare = next.state.care;
      const nextMon = next.state.mon;
      const monNeedsUpdate = nextMon.bond !== mon.bond || nextMon.stage !== mon.stage || nextMon.speciesId !== mon.speciesId || nextMon.nickname !== mon.nickname;
      const nextSeqs = next.lastSeqByDevice;

      const carePayload = {
        energy: nextCare.energy,
        fullness: nextCare.fullness,
        social: nextCare.social,
        updatedAtMs: nextCare.updatedAt,
        lastFedAt: nextCare.lastFedAt,
        lastRestedAt: nextCare.lastRestedAt,
        lastSocialAt: nextCare.lastSocialAt,
        activity: nextCare.activity,
        sluggishUntil: nextCare.sluggishUntil,
        pendingRequest: nextCare.pendingRequest,
        lastSeqByDevice: nextSeqs,
      };

      if (careDoc === undefined) {
        await payload.create({
          collection: CARE_STATES_SLUG,
          data: { monInstanceId, ...carePayload },
          depth: 0,
          overrideAccess: true,
          req,
        });
      } else {
        await payload.update({
          collection: CARE_STATES_SLUG,
          id: careDoc.id as string | number,
          data: carePayload,
          depth: 0,
          overrideAccess: true,
          req,
        });
      }

      if (monNeedsUpdate) {
        const monId = monDoc.id as string | number;
        await payload.update({
          collection: MON_INSTANCES_SLUG,
          id: monId,
          data: {
            bond: nextMon.bond,
            stage: nextMon.stage as 'Baby' | 'Small' | 'Mid' | 'Max',
            speciesId: nextMon.speciesId,
            nickname: nextMon.nickname,
          },
          depth: 0,
          overrideAccess: true,
          req,
        });
      }

      let ackedSeq = 0;
      const devices = new Set(writes.map((w) => w.deviceId));
      for (const deviceId of devices) {
        const seq = nextSeqs[deviceId];
        if (typeof seq === 'number' && seq > ackedSeq) ackedSeq = seq;
      }

      return { mon: nextMon, care: nextCare, ackedSeq };
    });

    return v1Ok(result);
  } catch (error) {
    return handleAPIError(error);
  }
}

function toEggRecord(doc: Record<string, unknown>): unknown {
  return {
    eggId: doc.eggId,
    monInstanceId: doc.monInstanceId,
    speciesId: doc.speciesId,
    hatchesIntoSpeciesId: doc.hatchesIntoSpeciesId,
    callerId: doc.callerId,
    nickname: doc.nickname ?? null,
    incubationMinutes: doc.incubationMinutes,
    createdAt: doc.createdAtMs,
    incubationEndsAt: doc.incubationEndsAt,
  };
}
