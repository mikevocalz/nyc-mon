import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { bakeStorefrontChunkIndex, decodeStorefrontChunkIndex, STOREFRONT_CHUNKS } from './chunk-index.ts';
import { readVdStorefrontPlanFromDisk } from './load-from-disk.test-support.ts';
import { packageRingStorefronts } from './ring-packages.ts';
import { SLOTS } from './emit.ts';

const root = new URL('../../../../../../../', import.meta.url);
const PLAN = readVdStorefrontPlanFromDisk();
const ground = (x: number, z: number) => ((Math.floor(x / 7) + Math.floor(z / 11)) & 1) * 0.14;

const assertFreshInputs = (inputs: Record<string, string>, read: (path: string) => Uint8Array) => {
  for (const [path, expected] of Object.entries(inputs)) {
    assert.equal(createHash('sha256').update(read(path)).digest('hex'), expected, `${path}: rebake storefront index`);
  }
};

test('committed exact index is pinned to its generator, geometry, terrain and plan', () => {
  const meta = JSON.parse(readFileSync(new URL('./plan-index.meta.json', import.meta.url), 'utf8'));
  const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
  assertFreshInputs(meta.inputs, (path) => readFileSync(new URL(path, root)));
  const bytes = readFileSync(new URL('./plan-index.bin', import.meta.url));
  assert.equal(bytes.byteLength, meta.bytes);
  assert.ok(bytes.byteLength < 8 * 1024 * 1024, 'metadata stays under 8 MiB');
  assert.equal(hash(bytes), meta.sha256);
  const index = decodeStorefrontChunkIndex(bytes);
  assert.equal(index.frontCount, PLAN.fronts.length);
  assert.equal(index.planBytes, readFileSync(new URL('./plan.bin', import.meta.url)).byteLength);
  assert.match(readFileSync(new URL('./chunk-index-asset.ts', import.meta.url), 'utf8'), /require\('\.\/plan-index\.bin'\)/);
  assert.match(readFileSync(new URL('apps/mobile/metro.config.js', root), 'utf8'), /bin/);
});

test('plan decoding, chunk addressing and ground flag changes invalidate baked metadata', () => {
  const meta = JSON.parse(readFileSync(new URL('./plan-index.meta.json', import.meta.url), 'utf8'));
  const dependencies = [
    'packages/app/features/game/world/vd-port/storefronts/load.ts',
    'packages/app/features/game/world/cells/cell-rules.ts',
    'packages/app/features/game/world/sky-rig.ts',
  ];
  for (const changed of dependencies) {
    assert.ok(Object.hasOwn(meta.inputs, changed), `${changed} must participate in freshness`);
    assert.throws(() => assertFreshInputs(meta.inputs, (path) => {
      const bytes = readFileSync(new URL(path, root));
      return path === changed ? new Uint8Array([...bytes, 0x20]) : bytes;
    }), /rebake storefront index/);
  }
});

test('indexed filtered packages preserve exact geometry and terrain placement', () => {
  const plan = { ...PLAN, fronts: [PLAN.fronts[0]!, ...PLAN.fronts.filter((front) => front.ring === 1).slice(0, 12), ...PLAN.fronts.filter((front) => front.ring === 2).slice(0, 12)] };
  const index = decodeStorefrontChunkIndex(bakeStorefrontChunkIndex(plan, 123, ground));
  const fronts = plan.fronts.filter((_, i) => i % 3 !== 0);
  const reference = packageRingStorefronts(plan, fronts, ground, STOREFRONT_CHUNKS);
  const actual = packageRingStorefronts(plan, fronts, ground, STOREFRONT_CHUNKS, index);
  assert.equal(actual.featureCount, reference.features.length);
  assert.deepEqual(actual.features, reference.features, 'explicit feature access preserves API semantics');
  for (const slot of SLOTS) {
    assert.equal(actual.packages[slot].length, reference.packages[slot].length);
    for (let i = 0; i < actual.packages[slot].length; i++) {
      const got = actual.packages[slot][i]!, want = reference.packages[slot][i]!;
      assert.equal(got.num, want.num);
      assert.equal(got.vertexCount, want.vertexCount);
      assert.equal(got.bytes, want.bytes);
      assert.deepEqual(got.bounds, want.bounds);
      assert.deepEqual(got.attributes, want.attributes);
      got.release!();
      assert.deepEqual(got.attributes, want.attributes);
    }
  }
  assert.throws(() => packageRingStorefronts(plan, fronts, () => 99, STOREFRONT_CHUNKS, index), /ground|terrain|rebake/i);
});

