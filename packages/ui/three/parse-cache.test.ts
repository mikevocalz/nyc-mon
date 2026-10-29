import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { disposeObjectTree } from './dispose-object.ts';
import { SharedParseCache } from './parse-cache.ts';
import { releaseHLynkResources } from './release.ts';

// The shipped files the H-Lynk stages share: a Baby (Squeaklet, 25 MB) and an egg (Metro Egg).
const SQUEAKLET = new URL('../../../apps/web/public/mons/squeaklet.glb', import.meta.url);
const METRO_EGG = new URL('../../assets/eggs/metro-egg/metro-egg-hatch.glb', import.meta.url);

interface FakeBitmap {
  readonly width: number;
  readonly height: number;
  closed: number;
  close(): void;
}

/** What one parse made, so the test can check each piece was freed. */
interface Parsed {
  readonly gltf: GLTF;
  readonly bitmaps: FakeBitmap[];
}

function readBytes(url: URL): ArrayBuffer {
  const b = readFileSync(url);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

/**
 * Parses as the rigs do, in Node: images decode to stand-in ImageBitmaps
 * (what the native texture plugin hands three), everything else is real.
 */
async function parseGlb(bytes: ArrayBuffer): Promise<Parsed> {
  const bitmaps: FakeBitmap[] = [];
  const loader = new GLTFLoader().register(() => ({
    name: 'TEST_BITMAPS',
    loadTexture: () => {
      const bitmap: FakeBitmap = { width: 4, height: 4, closed: 0, close() { this.closed += 1; } };
      bitmaps.push(bitmap);
      return Promise.resolve(new THREE.Texture(bitmap as unknown as HTMLImageElement));
    },
  }));
  return { gltf: await loader.parseAsync(bytes, ''), bitmaps };
}

/** Every geometry, material and texture under the parse, each with a counted dispose. */
function spyResources(root: THREE.Object3D) {
  const counts = new Map<{ dispose(): void }, number>();
  const watch = (r: { dispose(): void }) => {
    if (counts.has(r)) return;
    counts.set(r, 0);
    const original = r.dispose.bind(r);
    r.dispose = () => {
      counts.set(r, (counts.get(r) ?? 0) + 1);
      original();
    };
  };
  let geometries = 0;
  let materials = 0;
  let textures = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (!counts.has(mesh.geometry)) geometries += 1;
    watch(mesh.geometry);
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!counts.has(m)) materials += 1;
      watch(m);
      for (const v of Object.values(m)) {
        if (v instanceof THREE.Texture) {
          if (!counts.has(v)) textures += 1;
          watch(v);
        }
      }
    }
  });
  return { counts, geometries, materials, textures };
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

function makeCache(name: string, fetches: Map<string, number>, files: Record<string, URL>) {
  const cache = new SharedParseCache<Parsed>(name, {
    keepMs: 15_000, // mon-rig's grace period: only releaseHLynkResources frees early
    dispose: (p) => disposeObjectTree(p.gltf.scene),
  });
  const fetch = (key: string) => () => {
    fetches.set(key, (fetches.get(key) ?? 0) + 1);
    return Promise.resolve(readBytes(files[key]!));
  };
  const parses = new Map<string, number>();
  const acquire = (key: string) =>
    cache.acquire(key, async () => {
      parses.set(key, (parses.get(key) ?? 0) + 1);
      return parseGlb(await cache.bytesFor(key, fetch(key)));
    });
  return { cache, acquire, parses, preload: (key: string) => cache.preload(key, fetch(key)) };
}

