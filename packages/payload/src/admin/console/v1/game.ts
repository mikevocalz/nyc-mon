import {
  CareStateSchema,
  CreateEggRequestSchema,
  EggRecordSchema,
  MonInstanceSchema,
  PutCareRequestSchema,
} from '@acme/core/schemas';
import type { EggRecord, MonInstance } from '@acme/core/types';
import {
  applyCareWrites,
  createInitialCareState,
  deriveMonInstanceId,
  mintMonInstance,
} from '@acme/core/sim';
import { APIError, NotFound, commitTransaction, createLocalReq, getPayload, initTransaction, killTransaction } from 'payload';
import type { Payload, PayloadRequest, User } from 'payload';
import type {} from '../../../payload-types.ts';
import { CARE_STATES_SLUG, toCareState } from '../../../collections/CareStates.ts';
import { EGGS_SLUG } from '../../../collections/Eggs.ts';
import { parseRecord } from '../../../collections/guards.ts';
import { MON_INSTANCES_SLUG, toMonInstance } from '../../../collections/MonInstances.ts';
import { runIdempotent } from './idempotency.ts';
import { isAdultByBirthYear, isServiceRoute, readServiceCaller } from './service-caller.ts';

export type V1ErrorCode =
  | 'UNAUTHORIZED'
  | 'CONSENT_REQUIRED'
  | 'INVALID_RECORD'
  | 'NOT_FOUND'
  | 'NOT_READY'
  | 'ADULT_REQUIRED'
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

/** The signed-in (or service-delegated) Caller behind a `/v1` request. */
export interface V1Caller {
  readonly callerId: string;
  readonly user: Record<string, unknown>;
}

/** Test seams for {@link authenticateCaller}. */
export interface AuthenticateCallerOptions {
  /** `V1_MCP_SERVICE_KEY`; defaults to the process env. */
  readonly serviceKey?: string;
  readonly nowMs?: number;
}

async function loadUserById(payload: Payload, callerId: string): Promise<Record<string, unknown> | undefined> {
  try {
    return asRecord(
      await payload.findByID({ collection: 'users', id: callerId, depth: 0, overrideAccess: true, disableErrors: true }),
    );
  } catch (error) {
    // Only "no such user" means unauthenticated. Anything else (the database
    // is down, a query failed) propagates so the route answers 5xx, not 401.
    if (error instanceof NotFound) return undefined;
    throw error;
  }
}

/**
 * Resolves who a `/v1` request acts for: the MCP server's on-behalf-of
 * headers (`service-caller.ts`, adults only), else the session or bearer
 * token Payload's auth strategy accepts. Consent is checked on both paths.
 */
export async function authenticateCaller(
  payload: Payload,
  request: Request,
  options: AuthenticateCallerOptions = {},
): Promise<V1Caller | Response> {
  const service = readServiceCaller(request, options.serviceKey ?? process.env.V1_MCP_SERVICE_KEY);
  let user: Record<string, unknown> | undefined;
  if (service.kind === 'rejected') {
    return v1Error('UNAUTHORIZED', 'Sign in required.', 401);
  }
  // The service key reaches only the routes the MCP server calls; on any other
  // route the service headers are refused rather than ignored.
  if (service.kind === 'caller' && !isServiceRoute(request)) {
    return v1Error('UNAUTHORIZED', 'Sign in required.', 401);
  }
  if (service.kind === 'caller') {
    user = await loadUserById(payload, service.callerId);
    if (user === undefined) return v1Error('UNAUTHORIZED', 'Sign in required.', 401);
    if (!isAdultByBirthYear(user.birthYear, options.nowMs ?? Date.now())) {
      return v1Error('ADULT_REQUIRED', 'This account is not available here.', 403);
    }
  } else {
    const auth = await payload.auth({ headers: request.headers });
    user = asRecord(auth.user ?? undefined);
    if (user === undefined) return v1Error('UNAUTHORIZED', 'Sign in required.', 401);
  }

  const callerId = String(user.id ?? '');
  if (callerId === '') {
    return v1Error('INTERNAL_ERROR', 'Authenticated user has no id.', 500);
  }

  const consentStatus = user.consentStatus;
  if (consentStatus === 'pending' || consentStatus === 'denied') {
    return v1Error('CONSENT_REQUIRED', 'Guardian consent is required.', 403);
  }
  return { callerId, user };
}

