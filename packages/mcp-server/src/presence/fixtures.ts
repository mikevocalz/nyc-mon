import type { FamiliarPerson, Permission } from './types.ts';

/** A moment the Mon shared with a familiar person. */
export interface SharedMemory {
  readonly memoryId: string;
  readonly personId: string;
  readonly summary: string;
  /** Epoch ms. */
  readonly at: number;
}

/**
 * Familiar people and their shared memories for one Caller. Only the seeded
 * fixture implementation exists, and it is wired only in dev and simulator
 * mode (ADR 0015 §2): there is no production store.
 */
export interface FamiliarDirectory {
  listPeople(callerId: string): readonly FamiliarPerson[];
  getPerson(callerId: string, personId: string): FamiliarPerson | undefined;
  listMemories(callerId: string, personId: string): readonly SharedMemory[];
  recordMemory(callerId: string, personId: string, summary: string, at: number): SharedMemory;
}

interface Seed {
  readonly personId: string;
  readonly displayName: string;
  readonly relationship: string;
  readonly permissions: Permission;
  readonly memories: readonly string[];
}

/**
 * Fixed fictional people. James is fictional with a synthetic voice in the
 * simulator; he may talk and play but cannot share a meal or put the Mon to
 * rest, which is the refusal beat in the demo.
 */
export const FIXTURE_PEOPLE: readonly Seed[] = [
  {
    personId: 'person-james',
    displayName: 'James',
    relationship: 'friend',
    permissions: { talk: true, play: true, feed: false, rest: false },
    memories: ['Played Peek on the stoop after school.'],
  },
  {
    personId: 'person-dana',
    displayName: 'Dana',
    relationship: 'roommate',
    permissions: { talk: true, play: true, feed: true, rest: true },
    memories: [],
  },
];

/** In-memory fixtures, seeded per Caller on first read. Memories reset on restart. */
export class FixtureFamiliarDirectory implements FamiliarDirectory {
  private readonly memories = new Map<string, SharedMemory[]>();
  private nextId = 1;
  private readonly seededAt: number;

  constructor(seededAt: number = Date.now()) {
    this.seededAt = seededAt;
  }

  listPeople(callerId: string): readonly FamiliarPerson[] {
    return FIXTURE_PEOPLE.map((seed) => ({
      personId: seed.personId,
      callerId,
      displayName: seed.displayName,
      relationship: seed.relationship,
      permissions: seed.permissions,
      fictional: true as const,
    }));
  }

  getPerson(callerId: string, personId: string): FamiliarPerson | undefined {
    return this.listPeople(callerId).find((person) => person.personId === personId);
  }

  listMemories(callerId: string, personId: string): readonly SharedMemory[] {
    return [...this.memoriesFor(callerId)].filter((m) => m.personId === personId).sort((a, b) => b.at - a.at);
  }

  recordMemory(callerId: string, personId: string, summary: string, at: number): SharedMemory {
    const memory: SharedMemory = { memoryId: `memory-${this.nextId++}`, personId, summary, at };
    this.memoriesFor(callerId).push(memory);
    return memory;
  }

  private memoriesFor(callerId: string): SharedMemory[] {
    const existing = this.memories.get(callerId);
    if (existing !== undefined) return existing;
    const seeded: SharedMemory[] = FIXTURE_PEOPLE.flatMap((seed) =>
      seed.memories.map((summary) => ({
        memoryId: `memory-${this.nextId++}`,
        personId: seed.personId,
        summary,
        at: this.seededAt - 86_400_000,
      })),
    );
    this.memories.set(callerId, seeded);
    return seeded;
  }
}
