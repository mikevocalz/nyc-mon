import type { CollectionBeforeChangeHook } from 'payload';
import { describe, expect, it } from 'vitest';
import { auditReveal, REVEAL_CONTEXT_KEY } from '../audit/reveal.ts';
import { AUDIT_REASON_CONTEXT_KEY, writeAuditEvent } from '../audit/writeAuditEvent.ts';
import { guardAuditEvent } from '../AuditEvents.ts';
import { validateCareState } from '../CareStates.ts';
import { deriveMonInstanceId } from '../core.ts';
import { auditEggOwnerChange, validateEgg } from '../Eggs.ts';
import { RecordError } from '../errors.ts';
import { auditConsentChange, auditConsentDelete, validateConsent } from '../GuardianConsents.ts';
import { refuseDelete } from '../guards.ts';
import { guardIntegrityRun } from '../IntegrityRuns.ts';
import { afterMonChange, validateMonInstance } from '../MonInstances.ts';
import { anyCollection, EGG_ID, fakeReq, staff, validCareDoc, validEggDoc, validMonDoc } from './helpers.ts';

type ChangeArgs = {
  data: Record<string, unknown>;
  operation: 'create' | 'update';
  originalDoc?: Record<string, unknown>;
  user?: unknown;
};

// async so a hook that throws synchronously still rejects the returned promise.
async function change(hook: CollectionBeforeChangeHook, args: ChangeArgs, req = fakeReq({ user: args.user }).req) {
  return hook({ collection: anyCollection, context: req.context, req, ...args });
}

async function codeOf(promise: unknown): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    if (error instanceof RecordError) return error.code;
    throw error;
  }
}

describe('eggs (Laws 5, 6, 8)', () => {
  it('accepts an egg that parses as EggRecord and reserves the derived id', async () => {
    expect(await codeOf(change(validateEgg, { data: validEggDoc(), operation: 'create' }))).toBeUndefined();
  });

  it('rejects an egg that reserves any other monInstanceId', async () => {
    const data = validEggDoc({ monInstanceId: deriveMonInstanceId('someone-elses-egg') });
    expect(await codeOf(change(validateEgg, { data, operation: 'create' }))).toBe('MON_ID_MISMATCH');
  });

  it('rejects a shape core refuses (Law 5)', async () => {
    const data = validEggDoc({ incubationMinutes: 45 });
    expect(await codeOf(change(validateEgg, { data, operation: 'create' }))).toBe('INVALID_RECORD');
  });

  it('rejects an incubation end that is not createdAt + minutes', async () => {
    const data = validEggDoc({ incubationEndsAt: 1 });
    expect(await codeOf(change(validateEgg, { data, operation: 'create' }))).toBe('INVALID_RECORD');
  });

  it('never lets eggId or the reserved id change', async () => {
    const originalDoc = validEggDoc();
    for (const patch of [{ eggId: 'egg_other' }, { monInstanceId: 'mon_other' }, { speciesId: 'dex-004' }]) {
      expect(await codeOf(change(validateEgg, { data: patch, operation: 'update', originalDoc }))).toBe('IMMUTABLE_FIELD');
    }
  });

  it('never turns a hatched egg back into an unhatched one (Law 8)', async () => {
    const originalDoc = validEggDoc({ hatched: true });
    const update = change(validateEgg, { data: { hatched: false }, operation: 'update', originalDoc });
    expect(await codeOf(update)).toBe('INVALID_TRANSITION');
  });

  it('lets ownership move and audits it', async () => {
    const originalDoc = validEggDoc();
    expect(await codeOf(change(validateEgg, { data: { callerId: '99' }, operation: 'update', originalDoc }))).toBeUndefined();
    const { req, payload } = fakeReq({ user: staff('ops'), context: { [AUDIT_REASON_CONTEXT_KEY]: 'legal' } });
    await auditEggOwnerChange({
      collection: anyCollection,
      context: req.context,
      data: {},
      doc: { ...originalDoc, callerId: '99' },
      operation: 'update',
      previousDoc: originalDoc,
      req,
    });
    expect(payload.create).toHaveBeenCalledOnce();
    expect(payload.create.mock.calls[0]?.[0]).toMatchObject({
      collection: 'audit-events',
      overrideAccess: true,
      req,
      data: { action: 'egg.caller_changed', targetType: 'egg', targetId: EGG_ID, reasonCode: 'legal', actorRole: 'ops' },
    });
  });
});

