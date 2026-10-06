import type { Access, AccessArgs, CollectionConfig, Field, FieldAccessArgs } from 'payload';
import { describe, expect, it } from 'vitest';
import { readStaffRole, STAFF_ROLES } from '../access/roles.ts';
import { REVEAL_CONTEXT_KEY } from '../audit/reveal.ts';
import { AuditEvents } from '../AuditEvents.ts';
import { CareStates } from '../CareStates.ts';
import { ConsentStatusSchema } from '../core.ts';
import { Eggs } from '../Eggs.ts';
import { GUARDIAN_CONSENT_STATUSES, GuardianConsents } from '../GuardianConsents.ts';
import { IntegrityRuns } from '../IntegrityRuns.ts';
import { MON_STAGES, MonInstances } from '../MonInstances.ts';
import { anyCollection, fakeReq, staff } from './helpers.ts';

const X1 = [GuardianConsents, Eggs, MonInstances, CareStates, AuditEvents, IntegrityRuns];

type Viewer = 'anonymous' | 'caller' | (typeof STAFF_ROLES)[number] | 'legacyAdmin';

const VIEWERS: Readonly<Record<Viewer, unknown>> = {
  anonymous: null,
  caller: { id: 41, role: 'user', collection: 'users' },
  ops: staff('ops'),
  support: staff('support'),
  consent: staff('consent'),
  content: staff('content'),
  legacyAdmin: staff('admin'),
};

async function run(access: Access | undefined, viewer: Viewer): Promise<unknown> {
  if (access === undefined) throw new Error('access function missing');
  const { req } = fakeReq({ user: VIEWERS[viewer] });
  return access({ req } as AccessArgs);
}

function field(collection: CollectionConfig, name: string): Field {
  const found = collection.fields.find((f) => 'name' in f && f.name === name);
  if (found === undefined) throw new Error(`${collection.slug}.${name} missing`);
  return found;
}

async function canReadField(collection: CollectionConfig, name: string, viewer: Viewer, context = {}) {
  const f = field(collection, name);
  const read = 'access' in f ? f.access?.read : undefined;
  if (read === undefined) return true;
  const { req } = fakeReq({ user: VIEWERS[viewer], context });
  return read({ req, collection: anyCollection } as FieldAccessArgs);
}

describe('staff role parsing (ADR 0004 §8)', () => {
  it('reads the staff roles; the retired admin value is no role', () => {
    expect(readStaffRole(staff('support'))).toBe('support');
    expect(readStaffRole(staff('admin'))).toBeUndefined();
  });

  it('gives Callers, anonymous requests and unknown roles no staff role', () => {
    expect(readStaffRole({ id: 1, role: 'user' })).toBeUndefined();
    expect(readStaffRole(null)).toBeUndefined();
    expect(readStaffRole({ id: 1, role: 'superuser' })).toBeUndefined();
    expect(readStaffRole({ id: 1 })).toBeUndefined();
  });
});

describe('collection writes: server code only', () => {
  for (const collection of X1) {
    for (const op of ['create', 'update', 'delete'] as const) {
      it(`${collection.slug}.${op} is denied to every role`, async () => {
        for (const viewer of Object.keys(VIEWERS) as Viewer[]) {
          expect(await run(collection.access?.[op], viewer)).toBe(false);
        }
      });
    }
  }
});

describe('collection reads by role', () => {
  const matrix: [CollectionConfig, Viewer[]][] = [
    [GuardianConsents, ['ops', 'consent']],
    [Eggs, ['ops', 'support']],
    [MonInstances, ['ops', 'support']],
    [CareStates, ['ops', 'support']],
    [IntegrityRuns, ['ops', 'support', 'consent', 'content']],
  ];
  for (const [collection, allowed] of matrix) {
    it(`${collection.slug} is readable by ${allowed.join(', ')} only`, async () => {
      for (const viewer of Object.keys(VIEWERS) as Viewer[]) {
        expect(await run(collection.access?.read, viewer), viewer).toBe(allowed.includes(viewer));
      }
    });
  }

  it('audit-events: ops reads all, other staff read their own, Callers and anonymous nothing', async () => {
    expect(await run(AuditEvents.access?.read, 'ops')).toBe(true);
    expect(await run(AuditEvents.access?.read, 'support')).toEqual({ actor: { equals: 7 } });
    expect(await run(AuditEvents.access?.read, 'consent')).toEqual({ actor: { equals: 7 } });
    expect(await run(AuditEvents.access?.read, 'caller')).toBe(false);
    expect(await run(AuditEvents.access?.read, 'anonymous')).toBe(false);
  });
});

