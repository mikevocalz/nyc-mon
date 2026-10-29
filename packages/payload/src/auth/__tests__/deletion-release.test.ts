import type { Payload } from 'payload';
import { describe, expect, it, vi } from 'vitest';
import { CALLER_DELETION_CONTEXT_KEY } from '../../collections/MonInstances.ts';
import { releaseOwnAccount, SANCTUARY_CALLER_ID } from '../deletion.ts';

vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('payload')>()),
  createLocalReq: async () => ({ context: {} }),
  initTransaction: async () => false,
}));

describe('releaseOwnAccount', () => {
  it('releases each Mon and egg under the deletion flag, so the nickname clear is allowed', async () => {
    const update = vi.fn().mockResolvedValue({});
    const find = vi.fn(async ({ collection }: { collection: string }) => ({
      docs: collection === 'eggs' ? [{ id: 1, eggId: 'egg_a' }] : collection === 'mon-instances' ? [{ id: 2, monInstanceId: 'mon_a' }] : [],
    }));
    const payload = {
      collections: { eggs: {}, 'mon-instances': {} },
      find,
      update,
      delete: vi.fn().mockResolvedValue({}),
    } as unknown as Payload;

    const released = await releaseOwnAccount(payload, '7');

    expect(released).toEqual({ userId: '7', releasedEggIds: ['egg_a'], releasedMonInstanceIds: ['mon_a'] });
    expect(update).toHaveBeenCalledTimes(2);
    for (const [options] of update.mock.calls) {
      expect(options.data).toEqual({ callerId: SANCTUARY_CALLER_ID, nickname: null });
      expect(options.context).toEqual({ [CALLER_DELETION_CONTEXT_KEY]: true });
    }
  });
});
