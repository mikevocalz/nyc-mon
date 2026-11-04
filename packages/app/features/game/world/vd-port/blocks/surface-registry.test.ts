import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { canonicalSurfaceRegistry, verifySurfaceRegistry, type SurfaceRegistry } from './surface-registry.ts';

const hash = async (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const fixture = async () => {
  const document = { schema: 'vd-block-surfaces', version: 1, label: '街', encoding: { layout: 1, stride: 52 },
    materialCount: 1, variantCount: 1, materials: [{}], variants: [{}], frames: [{}], textures: [],
    families: [{ supported: true }], parameters: { materialCount: 1 }, coverage: { complete: true, unsupported: [] } };
  return { ...document, sha256: await hash(new TextEncoder().encode(canonicalSurfaceRegistry(document))) } as unknown as SurfaceRegistry;
};

test('registry verification authenticates counts and Unicode parameters using the native-safe injected hash contract', async () => {
  const registry = await fixture();
  await verifySurfaceRegistry(registry, registry.sha256, hash);
  await assert.rejects(verifySurfaceRegistry({ ...registry, parameters: { ...registry.parameters, materialCount: 2 } }, registry.sha256, hash), /count mismatch/);
  await assert.rejects(verifySurfaceRegistry({ ...registry, frames: [{ changed: true }] }, registry.sha256, hash), /content hash/);
  await assert.rejects(verifySurfaceRegistry(registry, '0'.repeat(64), hash), /identity mismatch/);
  await assert.rejects(verifySurfaceRegistry({ ...registry, coverage: { complete: false, unsupported: [] } }, registry.sha256, hash), /unbound/);
});

test('canonical registry ordering agrees across property insertion order and refuses nonfinite values', () => {
  assert.equal(canonicalSurfaceRegistry({ b: [2, { z: 3, a: 1 }], a: 4 }), canonicalSurfaceRegistry({ a: 4, b: [2, { a: 1, z: 3 }] }));
  assert.throws(() => canonicalSurfaceRegistry({ value: Infinity }), /Non-finite/);
});