describe('mon-instances (Laws 6, 8)', () => {
  function withEgg(egg: Record<string, unknown> | undefined) {
    const ctx = fakeReq();
    ctx.payload.find.mockResolvedValue({ docs: egg === undefined ? [] : [{ id: 1, ...egg }] });
    return ctx;
  }

  it('accepts exactly the Mon mintMonInstance(egg) produces', async () => {
    const { req } = withEgg(validEggDoc());
    expect(await codeOf(change(validateMonInstance, { data: validMonDoc(), operation: 'create' }, req))).toBeUndefined();
  });

  it('refuses a Mon for an egg that does not exist', async () => {
    const { req } = withEgg(undefined);
    expect(await codeOf(change(validateMonInstance, { data: validMonDoc(), operation: 'create' }, req))).toBe('EGG_NOT_FOUND');
  });

  it('refuses a Mon whose id is not derived from its egg', async () => {
    const { req } = withEgg(validEggDoc());
    const data = validMonDoc({ monInstanceId: deriveMonInstanceId('egg_other') });
    expect(await codeOf(change(validateMonInstance, { data, operation: 'create' }, req))).toBe('MON_ID_MISMATCH');
  });

  it('refuses a Mon for another Caller, species or hatch time', async () => {
    for (const patch of [{ callerId: '99' }, { speciesId: 'dex-005' }, { hatchedAt: 5 }, { stage: 'Small' }]) {
      const { req } = withEgg(validEggDoc());
      const code = await codeOf(change(validateMonInstance, { data: validMonDoc(patch), operation: 'create' }, req));
      expect(code, JSON.stringify(patch)).toMatch(/MON_ID_MISMATCH|INVALID_RECORD/);
    }
  });

  it('never stores a Mon as an Egg and never moves a stage back (Law 8)', async () => {
    const { req } = withEgg(validEggDoc());
    const asEgg = change(validateMonInstance, { data: validMonDoc({ stage: 'Egg' }), operation: 'create' }, req);
    expect(await codeOf(asEgg)).toBe('INVALID_TRANSITION');
    const back = change(validateMonInstance, {
      data: { stage: 'Baby' },
      operation: 'update',
      originalDoc: validMonDoc({ stage: 'Small' }),
    });
    expect(await codeOf(back)).toBe('INVALID_TRANSITION');
  });

  it('keeps monInstanceId, eggId and hatchedAt fixed', async () => {
    const originalDoc = validMonDoc();
    for (const patch of [{ monInstanceId: 'mon_x' }, { eggId: 'egg_x' }, { hatchedAt: 1 }]) {
      const code = await codeOf(change(validateMonInstance, { data: patch, operation: 'update', originalDoc }));
      expect(code).toBe('IMMUTABLE_FIELD');
    }
  });

  it('marks the egg hatched in the same request when the Mon is created', async () => {
    const { req, payload } = withEgg(validEggDoc());
    await afterMonChange({
      collection: anyCollection,
      context: {},
      data: {},
      doc: validMonDoc(),
      operation: 'create',
      previousDoc: {},
      req,
    });
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'eggs', id: 1, data: { hatched: true }, overrideAccess: true, req }),
    );
  });
});

