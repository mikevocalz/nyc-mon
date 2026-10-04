import type { Payload, PayloadRequest, SanitizedCollectionConfig } from 'payload';
import { type Mock, vi } from 'vitest';
import { deriveMonInstanceId } from '../core.ts';

type FakeRequest = Partial<Omit<PayloadRequest, 'payload'>> & { payload: Partial<Payload> };

type LocalApiCall = (options: Record<string, unknown>) => Promise<unknown>;

export interface FakePayload {
  find: Mock<LocalApiCall>;
  create: Mock<LocalApiCall>;
  update: Mock<LocalApiCall>;
  count: Mock<LocalApiCall>;
}

/** A request with a user, a context and a Local API whose calls are recorded. */
export function fakeReq(options: { user?: unknown; context?: Record<string, unknown> } = {}): {
  req: PayloadRequest;
  payload: FakePayload;
} {
  const payload: FakePayload = {
    find: vi.fn<LocalApiCall>().mockResolvedValue({ docs: [] }),
    create: vi.fn<LocalApiCall>().mockResolvedValue({}),
    update: vi.fn<LocalApiCall>().mockResolvedValue({}),
    count: vi.fn<LocalApiCall>().mockResolvedValue({ totalDocs: 0 }),
  };
  const req: FakeRequest = {
    user: (options.user ?? null) as PayloadRequest['user'],
    context: options.context ?? {},
    headers: new Headers(),
    // Only the four Local API calls the hooks make exist on this fake.
    payload: {
      find: payload.find as Payload['find'],
      create: payload.create as Payload['create'],
      update: payload.update as Payload['update'],
      count: payload.count as Payload['count'],
    },
  };
  return { req: req as PayloadRequest, payload };
}

/** The `collection` argument hooks receive; the hooks under test do not read it. */
export const anyCollection = {} as SanitizedCollectionConfig;

export const staff = (role: string, id = 7) => ({ id, role, collection: 'users' });

export const EGG_ID = 'egg_01J9X1TESTEGG';

/** A stored egg that satisfies every rule in `validateEgg`. */
export function validEggDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const createdAtMs = 1_759_600_000_000;
  return {
    eggId: EGG_ID,
    monInstanceId: deriveMonInstanceId(EGG_ID),
    speciesId: 'dex-001',
    hatchesIntoSpeciesId: 'dex-002',
    callerId: '41',
    nickname: null,
    incubationMinutes: 15,
    createdAtMs,
    incubationEndsAt: createdAtMs + 15 * 60_000,
    hatched: false,
    ...overrides,
  };
}

/** The Mon `mintMonInstance` would produce from {@link validEggDoc}. */
export function validMonDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const egg = validEggDoc();
  return {
    monInstanceId: egg.monInstanceId,
    eggId: egg.eggId,
    speciesId: egg.hatchesIntoSpeciesId,
    nickname: null,
    callerId: egg.callerId,
    hatchedAt: egg.incubationEndsAt,
    bond: 0,
    stage: 'Baby',
    voiceLineageId: null,
    ...overrides,
  };
}

export function validCareDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    monInstanceId: deriveMonInstanceId(EGG_ID),
    energy: 1,
    fullness: 0.5,
    social: 0.75,
    updatedAtMs: 1_759_600_900_000,
    lastFedAt: null,
    lastRestedAt: null,
    lastSocialAt: null,
    activity: { kind: 'awake' },
    sluggishUntil: null,
    pendingRequest: null,
    lastSeqByDevice: { 'device-a': 3 },
    ...overrides,
  };
}