describe('masked fields (D-A1 reveal-and-log)', () => {
  const masked: [CollectionConfig, string, Viewer][] = [
    [GuardianConsents, 'parentEmail', 'consent'],
    [GuardianConsents, 'birthYear', 'consent'],
    [Eggs, 'nickname', 'support'],
    [MonInstances, 'nickname', 'support'],
  ];

  for (const [collection, name, role] of masked) {
    it(`${collection.slug}.${name} is hidden from every role by default`, async () => {
      for (const viewer of Object.keys(VIEWERS) as Viewer[]) {
        expect(await canReadField(collection, name, viewer)).toBe(false);
      }
    });

    it(`${collection.slug}.${name} shows to ${role} only for a reveal of that field with a reason code`, async () => {
      const reveal = { collection: collection.slug, field: name, reasonCode: 'support_request' };
      expect(await canReadField(collection, name, role, { [REVEAL_CONTEXT_KEY]: reveal })).toBe(true);
      expect(await canReadField(collection, name, 'caller', { [REVEAL_CONTEXT_KEY]: reveal })).toBe(false);
      expect(await canReadField(collection, name, 'content', { [REVEAL_CONTEXT_KEY]: reveal })).toBe(false);
      const noReason = { [REVEAL_CONTEXT_KEY]: { collection: collection.slug, field: name } };
      expect(await canReadField(collection, name, role, noReason)).toBe(false);
      const freeText = { [REVEAL_CONTEXT_KEY]: { ...reveal, reasonCode: 'because I said so' } };
      expect(await canReadField(collection, name, role, freeText)).toBe(false);
      const otherField = { [REVEAL_CONTEXT_KEY]: { ...reveal, field: 'status' } };
      expect(await canReadField(collection, name, role, otherField)).toBe(false);
      const otherCollection = { [REVEAL_CONTEXT_KEY]: { ...reveal, collection: 'users' } };
      expect(await canReadField(collection, name, role, otherCollection)).toBe(false);
    });
  }
});

describe('schema shape guarantees', () => {
  it('guardian-consents has no free-text field of any kind (D-A2)', () => {
    const textLike = new Set(['text', 'textarea', 'richText', 'json', 'code', 'array', 'blocks']);
    for (const f of GuardianConsents.fields) expect(textLike.has(f.type), 'name' in f ? f.name : f.type).toBe(false);
  });

  it('guardian consent statuses cover every core ConsentStatus except not-required', () => {
    const core = ConsentStatusSchema.options.filter((s) => s !== 'not-required');
    for (const status of core) expect(GUARDIAN_CONSENT_STATUSES).toContain(status);
  });

  it('a stored Mon cannot hold the Egg stage (Law 8)', () => {
    expect(MON_STAGES).not.toContain('Egg');
  });

  it('eggId and monInstanceId are unique wherever they identify a row (Law 6)', () => {
    const unique = (c: CollectionConfig, name: string) => {
      const f = field(c, name);
      return 'unique' in f && f.unique === true;
    };
    expect(unique(Eggs, 'eggId')).toBe(true);
    expect(unique(Eggs, 'monInstanceId')).toBe(true);
    expect(unique(MonInstances, 'eggId')).toBe(true);
    expect(unique(MonInstances, 'monInstanceId')).toBe(true);
    expect(unique(CareStates, 'monInstanceId')).toBe(true);
    expect(MonInstances.indexes).toContainEqual({ fields: ['monInstanceId', 'eggId'], unique: true });
  });

  it('every X1 collection is hidden from the stock admin nav', () => {
    for (const c of X1) expect(c.admin?.hidden).toBe(true);
  });
});