async function buildContext(request: Request): Promise<V1Context | Response> {
  const payload = await getPayloadInstance();
  let caller: V1Caller | Response;
  try {
    caller = await authenticateCaller(payload, request);
  } catch (error) {
    return handleAPIError(error);
  }
  if (caller instanceof Response) return caller;

  const req = await createLocalReq(
    { user: caller.user as unknown as User, req: { headers: request.headers } as Partial<PayloadRequest> },
    payload,
  );
  return { payload, callerId: caller.callerId, req };
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

/**
 * POST /v1/eggs — mutating, so a request carrying `Idempotency-Key` replays
 * the first response for `(caller, path, key)` instead of running twice
 * (ADR 0001 §1.4).
 */
export async function handleCreateEgg(request: Request): Promise<Response> {
  const context = await buildContext(request);
  if (context instanceof Response) return context;
  return runIdempotent(context.payload, { callerId: context.callerId }, request, () =>
    createEgg(context, request),
  );
}

async function createEgg(context: V1Context, request: Request): Promise<Response> {
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

/** POST /v1/eggs/:id/hatch — mutating; see {@link handleCreateEgg}. */
export async function handleHatchEgg(request: Request, eggId: string): Promise<Response> {
  const context = await buildContext(request);
  if (context instanceof Response) return context;
  return runIdempotent(context.payload, { callerId: context.callerId }, request, () =>
    hatchEgg(context, eggId),
  );
}

async function hatchEgg(context: V1Context, eggId: string): Promise<Response> {
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

/**
 * PUT /v1/mons/:id/care (the ADR 0001 §1.4 contract; the route file also
 * mounts POST as an alias) — mutating; see {@link handleCreateEgg}.
 */
export async function handleApplyCare(request: Request, monInstanceId: string): Promise<Response> {
  const context = await buildContext(request);
  if (context instanceof Response) return context;
  return runIdempotent(context.payload, { callerId: context.callerId }, request, () =>
    applyCare(context, request, monInstanceId),
  );
}

async function applyCare(context: V1Context, request: Request, monInstanceId: string): Promise<Response> {
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

/** One egg the Caller is still incubating, as `GET /v1/me/eggs` returns it. */
export interface IncubatingEgg {
  readonly egg: EggRecord;
  /** True once `incubationEndsAt` has passed; the hatch has not run yet. */
  readonly readyToHatch: boolean;
}

/** Dependencies for {@link createListMyEggsHandler}; tests pass a fake Payload. */
export interface ListMyEggsDeps {
  readonly getPayload: () => Promise<Payload>;
  readonly now?: () => number;
  readonly serviceKey?: string;
}

/**
 * `GET /v1/me/eggs`: the Caller's eggs that have not hatched into a Mon yet,
 * soonest first. Read-only. An egg counts as hatched when a MonInstance with
 * its `eggId` exists (the hatch route mints one and never flips `hatched`).
 */
export function createListMyEggsHandler(deps: ListMyEggsDeps): (request: Request) => Promise<Response> {
  return async (request) => {
    const payload = await deps.getPayload();
    const nowMs = deps.now?.() ?? Date.now();
    try {
      const caller = await authenticateCaller(payload, request, { serviceKey: deps.serviceKey, nowMs });
      if (caller instanceof Response) return caller;

      const [eggDocs, monDocs] = await Promise.all([
        payload.find({
          collection: EGGS_SLUG,
          where: { callerId: { equals: caller.callerId } },
          limit: 0,
          depth: 0,
          overrideAccess: true,
        }),
        payload.find({
          collection: MON_INSTANCES_SLUG,
          where: { callerId: { equals: caller.callerId } },
          limit: 0,
          depth: 0,
          overrideAccess: true,
        }),
      ]);
      const hatchedEggIds = new Set(
        monDocs.docs.map((doc) => asRecord(doc)?.eggId).filter((id): id is string => typeof id === 'string'),
      );
      const eggs: IncubatingEgg[] = eggDocs.docs
        .map((doc) => parseRecord(EggRecordSchema, toEggRecord(asRecord(doc) ?? {}), 'egg'))
        .filter((egg) => !hatchedEggIds.has(egg.eggId) && !hatchedEggIds.has(egg.monInstanceId))
        .sort((a, b) => a.incubationEndsAt - b.incubationEndsAt)
        .map((egg) => ({ egg, readyToHatch: egg.incubationEndsAt <= nowMs }));
      return v1Ok({ eggs });
    } catch (error) {
      return handleAPIError(error);
    }
  };
}

/** `GET /v1/me/eggs`, wired to the live Payload. */
export const handleListMyEggs = createListMyEggsHandler({ getPayload: getPayloadInstance });
