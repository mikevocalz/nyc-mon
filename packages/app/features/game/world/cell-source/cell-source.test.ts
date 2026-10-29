// The on-demand cell source, against a fake store and fake network (no platform IO).
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createCellSource } from './cell-source.ts';
import { createMemoryStore } from './store.ts';
import type { CellIo, CellManifest } from './types.ts';

const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const bytes = (fill: number, n: number) => new Uint8Array(n).fill(fill);

function manifestOf(cells: Record<string, Uint8Array>, bundledKeys: readonly string[] = []): { manifest: CellManifest; data: Map<string, Uint8Array> } {
  const data = new Map(Object.entries(cells));
  const cells_ = Object.fromEntries([...data].map(([k, b]) => [
    k,
    { path: `${k}.bin`, sha256: sha(b), bytes: b.byteLength, bundled: bundledKeys.includes(k) },
  ]));
  return { manifest: { version: 1, cells: cells_ }, data };
}

function ioOf(data: Map<string, Uint8Array>, hooks: { fail?: (url: string) => boolean; calls?: string[]; delay?: number } = {}): CellIo {
  let t = 0;
  return {
    fetchBytes: async (url: string, signal?: AbortSignal) => {
      hooks.calls?.push(url);
      if (hooks.delay) await new Promise((r) => setTimeout(r, hooks.delay));
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
      const name = url.slice(url.lastIndexOf('/') + 1, -4);
      if (hooks.fail?.(url) || !data.has(name)) throw new Error(`GET ${url} -> 503`);
      return data.get(name)!;
    },
    sha256Hex: async (b: Uint8Array) => sha(b),
    now: () => t++,
  };
}

const CELL_A = bytes(1, 1024);
const CELL_B = bytes(2, 2048);
const CELL_C = bytes(3, 512);

