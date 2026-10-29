// The release pass (world/release-uploaded.ts, opt-in) against the passes a
// device frame can meet after it: the physical + vd city draws its first
// frames with the shadow map off, the pass empties what they uploaded, then
// the shadow cascades come on and build their pipelines over the released
// geometry, and the camera drops to an 8 m close-up with the vd fleet and the
// near vd trees in view. Every released array is trapped
// (world/release-uploaded.test-support.ts): none may be read again. The same
// run holds every render pipeline to the iPad's 8 vertex buffers.
import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.EXPO_PUBLIC_WORLD_PHYSICAL = '1';
process.env.EXPO_PUBLIC_WORLD_RELEASE_UPLOADED = '1';
delete process.env.EXPO_PUBLIC_WORLD_VD;
delete process.env.EXPO_PUBLIC_WORLD_PROBE;
delete process.env.EXPO_PUBLIC_WORLD_TIER;
delete process.env.EXPO_PUBLIC_WORLD_DROP;

const { logFirstFrame, measureFirstFrame } = await import('./city-scene.physical-first-frame.test-support.ts');
const { MAX_VERTEX_BUFFERS } = await import('./render-runtime/recording-gpu.test-support.ts');

test('late shadow pass and close-up after the release: no released array is read, no pipeline over 8 vertex buffers', async () => {
  const frame = await measureFirstFrame({ lazyShadows: true, closeUp: true });
  logFirstFrame('physical+vd late passes', frame);
  assert.ok(frame.releasedArrays > 100, `${frame.releasedArrays} arrays released before the late passes`);
  assert.deepEqual(frame.releasedReads, {}, 'a late pass read a released array');
  assert.ok([...frame.names].some((n) => n.startsWith('living-city:vehicles:sedan:near-vd-')), 'the vd fleet is in the close-up');
  assert.ok(frame.pipelines.some((p) => p.label.includes('Shadow') || p.label.includes('Depth')), 'the late shadow pass built pipelines');
  const over = frame.pipelines.filter((p) => p.buffers > MAX_VERTEX_BUFFERS);
  assert.deepEqual(over, [], `pipelines over the iPad's ${MAX_VERTEX_BUFFERS} vertex buffers`);
});