test('startup merges metadata without reading any front geometry', () => {
  const front = { ...PLAN.fronts[0]! };
  const plan = { ...PLAN, fronts: [front] };
  const index = decodeStorefrontChunkIndex(bakeStorefrontChunkIndex(plan, 123, ground));
  const bays = front.bays;
  let reads = 0;
  Object.defineProperty(front, 'bays', { get() { reads++; return bays; } });
  const packed = packageRingStorefronts(plan, plan.fronts, ground, STOREFRONT_CHUNKS, index);
  assert.equal(reads, 0, 'no all-city emission/counting on startup');
  const chunk = SLOTS.flatMap((slot) => packed.packages[slot])[0]!;
  assert.ok(chunk.attributes.position!.array.length > 0);
  assert.ok(reads > 0, 'geometry emits only on actual cell demand');
});

test('corrupt or truncated metadata fails explicitly', () => {
  assert.throws(() => decodeStorefrontChunkIndex(new Uint8Array(3)), /invalid/);
  const bytes = bakeStorefrontChunkIndex({ ...PLAN, fronts: PLAN.fronts.slice(0, 1) }, 123, ground);
  assert.throws(() => decodeStorefrontChunkIndex(bytes.slice(0, -1)), /truncated/);
});

test('streamed storefront preparation yields between fronts and cancels without changing exact attributes', () => {
  const fronts = PLAN.fronts.filter((front) => front.ring === 1).slice(0, 80);
  const plan = { ...PLAN, fronts };
  const index = decodeStorefrontChunkIndex(bakeStorefrontChunkIndex(plan, 123, ground));
  const packages = packageRingStorefronts(plan, fronts, ground, STOREFRONT_CHUNKS, index).packages;
  let yielded = false;
  for (const slot of SLOTS) for (const pkg of packages[slot]) {
    const exact = pkg.attributes;
    pkg.release!();
    // An expired deadline permits one front, then must return to the host.
    if (!pkg.prepare!(0, () => 1)) yielded = true;
    pkg.release!(); // cancel a partially prepared package
    let turns = 0;
    while (!pkg.prepare!(0, () => 1)) {
      assert.ok(++turns <= fronts.length, 'one front per expired-budget turn');
    }
    assert.deepEqual(pkg.attributes, exact, `${slot}:${pkg.num} keeps every exact vertex after resume/cancel`);
    pkg.release!();
  }
  assert.ok(yielded, 'a multi-front chunk must not finish in one expired-budget turn');
});


test('failed storefront preparation resets its generator before retrying', () => {
  const fronts = PLAN.fronts.slice(0, 3);
  const plan = { ...PLAN, fronts };
  const index = decodeStorefrontChunkIndex(bakeStorefrontChunkIndex(plan, 123, ground));
  let fail = false;
  const packages = packageRingStorefronts(plan, fronts, (x, z) => {
    if (fail) throw new Error('terrain failed');
    return ground(x, z);
  }, STOREFRONT_CHUNKS, index).packages;
  const pkg = SLOTS.flatMap(slot => packages[slot])[0]!;
  const expected = pkg.attributes;
  pkg.release!();
  fail = true;
  assert.throws(() => pkg.prepare!(Infinity, () => 0), /terrain failed/);
  assert.throws(() => pkg.prepare!(Infinity, () => 0), /terrain failed/, 'closed generator must not report success with invalid attributes');
  fail = false;
  assert.equal(pkg.prepare!(Infinity, () => 0), true);
  assert.deepEqual(pkg.attributes, expected);
  pkg.release!();
});