describe('care-states', () => {
  it('needs an existing Mon and a CareState shape', async () => {
    const { req, payload } = fakeReq();
    expect(await codeOf(change(validateCareState, { data: validCareDoc(), operation: 'create' }, req))).toBe('MON_NOT_FOUND');
    payload.count.mockResolvedValue({ totalDocs: 1 });
    expect(await codeOf(change(validateCareState, { data: validCareDoc(), operation: 'create' }, req))).toBeUndefined();
    const hp = validCareDoc({ energy: 1.5 });
    expect(await codeOf(change(validateCareState, { data: hp, operation: 'create' }, req))).toBe('INVALID_RECORD');
  });

  it('never lowers or drops a device seq', async () => {
    const originalDoc = validCareDoc({ lastSeqByDevice: { 'device-a': 3, 'device-b': 9 } });
    const lower = { lastSeqByDevice: { 'device-a': 2, 'device-b': 9 } };
    const dropped = { lastSeqByDevice: { 'device-a': 4 } };
    const forward = { lastSeqByDevice: { 'device-a': 4, 'device-b': 9, 'device-c': 1 } };
    expect(await codeOf(change(validateCareState, { data: lower, operation: 'update', originalDoc }))).toBe('INVALID_TRANSITION');
    expect(await codeOf(change(validateCareState, { data: dropped, operation: 'update', originalDoc }))).toBe('INVALID_TRANSITION');
    expect(await codeOf(change(validateCareState, { data: forward, operation: 'update', originalDoc }))).toBeUndefined();
  });
});

describe('never deleted (Law 8)', () => {
  it('refuses deletes even for server code', async () => {
    const hook = refuseDelete('mon');
    const { req } = fakeReq();
    expect(await codeOf((async () => hook({ collection: anyCollection, context: {}, id: 1, req }))())).toBe('DELETE_FORBIDDEN');
  });
});

describe('guardian-consents', () => {
  const year = new Date().getUTCFullYear();
  const pending = { parentEmail: 'parent@example.com', birthYear: year - 9, status: 'pending', emailsSent: 0 };

  it('only holds under-13 years and starts pending', async () => {
    expect(await codeOf(change(validateConsent, { data: pending, operation: 'create' }))).toBeUndefined();
    const adult = { ...pending, birthYear: year - 30 };
    expect(await codeOf(change(validateConsent, { data: adult, operation: 'create' }))).toBe('INVALID_RECORD');
    const approved = { ...pending, status: 'approved' };
    expect(await codeOf(change(validateConsent, { data: approved, operation: 'create' }))).toBe('INVALID_TRANSITION');
  });

  it('decides once, keeps the parent and year, and never lowers the mail count', async () => {
    const decided = { ...pending, status: 'denied' };
    const reopen = change(validateConsent, { data: { status: 'pending' }, operation: 'update', originalDoc: decided });
    expect(await codeOf(reopen)).toBe('INVALID_TRANSITION');
    const swap = change(validateConsent, { data: { parentEmail: 'x@example.com' }, operation: 'update', originalDoc: pending });
    expect(await codeOf(swap)).toBe('IMMUTABLE_FIELD');
    const sent = { ...pending, emailsSent: 2 };
    const lower = change(validateConsent, { data: { emailsSent: 1 }, operation: 'update', originalDoc: sent });
    expect(await codeOf(lower)).toBe('INVALID_TRANSITION');
  });

  it('audits request, decision, mail and the deletion receipt without personal values', async () => {
    const { req, payload } = fakeReq({ user: staff('consent') });
    const base = { collection: anyCollection, context: {}, data: {}, req };
    await auditConsentChange({ ...base, doc: { id: 5, ...pending }, operation: 'create', previousDoc: {} });
    await auditConsentChange({
      ...base,
      doc: { id: 5, ...pending, status: 'approved', emailsSent: 1 },
      operation: 'update',
      previousDoc: { id: 5, ...pending },
    });
    await auditConsentDelete({ collection: anyCollection, context: {}, doc: { id: 5 }, id: 5, req });
    const actions = payload.create.mock.calls.map((call) => (call[0] as { data: { action: string } }).data.action);
    expect(actions).toEqual(['consent.requested', 'consent.approved', 'consent.email_sent', 'consent.deleted']);
    const written = JSON.stringify(payload.create.mock.calls.map((call) => (call[0] as { data: unknown }).data));
    expect(written).not.toContain('parent@example.com');
    expect(written).not.toContain(String(pending.birthYear));
  });
});

