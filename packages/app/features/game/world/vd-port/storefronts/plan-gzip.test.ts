// The website loads plan.bin.gz (plan-asset.web.ts), native loads plan.bin. They must be the same plan.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { inflatePlanBytes, isGzip } from './load.ts';

const here = new URL('.', import.meta.url);
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

test('plan.bin.gz inflates to plan.bin byte for byte', () => {
  const plain = readFileSync(new URL('plan.bin', here));
  const packed = readFileSync(new URL('plan.bin.gz', here));
  assert.ok(isGzip(packed));
  assert.ok(packed.length < plain.length / 4, `gzip copy is ${packed.length} bytes for ${plain.length}`);
  assert.equal(sha(gunzipSync(packed)), sha(plain), 'plan.bin.gz is stale: rerun tooling/city/bake-vd-storefronts.mjs');
});

test('inflatePlanBytes decodes gzip through DecompressionStream and passes plain bytes through', async () => {
  const plain = new TextEncoder().encode('{"fronts":[]}');
  const { gzipSync } = await import('node:zlib');
  assert.deepEqual(await inflatePlanBytes(new Uint8Array(gzipSync(plain))), plain);
  assert.equal(await inflatePlanBytes(plain), plain);
});
