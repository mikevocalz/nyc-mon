import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMaterialPageBank } from './material-pages.ts';

test('cohorts share exact pages and evict only unreferenced allocations within their budget', async () => {
  const loads: string[] = [], disposals: string[] = [];
  const bank = createMaterialPageBank({ limitBytes: 8, pages: ['a', 'b', 'c'].map((id) => ({ id, bytes: 4 })),
    async load(id) { loads.push(id); return { bytes: 4, dispose() { disposals.push(id); } }; },
  });
  const a = bank.lease(['a']), ab = bank.lease(['a', 'b']), c = bank.lease(['c']);
  assert.equal(await a.prefetch(), true);
  assert.equal(await ab.prefetch(), true);
  assert.deepEqual(loads, ['a', 'b']);
  assert.equal(bank.bytes, 8);
  assert.equal(await c.prefetch(), false, 'in-use authored pages must not be evicted');
  a.release(); a.release(); a.release();
  assert.equal(ab.ready(), true, 'repeated cancellation cannot release another package shared-page reference');
  assert.equal(await c.prefetch(), false, 'another cohort still owns a');
  ab.release();
  assert.equal(await c.prefetch(), true);
  assert.equal(bank.bytes, 8);
  assert.equal(disposals.length, 1);
  assert.equal(c.ready(), true);
  assert.throws(() => a.get('a'), /not resident/);
  bank.dispose(); bank.dispose();
  assert.equal(bank.bytes, 0);
  assert.equal(disposals.length, 3);
  assert.equal(c.ready(), false);
});

test('cancelled uploads dispose late pages and a new lease retries without stale readiness', async () => {
  let finish!: (value: { bytes: number; dispose(): void }) => void;
  let disposed = 0, loads = 0;
  const bank = createMaterialPageBank({ limitBytes: 4, pages: [{ id: 'sign', bytes: 4 }],
    load(_id, signal) {
      loads++;
      if (loads === 1) return new Promise<{ bytes: number; dispose(): void }>((resolve) => { finish = resolve; });
      assert.equal(signal.aborted, false);
      return Promise.resolve({ bytes: 4, dispose() { disposed++; } });
    },
  });
  const lease = bank.lease(['sign']);
  const first = lease.prefetch();
  await Promise.resolve();
  lease.release();
  assert.equal(bank.bytes, 0);
  const second = lease.prefetch();
  assert.equal(await second, true);
  finish({ bytes: 4, dispose() { disposed++; } });
  assert.equal(await first, false);
  assert.equal(lease.ready(), true, 'old completion must not clear the new generation');
  assert.equal(disposed, 1);
  bank.dispose();
  assert.equal(disposed, 2);
});

test('missing, oversized, failed or mismatched authored resources never become ready', async () => {
  let loads = 0, disposed = 0;
  const bank = createMaterialPageBank({ limitBytes: 4, pages: [{ id: 'art', bytes: 4 }, { id: 'large', bytes: 8 }],
    async load() {
      if (++loads === 1) throw new Error('bad source hash');
      if (loads === 2) return { bytes: 3, dispose() { disposed++; } };
      return { bytes: 4, dispose() { disposed++; } };
    },
  });
  assert.throws(() => bank.lease(['unknown']), /Unknown/);
  assert.throws(() => bank.lease(['large']), /exceeds/);
  const lease = bank.lease(['art']);
  assert.equal(await lease.prefetch(), false);
  assert.match(String(lease.error), /bad source hash/);
  assert.equal(lease.ready(), false);
  assert.equal(bank.bytes, 0);
  assert.equal(await lease.prefetch(), false);
  assert.match(String(lease.error), /byte count mismatch/);
  assert.equal(disposed, 1);
  assert.equal(await lease.prefetch(), true);
  assert.equal(lease.error, null);
  lease.release(); lease.release(); bank.dispose();
  assert.equal(disposed, 2);
});