describe('audit-events (append-only)', () => {
  const event = { at: '2026-10-04T00:00:00.000Z', actorRole: 'ops', action: 'audit.exported', targetType: 'audit', targetId: '12' };

  it('accepts ids and codes', async () => {
    expect(await codeOf(change(guardAuditEvent, { data: event, operation: 'create' }))).toBeUndefined();
  });

  it('refuses every update, even with overrideAccess', async () => {
    expect(await codeOf(change(guardAuditEvent, { data: {}, operation: 'update', originalDoc: event }))).toBe('APPEND_ONLY');
  });

  it('refuses an email where an id belongs', async () => {
    const leak = { ...event, targetId: 'kid@example.com' };
    expect(await codeOf(change(guardAuditEvent, { data: leak, operation: 'create' }))).toBe('INVALID_RECORD');
  });

  it('writeAuditEvent records the actor, role snapshot and request id inside the same req', async () => {
    const { req, payload } = fakeReq({ user: staff('support', 12) });
    req.headers.set('x-request-id', 'req-abc');
    await writeAuditEvent(req, { action: 'mon.value_shown', targetType: 'mon', targetId: 'mon_1', reasonCode: 'caller_request' });
    expect(payload.create.mock.calls[0]?.[0]).toMatchObject({
      collection: 'audit-events',
      overrideAccess: true,
      req,
      data: { actor: 12, actorRole: 'support', requestId: 'req-abc', reasonCode: 'caller_request' },
    });
  });
});

describe('integrity-runs', () => {
  it('needs non-negative integer counts and is append-only', async () => {
    const run = { at: '2026-10-04T00:00:00.000Z', trigger: 'manual', sharedEgg: 0, idMismatch: 0, orphans: 0, staleReady: 2 };
    expect(await codeOf(change(guardIntegrityRun, { data: run, operation: 'create' }))).toBeUndefined();
    expect(await codeOf(change(guardIntegrityRun, { data: { ...run, orphans: -1 }, operation: 'create' }))).toBe('INVALID_RECORD');
    expect(await codeOf(change(guardIntegrityRun, { data: run, operation: 'update', originalDoc: run }))).toBe('APPEND_ONLY');
  });
});

describe('reveal audit hook', () => {
  const hook = auditReveal({
    collection: 'mon-instances',
    maskedFields: ['nickname'],
    action: 'mon.value_shown',
    targetType: 'mon',
    targetIdOf: (doc) => String(doc.monInstanceId),
  });
  const reveal = { [REVEAL_CONTEXT_KEY]: { collection: 'mon-instances', field: 'nickname', reasonCode: 'support_request' } };

  it('logs a reveal that returned the value, with the id and reason only', async () => {
    const { req, payload } = fakeReq({ user: staff('support'), context: reveal });
    await hook({ collection: anyCollection, context: req.context, doc: { monInstanceId: 'mon_1', nickname: 'Pip' }, req });
    expect(payload.create).toHaveBeenCalledOnce();
    const data = (payload.create.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data).toMatchObject({ action: 'mon.value_shown', targetId: 'mon_1', reasonCode: 'support_request' });
    expect(JSON.stringify(data)).not.toContain('Pip');
  });

  it('logs nothing for an ordinary read or when field access withheld the value', async () => {
    const plain = fakeReq({ user: staff('support') });
    await hook({ collection: anyCollection, context: {}, doc: { monInstanceId: 'mon_1' }, req: plain.req });
    const withheld = fakeReq({ user: staff('content'), context: reveal });
    await hook({ collection: anyCollection, context: withheld.req.context, doc: { monInstanceId: 'mon_1' }, req: withheld.req });
    expect(plain.payload.create).not.toHaveBeenCalled();
    expect(withheld.payload.create).not.toHaveBeenCalled();
  });
});