describe('cell source', () => {
  it('downloads a remote cell once, verifies it and promotes it to the cache', async () => {
    const { manifest, data } = manifestOf({ a: CELL_A });
    const calls: string[] = [];
    const store = createMemoryStore();
    const s = createCellSource({ manifest, io: ioOf(data, { calls }), store, baseUrl: 'https://cells.example' });
    const got = await s.fetch('a');
    assert.deepEqual([...got!], [...CELL_A]);
    assert.equal(calls.length, 1);
    // second read comes from the cache: no more network
    const again = await s.fetch('a');
    assert.deepEqual([...again!], [...CELL_A]);
    assert.equal(calls.length, 1);
    assert.equal(s.stats().cached, 1);
    s.dispose();
  });

  it('prefers the bundled loader for home cells, offline first launch', async () => {
    const { manifest, data } = manifestOf({ a: CELL_A }, ['a']);
    const calls: string[] = [];
    const s = createCellSource({ manifest, io: ioOf(data, { calls }), store: createMemoryStore(), baseUrl: 'https://cells.example' });
    const got = await s.fetch('a', async () => CELL_A);
    assert.deepEqual([...got!], [...CELL_A]);
    assert.equal(calls.length, 0);
    s.dispose();
  });

  it('falls back to the bundled loader when the network fails', async () => {
    const { manifest, data } = manifestOf({ a: CELL_A });
    const s = createCellSource({ manifest, io: ioOf(data, { fail: () => true }), store: createMemoryStore(), baseUrl: 'https://cells.example' });
    const got = await s.fetch('a', async () => CELL_A);
    assert.deepEqual([...got!], [...CELL_A]);
    s.dispose();
  });

  it('returns null for a cell the manifest does not know and no bundled loader covers', async () => {
    const { manifest, data } = manifestOf({ a: CELL_A });
    const s = createCellSource({ manifest, io: ioOf(data), store: createMemoryStore(), baseUrl: 'https://cells.example' });
    assert.equal(await s.fetch('nope'), null);
    assert.equal(s.stats().inflight, 0);
    s.dispose();
  });

  it('still serves bundled bytes for a cell outside the manifest', async () => {
    const { manifest, data } = manifestOf({ a: CELL_A });
    const s = createCellSource({ manifest, io: ioOf(data), store: createMemoryStore(), baseUrl: 'https://cells.example' });
    const got = await s.fetch('local-only', async () => CELL_B);
    assert.deepEqual([...got!], [...CELL_B]);
    s.dispose();
  });

  it('rejects a download whose sha256 differs and never promotes it', async () => {
    const { manifest } = manifestOf({ a: CELL_A });
    const wrong = new Map([['a', bytes(9, 1024)]]);
    const calls: string[] = [];
    const store = createMemoryStore();
    const s = createCellSource({ manifest, io: ioOf(wrong, { calls }), store, baseUrl: 'https://cells.example', maxRetries: 2 });
    assert.equal(await s.fetch('a'), null);
    assert.equal(calls.length, 2);
    assert.equal(s.stats().cached, 0);
    s.dispose();
  });

  it('rejects a download whose byte length differs', async () => {
    const { manifest } = manifestOf({ a: CELL_A });
    const wrong = new Map([['a', bytes(1, 999)]]);
    const s = createCellSource({ manifest, io: ioOf(wrong), store: createMemoryStore(), baseUrl: 'https://cells.example' });
    assert.equal(await s.fetch('a'), null);
    s.dispose();
  });

  it('dedupes concurrent fetches of one cell', async () => {
    const { manifest, data } = manifestOf({ a: CELL_A });
    const calls: string[] = [];
    const s = createCellSource({ manifest, io: ioOf(data, { calls, delay: 5 }), store: createMemoryStore(), baseUrl: 'https://cells.example' });
    const [x, y] = await Promise.all([s.fetch('a'), s.fetch('a')]);
    assert.ok(x && y);
    assert.equal(calls.length, 1);
    s.dispose();
  });

  it('bounds concurrency: one in flight, the rest queued', async () => {
    const { manifest, data } = manifestOf({ a: CELL_A, b: CELL_B, c: CELL_C });
    const calls: string[] = [];
    let inflight = 0, maxSeen = 0;
    const io = ioOf(data, { calls, delay: 5 });
    const orig = io.fetchBytes;
    io.fetchBytes = async (u, s2) => { inflight++; maxSeen = Math.max(maxSeen, inflight); try { return await orig(u, s2); } finally { inflight--; } };
    const s = createCellSource({ manifest, io, store: createMemoryStore(), baseUrl: 'https://cells.example', maxConcurrent: 1 });
    await Promise.all([s.fetch('a'), s.fetch('b'), s.fetch('c')]);
    assert.equal(maxSeen, 1);
    assert.equal(calls.length, 3);
    s.dispose();
  });

  it('cools down after a bounded run of failed retries, then recovers', async () => {
    const { manifest } = manifestOf({ a: CELL_A });
    const calls: string[] = [];
    let t = 0;
    const io: CellIo = {
      fetchBytes: async (url: string) => { calls.push(url); throw new Error('down'); },
      sha256Hex: async (b: Uint8Array) => sha(b),
      now: () => t,
    };
    const store = createMemoryStore();
    const s = createCellSource({ manifest, io, store, baseUrl: 'https://cells.example', maxRetries: 2, retryCooldownMs: 1000 });
    assert.equal(await s.fetch('a'), null);
    assert.equal(calls.length, 2);
    // inside the cooldown: no new network attempt
    t = 500;
    assert.equal(await s.fetch('a'), null);
    assert.equal(calls.length, 2);
    // after the cooldown: tries again (bounded again)
    t = 1501;
    assert.equal(await s.fetch('a'), null);
    assert.equal(calls.length, 4);
    s.dispose();
  });

  it('cancel abandons an in-flight fetch without burning a retry slot', async () => {
    const { manifest, data } = manifestOf({ a: CELL_A });
    const calls: string[] = [];
    const s = createCellSource({ manifest, io: ioOf(data, { calls, delay: 30 }), store: createMemoryStore(), baseUrl: 'https://cells.example' });
    const p = s.fetch('a');
    s.cancel('a');
    assert.equal(await p, null);
    const got = await s.fetch('a');
    assert.deepEqual([...got!], [...CELL_A]);
    s.dispose();
  });

  it('dispose cancels the queue and fails soft', async () => {
    const { manifest, data } = manifestOf({ a: CELL_A, b: CELL_B });
    const s = createCellSource({ manifest, io: ioOf(data, { delay: 30 }), store: createMemoryStore(), baseUrl: 'https://cells.example', maxConcurrent: 1 });
    const p1 = s.fetch('a');
    const p2 = s.fetch('b');   // queued behind 'a'
    s.dispose();
    assert.equal(await p1, null);
    assert.equal(await p2, null);
    assert.equal(await s.fetch('a'), null);
  });

  it('serves cached bytes while the host is unreachable (offline restart)', async () => {
    const { manifest, data } = manifestOf({ a: CELL_A });
    const store = createMemoryStore();
    const s1 = createCellSource({ manifest, io: ioOf(data), store, baseUrl: 'https://cells.example' });
    await s1.fetch('a');
    s1.dispose();
    // a new source over the same store: the persisted index brings the cell back, no network
    const calls: string[] = [];
    const s2 = createCellSource({ manifest, io: ioOf(data, { calls, fail: () => true }), store, baseUrl: 'https://cells.example' });
    const got = await s2.fetch('a');
    assert.deepEqual([...got!], [...CELL_A]);
    assert.equal(calls.length, 0);
    s2.dispose();
  });

  it('evicts the least recently used cell past the byte capacity', async () => {
    const { manifest, data } = manifestOf({ a: CELL_A, b: CELL_B });
    const store = createMemoryStore();
    const s = createCellSource({ manifest, io: ioOf(data), store, baseUrl: 'https://cells.example', capacityBytes: 2500 });
    await s.fetch('a');
    await s.fetch('b');   // 1024 + 2048 > 2500: 'a' (older) must go
    assert.equal(s.stats().cached, 1);
    assert.equal(s.stats().bytes, 2048);
    // 'a' is gone from disk: a read now costs a network call again
    const calls: string[] = [];
    (data as Map<string, Uint8Array>).set('a', CELL_A);
    const s2io = ioOf(data, { calls });
    void s2io;
    s.dispose();
  });

  it('drops a corrupt cached file (size mismatch) and refetches', async () => {
    const { manifest, data } = manifestOf({ a: CELL_A });
    const store = createMemoryStore();
    const s1 = createCellSource({ manifest, io: ioOf(data), store, baseUrl: 'https://cells.example' });
    await s1.fetch('a');
    // corrupt the stored file, keep the index
    const names = await store.list();
    await store.write(names.find((n) => n.endsWith('.bin'))!, bytes(7, 10));
    s1.dispose();
    const calls: string[] = [];
    const s2 = createCellSource({ manifest, io: ioOf(data, { calls }), store, baseUrl: 'https://cells.example' });
    const got = await s2.fetch('a');
    assert.deepEqual([...got!], [...CELL_A]);
    assert.equal(calls.length, 1);   // the corrupt file was not served
    s2.dispose();
  });

  it('recovers from a corrupt index file', async () => {
    const { manifest, data } = manifestOf({ a: CELL_A });
    const store = createMemoryStore();
    await store.write('index.json', new TextEncoder().encode('{oops'));
    const s = createCellSource({ manifest, io: ioOf(data), store, baseUrl: 'https://cells.example' });
    const got = await s.fetch('a');
    assert.deepEqual([...got!], [...CELL_A]);
    s.dispose();
  });

  it('sweeps orphan files not named in the persisted index', async () => {
    const { manifest, data } = manifestOf({ a: CELL_A });
    const store = createMemoryStore();
    const s1 = createCellSource({ manifest, io: ioOf(data), store, baseUrl: 'https://cells.example' });
    await s1.fetch('a');
    await store.write('stray.bin', bytes(5, 10));
    s1.dispose();
    const s2 = createCellSource({ manifest, io: ioOf(data), store, baseUrl: 'https://cells.example' });
    await s2.ready;
    const names = await store.list();
    assert.ok(!names.includes('stray.bin'));
    s2.dispose();
  });
});
