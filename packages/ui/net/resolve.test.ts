import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveFetch, type FetchLike } from './resolve.ts';

const platform: FetchLike = async () => new Response('platform');

test('uses nitro-fetch when its module loads', () => {
  const nitro: FetchLike = async () => new Response('nitro');
  const r = resolveFetch(() => ({ fetch: nitro }), platform);
  assert.equal(r.transport, 'nitro');
  assert.equal(r.fetch, nitro);
  assert.equal(r.reason, undefined);
});

test('falls back to the platform fetch when the native module is missing', async () => {
  const missing = new Error("NitroModules.createHybridObject('NitroFetch'): HybridObject not registered");
  const r = resolveFetch(() => { throw missing; }, platform);
  assert.equal(r.transport, 'global');
  assert.equal(r.fetch, platform);
  assert.equal(r.reason, missing);
  assert.equal(await (await r.fetch('https://example.test/x')).text(), 'platform');
});

test('falls back when the module loads without a fetch export', () => {
  const r = resolveFetch(() => ({}), platform);
  assert.equal(r.transport, 'global');
  assert.equal(r.fetch, platform);
  assert.match(String(r.reason), /exports no fetch/);
});

test('the web/node entry is the platform fetch', async () => {
  const { binaryFetchTransport } = await import('./index.ts');
  assert.equal(binaryFetchTransport(), 'global');
});