test('releaseHLynkResources disposes every geometry, material and texture, closes decoded images and empties the caches', async () => {
  const fetches = new Map<string, number>();
  const { cache, acquire, parses } = makeCache('test-release', fetches, { squeaklet: SQUEAKLET, 'metro-egg': METRO_EGG });

  const mon = acquire('squeaklet');
  const egg = acquire('metro-egg');
  const [parsedMon, parsedEgg] = await Promise.all([mon.value, egg.value]);
  const spies = [spyResources(parsedMon.gltf.scene), spyResources(parsedEgg.gltf.scene)];
  for (const s of spies) assert.ok(s.geometries > 0 && s.materials > 0 && s.textures > 0, 'the parse has geometry, materials and textures');

  // The stages unmount (the city goes up): the leases end, the 15 s grace timer would keep the parse.
  mon.release();
  egg.release();
  await flush();
  assert.equal(cache.stats().parsed, 2, 'held for the grace period');
  for (const s of spies) for (const n of s.counts.values()) assert.equal(n, 0);

  const report = releaseHLynkResources();
  assert.deepEqual(report['test-release'], { freed: 2, deferred: 0 });
  await flush();

  assert.deepEqual(cache.stats(), { parsed: 0, bytes: 0, keys: [] });
  for (const s of spies) {
    for (const [resource, n] of s.counts) assert.equal(n, 1, `${(resource as { type?: string }).type ?? 'resource'} disposed once`);
  }
  for (const p of [parsedMon, parsedEgg]) {
    assert.ok(p.bitmaps.length > 0);
    for (const b of p.bitmaps) assert.equal(b.closed, 1, 'the decoded image is closed');
    p.gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        for (const v of Object.values(m)) if (v instanceof THREE.Texture) assert.equal(v.image, null, 'the texture drops its image');
      }
    });
  }

  // The H-Lynk comes back: a clean reparse, new objects.
  const again = acquire('squeaklet');
  const reparsed = await again.value;
  assert.notEqual(reparsed.gltf, parsedMon.gltf);
  assert.equal(parses.get('squeaklet'), 2);
  assert.equal(fetches.get('squeaklet'), 2);
  again.release();
  releaseHLynkResources();
});

test('a parse still held by a mounted stage is dropped from the cache and freed when that stage lets go', async () => {
  const fetches = new Map<string, number>();
  const { cache, acquire } = makeCache('test-deferred', fetches, { 'metro-egg': METRO_EGG });
  const held = acquire('metro-egg');
  const parsed = await held.value;
  const spy = spyResources(parsed.gltf.scene);

  assert.deepEqual(cache.releaseAll(), { freed: 0, deferred: 1 });
  await flush();
  for (const n of spy.counts.values()) assert.equal(n, 0, 'nothing freed under a live stage');
  assert.equal(cache.stats().parsed, 0, 'but the next stage reparses');

  const fresh = acquire('metro-egg');
  assert.notEqual(await fresh.value, parsed);

  held.release();
  held.release(); // idempotent
  await flush();
  for (const n of spy.counts.values()) assert.equal(n, 1);
  fresh.release();
  cache.releaseAll();
});

test('one GLB shown by the home stage, HatchEgg3D and MONS is fetched and parsed once, and its bytes are dropped after the parse', async () => {
  const fetches = new Map<string, number>();
  const { cache, acquire, parses, preload } = makeCache('test-dedupe', fetches, { 'metro-egg': METRO_EGG });

  preload('metro-egg'); // IncubatingScreen warms the bytes
  preload('metro-egg');
  assert.equal(cache.stats().bytes, 1);
  const leases = [acquire('metro-egg'), acquire('metro-egg'), acquire('metro-egg')];
  const values = await Promise.all(leases.map((l) => l.value));
  assert.ok(values.every((v) => v === values[0]), 'every stage gets the same parse');
  assert.equal(fetches.get('metro-egg'), 1);
  assert.equal(parses.get('metro-egg'), 1);
  await flush();
  assert.equal(cache.stats().bytes, 0, 'the raw GLB is not kept beside its parse');

  preload('metro-egg'); // a stage remounting while the parse is live does not refetch
  assert.equal(fetches.get('metro-egg'), 1);
  assert.equal(cache.stats().bytes, 0);

  const spy = spyResources(values[0]!.gltf.scene);
  leases[0]!.release();
  leases[1]!.release();
  assert.equal(cache.releaseAll().deferred, 1);
  leases[2]!.release();
  await flush();
  for (const n of spy.counts.values()) assert.equal(n, 1, 'shared resources are disposed exactly once');
});

test('a failed fetch leaves both caches so the next mount retries', async () => {
  let calls = 0;
  const cache = new SharedParseCache<number>('test-failure', { keepMs: 0, dispose: () => undefined });
  const failing = () => {
    calls += 1;
    return Promise.reject(new Error('offline'));
  };
  const lease = cache.acquire('x', async () => (await cache.bytesFor('x', failing)).byteLength);
  await assert.rejects(lease.value, /offline/);
  lease.release();
  await flush();
  assert.deepEqual(cache.stats(), { parsed: 0, bytes: 0, keys: [] });
  const retry = cache.acquire('x', async () => (await cache.bytesFor('x', () => Promise.resolve(new ArrayBuffer(8)))).byteLength);
  assert.equal(await retry.value, 8);
  assert.equal(calls, 1);
  retry.release();
});
