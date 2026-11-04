import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { configureVdCellSource } from '../../cell-source/index.ts';
import { createMemoryStore } from '../../cell-source/store.ts';
import { sourceNearPackage } from './on-demand.ts';
const file = Uint8Array.of(1, 2, 3);
function setup() {
  configureVdCellSource({ baseUrl: 'https://cells.example', store: createMemoryStore(),
    manifest: { version: 1, cells: { 'near/0_0': { path: 'near/0_0.bin', bytes: file.length, sha256: createHash('sha256').update(file).digest('hex'), bundled: true } } },
    io: { fetchBytes: async () => { throw new Error('unexpected network'); }, now: () => 0, sha256Hex: async bytes => createHash('sha256').update(bytes).digest('hex') },
  });
}
const info = { wide: false, key: '0_0', cx: 0, cz: 0, vertices: 3, triangles: 1, bytes: 3, bounds: [0, 0, 0, 1, 1, 1] };

test('cancellation before queued material acquisition cannot reacquire offscreen pages', async () => {
  setup(); let held = false, acquired = 0;
  const resources = { ready: () => held, prefetch: async () => { acquired++; held = true; return true; }, release: () => { held = false; } };
  const pkg = sourceNearPackage(info, 'near', async () => file.buffer as ArrayBuffer, 'cell-local', undefined, resources);
  const requested = pkg.prefetch!(true);
  pkg.releaseResources!();
  await requested;
  assert.equal(held, false, 'a queued callback must respect the later releaseResources intent');
  assert.equal(acquired, 0, 'cancel before acquisition avoids pinning any page');
});

test('downgrading wanted demand to geometry prefetch cannot reacquire material pages', async () => {
  setup(); let held = false;
  const resources = { ready: () => held, prefetch: async () => { held = true; return true; }, release: () => { held = false; } };
  const pkg = sourceNearPackage(info, 'near', async () => file.buffer as ArrayBuffer, 'cell-local', undefined, resources);
  const requested = pkg.prefetch!(true);
  const ring = pkg.prefetch!(false);
  await Promise.all([requested, ring]);
  assert.equal(held, false, 'geometry-only ring demand remains unleased after asynchronous work settles');
  assert.equal(pkg.ready!(), false);
  await pkg.prefetch!(true);
  assert.equal(held, true, 'returning actual demand can acquire a fresh lease');
  pkg.releaseResources!();
});

test('returning demand during a cancelled request acquires fresh resources and reports readiness', async () => {
  setup(); let held = false, epoch = 0, acquired = 0;
  const finish: (() => void)[] = [];
  const resources = {
    ready: () => held,
    prefetch() {
      acquired++; const mine = epoch;
      return new Promise<boolean>(resolve => finish.push(() => { if (mine === epoch) held = true; resolve(mine === epoch); }));
    },
    release() { epoch++; held = false; },
  };
  const pkg = sourceNearPackage(info, 'near', async () => file.buffer as ArrayBuffer, 'cell-local', undefined, resources);
  const old = pkg.prefetch!(true);
  await Promise.resolve();
  pkg.releaseResources!();
  const renewed = pkg.prefetch!(true);
  await Promise.resolve();
  // A stale resource promise must not swallow the newly wanted request or its completion wake.
  const requests = acquired;
  for (const resolve of finish) resolve();
  await old;
  const ready = await renewed;
  assert.equal(requests, 2, 'renewed intent obtains its own resource request rather than reusing cancelled pending');
  assert.equal(ready, true);
  assert.equal(pkg.ready!(), true);
  pkg.releaseResources!();
});
